import { FULLSCREEN_KEY } from '../adapters/bindings';
import { trackLastDevice } from '../adapters/last-device';
import { glyphSvg } from '../app/gamepad-pad';
import type { PadStyle } from '../app/gamepad-help-data';
import { t } from '../i18n';
import { isFullscreen, toggleFullscreen } from './fullscreen';
import { createHintFade, hintSignature, hintsFor, type Hint, type HintContext, type HintPlace } from './play-hints-model';
import { PIXEL_ICONS, pixelSvgOf } from './pixel-icons';
import '../styles/credits-controls.css';
import '../styles/play-hints.css';

/**
 * The in-game hint bar (.agents/DESIGN.md §4): a relic chip row along the bottom edge with the controls available
 * right now, in the glyphs of the device used last. The model is pure (play-hints-model.ts); this is the DOM:
 * it rebuilds only when the context changes, fades after `HINT_HOLD_MS` without a change (no animation under
 * prefers-reduced-motion), steps back to a glyph-only row when the free stretch of the bottom edge is narrow, and
 * carries the fullscreen toggle (F11 and Alt+Enter work too; F is the area slot).
 */
export interface PlayHintState {
  place: HintPlace;
  interact: HintContext['interact'];
  minimap: boolean;
  spectating: boolean;
  /** A window, a dialog or a cinematic is on screen: the bar stays out of its way. */
  suppressed: boolean;
  /** The free stretch of the bottom edge, in CSS px from the left, the right and the bottom. */
  band: { left: number; right: number; bottom: number };
}

export interface PlayHints {
  /** Once a frame. */
  update(state: PlayHintState, nowMs: number): void;
  dispose(): void;
}

export interface PlayHintsOptions {
  /** The settings switch, read live. */
  enabled(): boolean;
  padStyle?(): PadStyle;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, children: (Node | string)[] = []): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  node.append(...children);
  return node;
};

function itemOf(hint: Hint, style: PadStyle): HTMLElement {
  const glyphs = el(
    'span',
    'ph-glyphs',
    hint.glyphs.map((g) => (g.kind === 'pad' ? glyphSvg(g.id, style) : el('kbd', 'ph-key', [g.label]))),
  );
  const item = el('li', hint.id === 'interact' ? 'ph-item is-interact' : 'ph-item', [glyphs, el('span', 'ph-label', [t(hint.labelKey)])]);
  item.dataset.hint = hint.id;
  return item;
}

export function mountPlayHints(parent: HTMLElement, options: PlayHintsOptions): PlayHints {
  const tracker = trackLastDevice();
  const fade = createHintFade();
  const list = el('ul', 'ph-list');
  const fullscreen = el('button', 'ph-fs');
  // Never reached by Tab (Tab is the minimap) nor left focused (Space is the roll): a mouse button, with F11 and Alt+Enter for the keys.
  fullscreen.type = 'button';
  fullscreen.tabIndex = -1;
  fullscreen.append(pixelSvgOf(PIXEL_ICONS.fullscreen, 'ph-fs-icon'));
  const bar = el('div', 'ph', [list, fullscreen]);
  bar.setAttribute('role', 'group');
  parent.append(bar);

  let signature = '';
  let hints: Hint[] = [];
  let style: PadStyle = 'xbox';
  let band = '';
  let fit = true;
  let on = false;
  let suppressed = false;
  let showButton = true;
  let language = '';
  let pressed = false;

  const setLabel = (): void => {
    const label = t(pressed ? 'hint.fullscreen.exit' : 'hint.fullscreen.enter');
    fullscreen.setAttribute('aria-label', `${label} (${FULLSCREEN_KEY})`);
    fullscreen.title = `${label} (${FULLSCREEN_KEY})`;
    fullscreen.setAttribute('aria-pressed', String(pressed));
  };
  const syncPressed = (): void => {
    pressed = isFullscreen();
    setLabel();
  };
  const press = (): void => void toggleFullscreen().then(syncPressed);
  fullscreen.addEventListener('click', () => {
    fullscreen.blur();
    press();
  });
  fullscreen.addEventListener('mousedown', (e) => e.stopPropagation());
  const onKey = (e: KeyboardEvent): void => {
    if (e.repeat || !(e.code === FULLSCREEN_KEY || (e.altKey && (e.code === 'Enter' || e.code === 'NumpadEnter')))) return;
    // Before the town's own Enter (which would talk) and the browser's F11.
    e.preventDefault();
    press();
  };
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('fullscreenchange', syncPressed);
  syncPressed();

  /**
   * Glyphs and labels fit the free stretch, or the labels of the self-evident keys (move, attack) step back, or all
   * labels do, or the row hides (the button stays if it fits).
   */
  const fitBar = (): void => {
    bar.classList.remove('trim', 'compact', 'too-narrow');
    const room = bar.clientWidth - (showButton ? fullscreen.offsetWidth + 8 : 0);
    for (const step of ['trim', 'compact', 'too-narrow']) {
      if (list.offsetWidth <= room) break;
      bar.classList.add(step);
    }
  };

  return {
    update(state, nowMs) {
      tracker.poll();
      const ctx: HintContext = { device: tracker.current(), place: state.place, interact: state.interact, minimap: state.minimap, spectating: state.spectating, padStyle: options.padStyle?.() ?? 'xbox' };
      const next = hintsFor(ctx);
      const sig = hintSignature(ctx, next);
      const lang = t('hint.bar');
      if (sig !== signature || lang !== language) {
        signature = sig;
        language = lang;
        hints = next;
        style = ctx.padStyle;
        list.replaceChildren(...hints.map((hint) => itemOf(hint, style)));
        bar.setAttribute('aria-label', lang);
        setLabel();
        fit = true;
      }
      if (sig !== '') fade.touch(sig, nowMs);
      const key = `${state.band.left}|${state.band.right}|${state.band.bottom}`;
      if (key !== band) {
        band = key;
        bar.style.setProperty('--ph-left', `${state.band.left}px`);
        bar.style.setProperty('--ph-right', `${state.band.right}px`);
        bar.style.setProperty('--ph-bottom', `${state.band.bottom}px`);
        fit = true;
      }
      const wantButton = ctx.device !== 'touch' && options.enabled();
      if (wantButton !== showButton) {
        showButton = wantButton;
        fullscreen.hidden = !wantButton;
        fit = true;
      }
      const shown = options.enabled() && !state.suppressed && hints.length > 0 && (fade.visible(nowMs) || state.interact !== null);
      if (shown !== on) {
        on = shown;
        bar.classList.toggle('is-on', on);
      }
      if (state.suppressed !== suppressed) {
        suppressed = state.suppressed;
        bar.classList.toggle('is-suppressed', suppressed);
      }
      if (fit) {
        fit = false;
        fitBar();
      }
    },
    dispose() {
      tracker.dispose();
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', syncPressed);
      bar.remove();
    },
  };
}
