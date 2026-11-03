import type { SheetStore } from '../adapters/assets';
import { FxDirector } from '../adapters/fx/director';
import { sharedFxStore } from '../adapters/fx/store';
import { FxSystem } from '../adapters/fx/system';
import { applyEvents, initialJuice, tickJuice, type JuiceState } from '../adapters/juice';
import { createRenderer, type Renderer } from '../adapters/renderer';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';
import { pixelIconSvg } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { createFrameLoop, createPreviewSim, PREVIEW, type FrameLoop, type PreviewSim } from './move-preview';

/**
 * The preview's canvas: the game's renderer on the preview sim (move-preview.ts), one at a time.
 * It runs only while it is on screen (the window open, the tab visible, the canvas in view),
 * stops for good on `dispose`, and under `prefers-reduced-motion` shows one still frame until
 * the player presses play. No input, audio, save or achievements reach it.
 */
export interface MovePreview {
  element: HTMLElement;
  /** Shows `move` cast by `species` at its owned `rank`; a move that cannot be set up shows its static note. */
  show(species: SpeciesId, move: MoveId, rank: number): void;
  /** Whether a frame loop is running (for the leak check). */
  running(): boolean;
  /** Median and 95th percentile of the work done per frame (sim + draw), in ms, over the last frames. */
  cost(): { median: number; p95: number; frames: number };
  dispose(): void;
}

const SCALE = 2;
/** The camera's height range in world pixels: the canvas follows its box, within what the room can show. */
const MIN_VIEW_H = 84;
const MAX_VIEW_H = 190;
const viewHeightFor = (aspect: number): number => Math.round(Math.min(MAX_VIEW_H, Math.max(MIN_VIEW_H, PREVIEW.view.width / aspect)));
/** Frames kept for the cost readout. */
const COST_FRAMES = 240;

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createMovePreview(options: { sheets?: Promise<SheetStore> }): MovePreview {
  const canvas = h('canvas', { className: 'tu-preview-canvas' });
  let view: { x: number; y: number; width: number; height: number } = { ...PREVIEW.view };
  const fit = (aspect: number): void => {
    const height = viewHeightFor(aspect);
    if (height === view.height) return;
    view = { x: PREVIEW.view.x, y: Math.round(PREVIEW.centre.y - height / 2), width: PREVIEW.view.width, height };
    canvas.height = height * SCALE;
  };
  canvas.width = PREVIEW.view.width * SCALE;
  canvas.height = PREVIEW.view.height * SCALE;
  canvas.setAttribute('role', 'img');
  const note = h('p', { className: 'tu-preview-note' });
  const play = h('button', { className: 'tu-preview-play', type: 'button' }, [pixelIconSvg('play', 'px-icon'), h('span', { textContent: t('tutor.preview.play') })]);
  const element = h('div', { className: 'tu-preview' }, [canvas, note, play]);

  let renderer: Renderer | null = null;
  let fx: FxSystem | null = null;
  let director: FxDirector | null = null;
  let sim: PreviewSim | null = null;
  let juice: JuiceState = initialJuice();
  let realMs = 0;
  let disposed = false;
  /** The element has been on the page at least once. */
  let attached = false;
  /** Still frame under reduced motion until the player asks for the loop. */
  let stillOnly = false;
  /** The element is on screen and the page is visible. */
  let seen = true;
  const costs: number[] = [];

  const draw = (): void => {
    if (!sim || !renderer) return;
    renderer.draw({
      bare: true,
      ...(fx ? { fx } : {}),
      prev: sim.prev,
      current: sim.world,
      alpha: sim.alpha,
      juice,
      view,
      pixelScale: SCALE,
      floor: 1,
      exit: null,
      exitOpen: false,
      timeMs: realMs,
      sinceHurtMs: Number.POSITIVE_INFINITY,
      defeatedAt: new Map(),
      moving: false,
      hoverId: null,
      card: null,
      rumble: 0,
      minimap: null,
    });
  };

  const frame = (ms: number): void => {
    // The screen was replaced without telling us (a menu swaps its whole page): stop for good.
    if (element.isConnected) attached = true;
    else if (attached) return api.dispose();
    if (!sim) return;
    const t0 = performance.now();
    const events = sim.advance(ms);
    juice = tickJuice(applyEvents(juice, events, sim.world.player.pos), ms);
    director?.handleEvents(events, sim.world.player);
    realMs += ms;
    if (fx && director) {
      fx.store.tick(realMs);
      fx.update(ms);
      director.observe(sim.world, realMs);
    }
    draw();
    costs.push(performance.now() - t0);
    if (costs.length > COST_FRAMES) costs.shift();
  };

  const loop: FrameLoop = createFrameLoop({ raf: (cb) => requestAnimationFrame(cb), caf: (id) => cancelAnimationFrame(id) }, frame);

  /** Runs or stops the loop to match what is on screen right now. */
  const sync = (): void => {
    const go = !disposed && sim !== null && renderer !== null && seen && !stillOnly && document.visibilityState !== 'hidden';
    if (go) loop.start();
    else loop.stop();
  };

  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver((entries) => {
    seen = entries[entries.length - 1]?.isIntersecting ?? true;
    sync();
  }) : null;
  observer?.observe(element);
  const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      fit(box.width / box.height);
      draw();
    }
  }) : null;
  resizer?.observe(element);
  const onVisibility = (): void => sync();
  document.addEventListener('visibilitychange', onVisibility);

  play.addEventListener('click', () => {
    stillOnly = false;
    element.classList.remove('is-still');
    sync();
  });

  /** A representative frame for the still: run the sim to its first hit (or the cast) and draw once. */
  const still = (): void => {
    if (!sim) return;
    let stepped = 0;
    let hit = false;
    while (!hit && stepped < 90) {
      hit = sim.advance(1000 / 60).some((e) => e.type === 'enemyHit');
      stepped += 1;
    }
    for (let i = 0; i < 6; i++) frame(1000 / 60);
    draw();
  };

  void options.sheets?.then((sheets) => {
    if (disposed) return;
    renderer = createRenderer(canvas, sheets);
    fx = new FxSystem(sharedFxStore());
    director = new FxDirector(fx);
    if (sim) director.prepare(sim.world.player.loadout);
    if (stillOnly) still();
    sync();
  });

  const api: MovePreview = {
    element,
    show(species, move, rank) {
      sim = createPreviewSim(species, move, rank);
      juice = initialJuice();
      director?.reset();
      if (sim) director?.prepare(sim.world.player.loadout);
      element.classList.toggle('is-static', sim === null);
      canvas.setAttribute('aria-label', t('tutor.preview.label').replace('{move}', t(`move.${move}`)));
      note.textContent = sim ? '' : t('tutor.preview.none');
      stillOnly = sim !== null && reducedMotion();
      element.classList.toggle('is-still', stillOnly);
      if (stillOnly && renderer) still();
      sync();
    },
    running: () => loop.running,
    cost() {
      const sorted = [...costs].sort((a, b) => a - b);
      const at = (q: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? 0;
      return { median: at(0.5), p95: at(0.95), frames: sorted.length };
    },
    dispose() {
      disposed = true;
      loop.stop();
      observer?.disconnect();
      resizer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      sim = null;
    },
  };
  // Development server only: the per-frame cost readout and the running flag, for the frame-cost and leak checks.
  if (import.meta.env.DEV) Object.assign(globalThis, { __mzPreview: { cost: () => api.cost(), running: () => api.running() } });
  return api;
}
