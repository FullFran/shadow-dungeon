import { PLACE_ICONS } from './icons/place-icons';
import { primaryPointerIsFinger } from '../adapters/touch-mode';
import { hudScaleFor } from './hud-layout';
import { plaqueMaxWidth, plaqueMetrics, plaqueTiming, type Plaque, type PlaqueTiming } from './location-plaque-model';
import { PIXEL_ICONS, pixelSvgOf, type PixelIcon } from './pixel-icons';
import '../styles/location-plaque.css';

/**
 * The location plaque (.agents/DESIGN.md §4 "Location plaque"): a carved relic plate at the top centre that names the place
 * you just entered (a town map, a dungeon floor, a boss arena, a Sima stratum, the shrine). It unfurls from its centre, its
 * icon and text rise in turn, it holds about two seconds and leaves upward. Reason for the motion: it marks the change of
 * place without blocking play (Peak-End, Selective Attention). It never takes input, sits clear of the HUD corners and fades
 * plainly under prefers-reduced-motion. The model is pure (location-plaque-model.ts); this is the DOM.
 */
export interface LocationPlaque {
  /** Shows a place; one already on screen is replaced (the newest place wins). */
  show(plaque: Plaque): void;
  /** Takes it off at once (a window opened over play, the run ended). */
  hide(): void;
  /** Whether a place is on screen now (the card clock's tip waits for it: they share the top of a phone). */
  showing(): boolean;
  dispose(): void;
}

const iconOf = (id: string): PixelIcon => (PLACE_ICONS as Record<string, PixelIcon>)[id] ?? (PIXEL_ICONS as Record<string, PixelIcon>)[id] ?? PIXEL_ICONS.dungeons;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const reducedMotion = (): boolean => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const msVars = (timing: PlaqueTiming): Record<string, string> => ({
  '--lp-unfurl': `${timing.unfurlMs}ms`,
  '--lp-rise': `${timing.riseMs}ms`,
  '--lp-icon-delay': `${timing.iconDelayMs}ms`,
  '--lp-text-delay': `${timing.textDelayMs}ms`,
  '--lp-in': `${timing.inMs}ms`,
  '--lp-out': `${timing.outMs}ms`,
});

/** Short landscape windows and upright phones keep the small plaque of the stylesheet; desktop sizes follow the HUD scale rule. */
const SHORT_WINDOW = 520;

function applySize(root: HTMLElement): void {
  const names = ['--lp-name-size', '--lp-sub-size', '--lp-note-size', '--lp-icon-size', '--lp-frame-size', '--lp-max', '--lp-note-display'];
  // A phone held upright shows the play view as a small landscape band (src/adapters/viewport.ts): the small plaque too.
  const uprightPhone = window.innerHeight > window.innerWidth && primaryPointerIsFinger(window.matchMedia?.bind(window));
  if (window.innerHeight <= SHORT_WINDOW || uprightPhone) {
    for (const name of names) root.style.removeProperty(name);
    return;
  }
  const scale = hudScaleFor(window.innerWidth, window.innerHeight, 1, false);
  const m = plaqueMetrics(scale, false);
  const values = [m.name, m.sub, m.note, m.icon, m.frame, plaqueMaxWidth(window.innerWidth, window.innerHeight, scale, false)];
  root.style.setProperty('--lp-note-display', m.note > 0 ? 'block' : 'none');
  values.forEach((value, i) => root.style.setProperty(names[i]!, `${value}px`));
}

export function mountLocationPlaque(parent: HTMLElement): LocationPlaque {
  const root = el('div', 'lp');
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.hidden = true;
  parent.append(root);
  let timers: number[] = [];

  const clear = (): void => {
    for (const id of timers) window.clearTimeout(id);
    timers = [];
  };
  const hide = (): void => {
    clear();
    root.hidden = true;
    root.classList.remove('is-out');
    root.replaceChildren();
  };

  return {
    show(plaque) {
      clear();
      const timing = plaqueTiming(reducedMotion());
      const text = el('div', 'lp-text', undefined);
      text.append(el('div', 'lp-name', plaque.name), el('div', 'lp-rule'));
      if (plaque.subtitle) text.append(el('div', 'lp-sub', plaque.subtitle));
      if (plaque.note) text.append(el('div', 'lp-note', plaque.note));
      const icon = el('span', 'lp-icon');
      icon.append(pixelSvgOf(iconOf(plaque.icon), 'lp-icon-art'));
      const plate = el('div', 'lp-plate');
      plate.append(el('span', 'lp-cap lp-cap-l'), el('div', 'lp-body'), el('span', 'lp-cap lp-cap-r'));
      plate.children[1]!.append(icon, text);
      root.replaceChildren(plate);
      root.className = `lp lp-${plaque.variant}`;
      root.dataset.motion = timing.motion;
      applySize(root);
      for (const [name, value] of Object.entries(msVars(timing))) root.style.setProperty(name, value);
      // Restart the animations of a plaque that replaces another.
      root.hidden = false;
      void root.offsetWidth;
      timers.push(
        window.setTimeout(() => root.classList.add('is-out'), timing.inMs + timing.holdMs),
        window.setTimeout(hide, timing.totalMs),
      );
    },
    hide,
    showing: () => !root.hidden,
    dispose() {
      hide();
      root.remove();
    },
  };
}
