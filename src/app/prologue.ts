import type { SheetStore } from '../adapters/assets';
import { drawPrologue, STAGE, type SceneTime } from '../adapters/prologue-scenes';
import { PROLOGUE, type CinematicPanel, type PrologueScene, type Shot } from '../data/prologue';
import { t } from '../i18n';
import { cameraAt, holdProgress, panelAlpha, panelAt, revealedChars, skipAvailable } from '../ui/cinematic';
import { h } from '../ui/window';

/**
 * The prologue player: plays PROLOGUE on a low-res canvas scaled up by a
 * whole number (pixelated), with the narration typed out in the DOM below the
 * picture. Skippable after the first second by holding Esc or Enter, or by
 * clicking "Saltar". When it ends or is skipped it calls `onDone` once; the
 * caller decides what comes next (the route name is PROLOGUE_ROUTE). It
 * cleans up by itself when it leaves the page.
 */
export const PROLOGUE_ROUTE = 'prologue';

export interface PrologueMusic {
  /** Starts the prologue track `offsetS` in (0 is the top). */
  start(offsetS: number): void;
  /** Fades it out (skip or end). */
  stop(): void;
}

export interface PrologueOptions {
  /** The loaded sprite sheets, or null while they load (figures are left out until then). */
  sheets: () => SheetStore | null;
  onDone: () => void;
  music?: PrologueMusic;
  /** Start this far in (development screenshots). */
  startMs?: number;
  /** Another cinematic on the same player (the guardian ones): its panels and how to draw them. Default: the prologue. */
  panels?: readonly CinematicPanel[];
  draw?(ctx: CanvasRenderingContext2D, panel: CinematicPanel, time: SceneTime, camera: Shot, alpha: number): void;
  /** Accessible name of the screen (default: the Prologue title entry). */
  label?: string;
}

/** Largest whole-number scale at which the stage fits the window. */
const stageScale = (): number => Math.max(1, Math.floor(Math.min(window.innerWidth / STAGE.w, window.innerHeight / STAGE.h)));

const isSkipKey = (key: string): boolean => key === 'Escape' || key === 'Enter';

export function prologueScreen(options: PrologueOptions): HTMLElement {
  const canvas = h('canvas', { className: 'prologue-canvas' });
  canvas.width = STAGE.w;
  canvas.height = STAGE.h;
  const lines = [h('p'), h('p')];
  const text = h('div', { className: 'prologue-text' }, lines);
  text.setAttribute('aria-live', 'polite');
  const stage = h('div', { className: 'prologue-stage' }, [canvas, text]);
  const hold = h('span', { className: 'prologue-hold' });
  const skip = h('button', { className: 'prologue-skip', type: 'button', textContent: t('prologue.skip') });
  skip.append(hold);
  const hint = h('p', { className: 'prologue-hint', textContent: t('prologue.skipHint') });
  const element = h('section', { className: 'prologue' }, [stage, skip, hint]);
  element.setAttribute('aria-label', options.label ?? t('title.prologue'));
  const panels = options.panels ?? PROLOGUE;

  const ctx = canvas.getContext('2d');
  let started: number | null = null;
  let pressedAt: number | null = null;
  let finished = false;
  let scale = 0;
  let shownPanel = -1;
  let shownText = '';
  let elapsed = options.startMs ?? 0;

  const cleanup = () => {
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    options.music?.stop();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    cleanup();
    options.onDone();
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!isSkipKey(e.key)) return;
    // Keep the key from the menus behind and from page scrolling.
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat && pressedAt === null && skipAvailable(elapsed)) pressedAt = performance.now();
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (isSkipKey(e.key)) pressedAt = null;
  };
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  skip.addEventListener('click', () => {
    if (skipAvailable(elapsed)) finish();
  });
  // Touch: holding a finger anywhere on the picture is the held skip key (the same progress bar).
  element.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.target === skip || pressedAt !== null || !skipAvailable(elapsed)) return;
    pressedAt = performance.now();
  });
  const letGo = (e: PointerEvent) => {
    if (e.pointerType === 'touch') pressedAt = null;
  };
  element.addEventListener('pointerup', letGo);
  element.addEventListener('pointercancel', letGo);

  const renderText = (index: number, localMs: number, alpha: number) => {
    const panel = panels[index]!;
    const strings = panel.lines.map((key) => [...t(key)]);
    const counts = revealedChars(panel, localMs, strings.map((s) => s.length));
    const key = `${index}:${counts.join(',')}`;
    if (index !== shownPanel) {
      shownPanel = index;
      text.classList.toggle('is-voice', panel.scene === 'voice');
    }
    if (key !== shownText) {
      shownText = key;
      lines.forEach((p, i) => {
        const chars = strings[i] ?? [];
        const n = counts[i] ?? 0;
        p.replaceChildren(h('span', { textContent: chars.slice(0, n).join('') }), h('span', { className: 'rest', textContent: chars.slice(n).join('') }));
      });
    }
    text.style.opacity = String(Math.max(0, Math.min(1, alpha * 1.15)));
  };

  const frame = (now: number) => {
    if (finished) return;
    if (!element.isConnected) {
      // Left the page some other way (another screen replaced it).
      if (started !== null) {
        finished = true;
        cleanup();
      } else requestAnimationFrame(frame);
      return;
    }
    if (started === null) {
      started = now - elapsed;
      options.music?.start(elapsed / 1000);
    }
    elapsed = now - started;
    if (holdProgress(pressedAt, now) >= 1) {
      finish();
      return;
    }
    const moment = panelAt(panels, elapsed);
    if (!moment) {
      finish();
      return;
    }
    const next = stageScale();
    if (next !== scale) {
      scale = next;
      canvas.style.width = `${STAGE.w * scale}px`;
      canvas.style.height = `${STAGE.h * scale}px`;
      text.style.fontSize = `${scale >= 5 ? 33 : scale >= 3 ? 22 : 16}px`;
    }
    const alpha = panelAlpha(moment.panel, moment.localMs);
    if (ctx) {
      const time = { localMs: moment.localMs, progress: moment.localMs / moment.panel.durationMs, sheets: options.sheets() };
      const camera = cameraAt(moment.panel, moment.localMs);
      if (options.draw) options.draw(ctx, moment.panel, time, camera, alpha);
      else drawPrologue(ctx, moment.panel.scene as PrologueScene, time, camera, alpha);
    }
    renderText(moment.index, moment.localMs, alpha);
    const canSkip = skipAvailable(elapsed);
    skip.classList.toggle('is-visible', canSkip);
    hint.classList.toggle('is-visible', canSkip);
    hold.style.width = `${holdProgress(pressedAt, now) * 100}%`;
    requestAnimationFrame(frame);
  };
  // The first frame draws as soon as the caller has put the screen on the page (no black flash).
  queueMicrotask(() => frame(performance.now()));
  return element;
}
