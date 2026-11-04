import { t } from '../i18n';
import { createLoadingGate, loadingProgress, tipIndex } from './loading-gate';
import { spinLoader } from './spinner';

/**
 * The boot splash (.agents/DESIGN.md §4 "Loading"): the game's name, the eclipse
 * spin loader and one lore tip, over the ink page, only while the critical
 * sprite set loads. It appears after 150 ms (so a warm start never shows it),
 * stays at least 400 ms once shown, and fades out. Real progress from the
 * loader is the ring's accessible value (no percentage on screen).
 */
const TIPS = 8;
const DELAY_MS = 150;
const MIN_VISIBLE_MS = 400;
const FADE_MS = 200;

export interface BootSplash {
  /** Feed the loader's (settled, total). */
  progress(done: number, total: number): void;
  /** Work finished: the splash leaves (if it ever showed). Resolves once it is gone. */
  done(): Promise<void>;
}

export function bootSplash(parent: HTMLElement): BootSplash {
  const root = document.createElement('div');
  root.className = 'boot';
  root.hidden = true;
  const title = document.createElement('p');
  title.className = 'boot-title';
  title.textContent = t('app.title');
  const ring = spinLoader({ label: t('loading.sprites'), size: 64 });
  ring.setAttribute('aria-live', 'polite');
  const tip = document.createElement('p');
  tip.className = 'boot-tip';
  const first = Math.floor(Math.random() * TIPS);
  tip.textContent = t(`boot.tip.${first + 1}`);
  root.append(title, ring, tip);
  parent.append(root);

  const started = performance.now();
  let rotate: number | null = null;
  const gate = createLoadingGate({
    delayMs: DELAY_MS,
    minVisibleMs: MIN_VISIBLE_MS,
    now: () => performance.now(),
    schedule: (fn, ms) => window.setTimeout(fn, ms),
    cancel: (handle) => window.clearTimeout(handle),
    show: () => {
      root.hidden = false;
      rotate = window.setInterval(() => {
        tip.textContent = t(`boot.tip.${tipIndex(performance.now() - started, TIPS, first) + 1}`);
      }, 4000);
    },
    hide: () => {
      if (rotate !== null) window.clearInterval(rotate);
      root.classList.add('is-leaving');
      window.setTimeout(() => root.remove(), FADE_MS);
      finished();
    },
  });
  let finished: () => void = () => undefined;
  gate.start();

  return {
    progress(done, total) {
      ring.setAttribute('aria-valuenow', String(loadingProgress(done, total)));
    },
    done() {
      return new Promise((resolve) => {
        finished = resolve;
        gate.stop();
        // Never shown: nothing to wait for.
        if (root.hidden) {
          root.remove();
          resolve();
        }
      });
    },
  };
}
