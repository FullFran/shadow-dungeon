import type { SheetStore } from '../adapters/assets';
import { trackLastDevice, type LastDevice } from '../adapters/last-device';
import { keyLabel } from '../adapters/bindings';
import { cursorList } from '../ui/cursor-list';
import { PAUSE_ICONS } from '../ui/icons/pause-icons';
import { pixelSvgOf, type PixelIcon } from '../ui/pixel-icons';
import { h, mdWindow, type Child } from '../ui/window';
import { countAt, countParts, endTimeline, isLive, type EndTimeline } from './end-choreography';
import { endIconOf, endLayout, tileSpans, type EndRewards } from './end-layout';
import type { EndActionId, EndCard, EndLine, EndView } from './end-model';
import { glyphSvg } from './gamepad-pad';
import { initialStyle } from './gamepad-help';
import type { PadStyle } from './gamepad-help-data';
import { portrait } from './loadout';
import '../styles/end-screen.css';

/**
 * The relic end screen shared by every win and loss (owner, 2026-11-04: "hazlo más estilo juego, más grande y más visual"), a
 * result ceremony over the dimmed frozen run: a huge outcome title with a gilt rule, the creature large on a carved pedestal
 * (embers and a light cone on a win, ash on a loss), stat tiles with pixel icons, a new-best seal, a rewards row that counts up
 * and big relic buttons with the device glyphs. The model is `end-layout.ts`, the entrance `end-choreography.ts`: every beat is
 * skippable by any key or click, buttons answer within 1.2 s, reduced motion shows the final state at once. Only the Sima's
 * cards scroll inside; the page never does. Arrows or WASD move between the actions, Enter confirms, Esc takes the primary one.
 */
export interface EndScreenOptions {
  view: EndView;
  sheets?: Promise<SheetStore>;
  onAction(id: EndActionId): void;
  /** Tests and screenshots: force reduced motion (default: the user's setting). */
  reduced?: boolean;
  /** The device of the glyphs (default: the pad if it was touched, else the keyboard). */
  device?: () => LastDevice;
  padStyle?: () => PadStyle;
}

const icon = (def: PixelIcon, className: string): SVGSVGElement => pixelSvgOf(def, `px-icon ${className}`);

function lineIcon(line: EndLine, className: string): Node | null {
  return line.icon ? icon(endIconOf(line.icon), className) : null;
}

function tileEl(line: EndLine, at: number, span: number): HTMLElement {
  const value = h('span', { className: `rs-tile-value${line.value === '✓' ? ' is-mark' : ''}${line.value.length > 7 ? ' is-long' : ''}`, textContent: line.value });
  const delta = line.delta ? h('span', { className: `rs-delta is-${line.delta.tone}`, textContent: line.delta.text }) : null;
  if (delta && line.delta) {
    delta.title = line.delta.caption;
    delta.setAttribute('aria-label', line.delta.caption);
  }
  const tile = h('div', { className: `rs-tile${line.tone ? ` is-${line.tone}` : ''}` }, [
    h('span', { className: 'rs-tile-head' }, [lineIcon(line, 'rs-ico'), h('span', { className: 'rs-tile-label', textContent: line.label })]),
    h('span', { className: 'rs-tile-row' }, [value, delta]),
  ]);
  tile.style.setProperty('--at', `${at}ms`);
  tile.style.gridColumn = `span ${span}`;
  return tile;
}

function detailEl(line: EndLine, at: number): HTMLElement {
  const el = h('div', { className: 'rs-detail' }, [
    h('span', { className: 'rs-detail-icon' }, [lineIcon(line, 'rs-ico')]),
    h('span', { className: 'rs-detail-label', textContent: line.label }),
    h('span', { className: 'rs-detail-value', textContent: line.value }),
  ]);
  el.style.setProperty('--at', `${at}ms`);
  return el;
}

/** The headline figure; its number counts up (`set` is called every frame until the end). */
function countFigure(line: EndLine): { el: HTMLElement; set(n: number): void; amount: number } {
  const parts = line.amount !== undefined ? countParts(line.value, line.amount) : null;
  const num = h('span', { className: 'rs-count-num', textContent: line.amount !== undefined ? String(line.amount) : '' });
  const el = parts ? h('span', { className: 'rs-reward-value' }, [parts[0], num, parts[1]]) : h('span', { className: 'rs-reward-value', textContent: line.value });
  return { el, set: (n) => void (num.textContent = String(n)), amount: parts && line.amount !== undefined ? line.amount : 0 };
}

