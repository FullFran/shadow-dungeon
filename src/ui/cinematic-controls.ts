import { trackLastDevice, type LastDevice } from '../adapters/last-device';
import { glyphSvg } from '../app/gamepad-pad';
import { initialStyle } from '../app/gamepad-help';
import { t } from '../i18n';
import { buttonHoldProgress, createWake, ringFill, skipKeyGlyph } from './cinematic-controls-model';
import { pixelSvgOf, type PixelIcon } from './pixel-icons';
import { h } from './window';
import '../styles/cinematic-controls.css';

/**
 * The controls every cinematic shares (.agents/DESIGN.md §4 Cinematic controls;
 * owner 2026-11-04 "los botones de saltar y el badge de auto ... un pelín más
 * grandes y rediséñalos"): a stack in the bottom-right corner with the Auto
 * pill above the Skip relic button. Skip is held (a ring fills round its icon)
 * so a stray click cannot cut a scene; its label carries the glyph of the
 * device used last. Quiet at rest, full on any input, quiet again after 2 s.
 * One player (src/app/prologue.ts) builds them for the prologue, the
 * guardians, the Sima, the Sendas, the heralds and the gallery replays.
 */

const BONE = '#efe6d6';
const GOLD = '#c9a45a';
const SHADE = '#5c4526';
const EMBER = '#ffbf5e';

/** Double chevron: the first one bone, the second old gold. */
const SKIP_ICON: PixelIcon = {
  palette: { B: BONE, g: GOLD, s: SHADE },
  rows: [
    '................',
    '................',
    '................',
    '..BB....gg......',
    '...BB....gg.....',
    '....BB....gg....',
    '.....BB....gg...',
    '......BB....gg..',
    '......BB....gg..',
    '.....BB....gg...',
    '....BB....gg....',
    '...BB....gg.....',
    '..BB....gg......',
    '................',
    '................',
    '................',
  ],
};

/** Play triangle for the automatic reading. */
const AUTO_ICON: PixelIcon = {
  palette: { B: BONE, g: EMBER, s: SHADE },
  rows: [
    '................',
    '................',
    '................',
    '...Bg...........',
    '...Bggg.........',
    '...Bggggg.......',
    '...Bgggggggs....',
    '...Bggggggggs...',
    '...Bgggggggs....',
    '...Bggggg.......',
    '...Bggg.........',
    '...Bg...........',
    '................',
    '................',
    '................',
    '................',
  ],
};

export interface CinematicControlsOptions {
  /** Automatic reading is on. */
  auto: boolean;
  /** The Auto pill was pressed; the new value. */
  onAuto(next: boolean): void;
  /** The Skip button was held for `CONTROLS.buttonHoldMs`, or activated without a pointer (a screen reader). */
  onSkip(): void;
}

export interface CinematicControls {
  element: HTMLElement;
  skipButton: HTMLButtonElement;
  setAuto(on: boolean): void;
  /** Once a frame: whether Skip counts yet, and how far a held skip key has got (0..1). */
  update(nowMs: number, available: boolean, keyProgress: number): void;
  dispose(): void;
}

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const RING_R = 17;

function ringSvg(): { svg: SVGSVGElement; arc: SVGCircleElement } {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('class', 'cine-ring');
  svg.setAttribute('aria-hidden', 'true');
  const circle = (cls: string) => {
    const c = document.createElementNS(ns, 'circle');
    c.setAttribute('cx', '20');
    c.setAttribute('cy', '20');
    c.setAttribute('r', String(RING_R));
    c.setAttribute('pathLength', '100');
    c.setAttribute('class', cls);
    return c;
  };
  const arc = circle('cine-ring-arc');
  arc.setAttribute('stroke-dasharray', '100');
  arc.setAttribute('stroke-dashoffset', '100');
  svg.append(circle('cine-ring-track'), arc);
  return { svg, arc };
}