function rewardsEl(reward: EndRewards, at: number, counter: { figure: ReturnType<typeof countFigure> | null }): HTMLElement {
  const hero = reward.hero;
  const figure = hero ? countFigure(hero) : null;
  counter.figure = figure;
  const heroEl = hero
    ? h('div', { className: 'rs-reward-hero' }, [
        h('span', { className: 'rs-reward-coin' }, [lineIcon(hero, 'rs-ico-big')]),
        h('div', { className: 'rs-reward-text' }, [h('span', { className: 'rs-reward-label', textContent: hero.label === reward.title ? hero.label : `${reward.title} · ${hero.label}` }), figure!.el]),
      ])
    : null;
  const balance = reward.balance
    ? h('div', { className: 'rs-reward-balance' }, [lineIcon(reward.balance, 'rs-ico-small'), h('span', { className: 'rs-reward-label', textContent: reward.balance.label }), h('span', { className: 'rs-reward-value-small', textContent: reward.balance.value })])
    : null;
  const rows = reward.rows.map((row) => h('span', { className: 'rs-chip' }, [lineIcon(row, 'rs-ico-small'), h('span', { className: 'rs-chip-label', textContent: row.label }), h('span', { className: 'rs-chip-value', textContent: row.value })]));
  const el = h('section', { className: 'rs-rewards' }, [
    h('div', { className: 'rs-reward-body' }, [h('div', { className: 'rs-reward-main' }, [heroEl, balance]), rows.length > 0 ? h('div', { className: 'rs-chips' }, rows) : null]),
  ]);
  el.style.setProperty('--at', `${at}ms`);
  return el;
}

function cardEl(card: EndCard, at: number): HTMLElement {
  const el = h('section', { className: `rs-card rs-card-${card.id}` }, [
    h('h3', { className: 'rs-section-title', textContent: card.title }),
    ...card.lines.map((line) => h('div', { className: 'rs-row' }, [lineIcon(line, 'rs-ico-small'), h('span', { className: 'rs-row-label', textContent: line.label }), h('span', { className: 'rs-row-value', textContent: line.value })])),
    ...(card.notes ?? []).map((note) => h('p', { className: 'rs-note', textContent: note })),
  ]);
  el.dataset.card = card.id;
  el.style.setProperty('--at', `${at}ms`);
  return el;
}

/** Deterministic spread of the particles (embers rise on a win, ash falls on a loss): same every time, no random flicker between renders. */
function particles(count: number): HTMLElement {
  const box = h('div', { className: 'rs-particles' });
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = h('span', { className: 'rs-particle' });
    p.style.setProperty('--x', `${6 + ((i * 37) % 88)}%`);
    p.style.setProperty('--s', `${3 + ((i * 5) % 4)}px`);
    p.style.setProperty('--t', `${2.8 + ((i * 7) % 5) * 0.5}s`);
    p.style.setProperty('--d', `${-((i * 53) % 30) / 10}s`);
    box.append(p);
  }
  return box;
}

/** The glyphs of the keys (or pad buttons) that press the primary: Enter or A to confirm, Esc or B to go back. None on touch. */
function glyphs(device: LastDevice, style: PadStyle, keys: string[], pad: string[]): HTMLElement | null {
  if (device === 'touch') return null;
  const parts = device === 'gamepad' ? pad.map((b) => glyphSvg(b, style)) : keys.map((k) => h('kbd', { className: 'rs-key', textContent: keyLabel(k) }));
  return h('span', { className: 'rs-glyphs' }, parts);
}

const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function currentDevice(): LastDevice {
  const tracker = trackLastDevice();
  tracker.poll();
  const device = tracker.current();
  tracker.dispose();
  return device;
}

export function endScreen(options: EndScreenOptions): HTMLElement {
  const { view } = options;
  const layout = endLayout(view);
  const reduced = options.reduced ?? reducedMotion();
  const reward = layout.reward?.hero?.amount ?? 0;
  const detailsCount = layout.details.length;
  const timeline: EndTimeline = endTimeline({ tiles: layout.tiles.length + layout.more.length, seal: layout.seal !== null, rewardAmount: reward, reduced });
  const primary = view.actions[0]!;
  const device = options.device?.() ?? currentDevice();
  const style = options.padStyle?.() ?? initialStyle();
  let live = false;
  let skipped = false;
  const counter: { figure: ReturnType<typeof countFigure> | null } = { figure: null };

  const act = (id: EndActionId): void => {
    // A press during the entrance only skips it (Doherty: nothing is lost, nothing fires by accident).
    if (!live) return skip();
    options.onAction(id);
  };
  const actionIcon = (id: EndActionId): PixelIcon => (id === 'retry' ? PAUSE_ICONS.restart : PAUSE_ICONS.quit);
  const list = cursorList({
    items: view.actions.map((a, i) => ({
      label: h('span', { className: 'rs-btn' }, [icon(actionIcon(a.id), 'rs-btn-icon'), h('span', { className: 'rs-btn-label', textContent: a.label }), i === 0 ? glyphs(device, style, ['Enter', 'Escape'], ['a', 'b']) : null]),
      className: i === 0 ? 'rs-primary' : 'rs-quiet',
      onConfirm: () => act(a.id),
    })),
    layout: 'horizontal',
    onBack: () => act(primary.id),
    label: view.title,
    className: 'rs-actions',
  });

  const art = h('div', { className: 'rs-art sprite-box' }, options.sheets ? [portrait(options.sheets, view.species, 3)] : []);
  const seal = layout.seal
    ? h('div', { className: 'rs-seal', role: 'img' }, [icon(endIconOf('crown'), 'rs-seal-icon'), h('span', { className: 'rs-seal-text', textContent: layout.seal })])
    : null;
  seal?.setAttribute('aria-label', layout.seal ?? '');
  const hero = h('div', { className: 'rs-hero' }, [
    h('div', { className: 'rs-cone' }),
    particles(view.outcome === 'victory' ? 14 : view.outcome === 'eclipse' ? 10 : 9),
    h('div', { className: 'rs-pedestal' }, [h('span', { className: 'rs-top' }), h('span', { className: 'rs-step' })]),
    art,
    seal,
  ]);
  hero.style.setProperty('--at', `${timeline.spriteAt}ms`);
  if (seal) seal.style.setProperty('--at', `${timeline.sealAt ?? 0}ms`);

  const head = h('header', { className: 'rs-head' }, [
    h('h1', { className: 'rs-title', textContent: view.title }),
    h('div', { className: 'rs-rule' }, [h('span', { className: 'rs-rule-line' }), h('span', { className: 'rs-rule-gem' }), h('span', { className: 'rs-rule-line' })]),
    ...(view.subtitle ? [h('p', { className: 'rs-sub', textContent: view.subtitle })] : []),
    ...view.notes.map((note) => h('p', { className: 'rs-note', textContent: note })),
  ]);
  head.style.setProperty('--at', `${timeline.titleAt}ms`);

  const all = [...layout.tiles, ...layout.more];
  const spans = tileSpans(all.length);
  const tiles = h('div', { className: 'rs-tiles' }, all.map((line, i) => tileEl(line, timeline.tileAt[i] ?? 0, spans[i] ?? 2)));
  tiles.style.setProperty('--rows', String(all.length === 4 ? 1 : Math.max(1, Math.ceil(all.length / 3))));
  const details = detailsCount > 0 ? h('div', { className: 'rs-details' }, layout.details.map((line) => detailEl(line, timeline.tileAt[all.length - 1] ?? 0))) : null;
  const rewards = layout.reward ? rewardsEl(layout.reward, timeline.rewardsAt ?? 0, counter) : null;
  const cards = layout.cards.length > 0 ? h('div', { className: 'rs-cards' }, layout.cards.map((c) => cardEl(c, timeline.rewardsAt ?? timeline.tileAt[0] ?? 0))) : null;
  const board = h('div', { className: `rs-board${cards ? ' has-cards' : ''}` }, [tiles, details, cards, rewards] as Child[]);

  const foot = h('footer', { className: 'rs-foot' }, [list.element]);
  foot.style.setProperty('--at', `${timeline.actionsAt}ms`);

  const windowEl = mdWindow({ className: `result rs-window ${view.outcome}${layout.seal ? ' has-seal' : ''}${cards ? ' has-cards' : ''}${reduced ? ' is-still' : ''}` }, [head, h('div', { className: `rs-stage${cards ? ' has-cards' : ''}` }, [hero, board]), foot]);
  windowEl.style.setProperty('--rs-count', `${timeline.countMs}ms`);
  if (!reduced) windowEl.classList.add('is-waiting');

  // The entrance. Skipping (or reduced motion) jumps every beat to its final state.
  let frame = 0;
  let timer = 0;
  const cleanup = (): void => {
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('pointerdown', onPointer, true);
    if (frame) cancelAnimationFrame(frame);
    if (timer) window.clearTimeout(timer);
  };
  const goLive = (): void => {
    if (live) return;
    live = true;
    windowEl.classList.remove('is-waiting');
    // Whatever made the screen live (the clock, a back-stop timer, a skip), the figure ends exact.
    counter.figure?.set(counter.figure.amount);
    cleanup();
  };
  function skip(): void {
    if (skipped) return;
    skipped = true;
    windowEl.classList.add('is-skipped');
    counter.figure?.set(counter.figure.amount);
    goLive();
  }
  function onKey(e: KeyboardEvent): void {
    if (!windowEl.isConnected) return cleanup();
    if (e.ctrlKey || e.altKey || e.metaKey || ['F5', 'F11', 'F12'].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    skip();
  }
  function onPointer(e: PointerEvent): void {
    if (!windowEl.isConnected) return cleanup();
    e.preventDefault();
    e.stopImmediatePropagation();
    skip();
  }

  if (reduced) {
    counter.figure?.set(counter.figure.amount);
    live = true;
  } else {
    counter.figure?.set(0);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onPointer, true);
    const start = performance.now();
    const tick = (now: number): void => {
      if (!windowEl.isConnected && now - start > 50) return cleanup();
      const elapsed = now - start;
      if (counter.figure && timeline.rewardsAt !== null) counter.figure.set(countAt(counter.figure.amount, elapsed - timeline.rewardsAt, timeline.countMs));
      if (isLive(timeline, elapsed, skipped)) {
        counter.figure?.set(counter.figure.amount);
        return goLive();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Back-stop for a hidden tab (no frames): the buttons still go live on time.
    timer = window.setTimeout(goLive, timeline.actionsAt);
  }
  return windowEl;
}

/** The dim layer an end screen sits in over the frozen last frame of the run (never over the title's backdrop). */
export function endVeil(window: HTMLElement): HTMLElement {
  return h('div', { className: 'rs-veil' }, [window]);
}