export function mountCinematicControls(options: CinematicControlsOptions): CinematicControls {
  const reduced = reducedMotion();
  const wake = createWake();
  const device = trackLastDevice();
  let auto = options.auto;
  let pressedAt: number | null = null;
  let shownGlyph: string | null = null;
  let skipped = false;

  // Auto pill: a play icon, the word and an ember dot that breathes while it is on.
  const dot = h('span', { className: 'cine-dot' });
  dot.setAttribute('aria-hidden', 'true');
  const autoButton = h('button', { className: 'cine-auto', type: 'button' }, [pixelSvgOf(AUTO_ICON, 'px-icon'), h('span', { className: 'cine-label', textContent: t('cinematic.auto') }), dot]);
  const showAuto = () => {
    autoButton.classList.toggle('is-on', auto);
    autoButton.setAttribute('aria-pressed', String(auto));
    autoButton.title = t(auto ? 'cinematic.auto.on' : 'cinematic.auto.off');
  };
  showAuto();
  autoButton.addEventListener('click', (e) => {
    e.stopPropagation();
    auto = !auto;
    showAuto();
    options.onAuto(auto);
  });

  // Skip relic button: ring + double chevron, "Saltar" and the device glyph.
  const { svg: ring, arc } = ringSvg();
  const icon = h('span', { className: 'cine-icon' }, [ring, pixelSvgOf(SKIP_ICON, 'px-icon')]);
  const glyph = h('span', { className: 'cine-glyph' });
  const skipButton = h('button', { className: 'cine-skip', type: 'button' }, [icon, h('span', { className: 'cine-label', textContent: t('prologue.skip') }), glyph]);
  skipButton.title = t('cinematic.skip.hold');
  skipButton.setAttribute('aria-description', t('cinematic.skip.hold'));

  const element = h('div', { className: 'cine-controls' }, [autoButton, skipButton]);

  const release = () => {
    pressedAt = null;
  };
  skipButton.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || skipButton.classList.contains('is-locked')) return;
    pressedAt = performance.now();
    try {
      skipButton.setPointerCapture(e.pointerId);
    } catch {
      // A synthetic pointer: the button's own events are enough.
    }
  });
  skipButton.addEventListener('pointerup', release);
  skipButton.addEventListener('pointercancel', release);
  skipButton.addEventListener('lostpointercapture', release);
  // A click with no pointer (detail 0: a screen reader or switch activates the button) skips at once; a mouse or finger must hold.
  skipButton.addEventListener('click', (e) => {
    if (e.detail === 0 && !skipButton.classList.contains('is-locked') && !skipped) {
      skipped = true;
      options.onSkip();
    }
  });

  const onInput = () => wake.wake(performance.now());
  element.addEventListener('pointerenter', onInput);
  element.addEventListener('pointermove', onInput);
  element.addEventListener('focusin', onInput);
  window.addEventListener('pointermove', onInput, true);
  window.addEventListener('pointerdown', onInput, true);
  window.addEventListener('keydown', onInput, true);

  const showGlyph = (current: LastDevice) => {
    const kind = skipKeyGlyph(current);
    const key = kind === 'pad' ? `pad:${initialStyle()}` : kind;
    if (key === shownGlyph) return;
    shownGlyph = key;
    if (kind === 'pad') glyph.replaceChildren(glyphSvg('b', initialStyle()));
    else glyph.replaceChildren(h('kbd', { textContent: kind === 'esc' ? 'Esc' : t('cinematic.skip.holdKey') }));
    glyph.dataset.kind = kind;
  };
  showGlyph(device.current());

  return {
    element,
    skipButton,
    setAuto(on) {
      auto = on;
      showAuto();
    },
    update(nowMs, available, keyProgress) {
      device.poll();
      showGlyph(device.current());
      if (available && !element.classList.contains('is-available')) wake.wake(nowMs);
      element.classList.toggle('is-available', available);
      skipButton.classList.toggle('is-locked', !available);
      element.classList.toggle('is-awake', available && (wake.awake(nowMs) || pressedAt !== null || keyProgress > 0));
      const button = buttonHoldProgress(pressedAt, performance.now());
      const progress = Math.max(button, keyProgress);
      skipButton.classList.toggle('is-holding', progress > 0);
      arc.setAttribute('stroke-dashoffset', String(100 - ringFill(progress, reduced) * 100));
      if (button >= 1 && !skipped) {
        skipped = true;
        options.onSkip();
      }
    },
    dispose() {
      device.dispose();
      window.removeEventListener('pointermove', onInput, true);
      window.removeEventListener('pointerdown', onInput, true);
      window.removeEventListener('keydown', onInput, true);
    },
  };
}
