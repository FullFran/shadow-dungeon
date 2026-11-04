import { ITEMS } from '../data/items';
import type { SpeciesId } from '../data/species';
import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { MAP_ICONS, PAUSE_ICONS } from '../ui/icons/pause-icons';
import { TUTOR_ICONS } from '../ui/icons/tutor-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import type { TilePalette } from '../data/dungeons';
import { legendOf, mapColor, paintPauseMap, planScale, type MapMarker, type PauseMapModel } from './pause-map';
import { h, mdWindow } from '../ui/window';
import { pauseActions, type MenuActions, type PauseAction, type PauseEntry, type PauseSummary } from './pause-model';
import '../styles/sprite-fit.css';
import '../styles/pause.css';

/**
 * The pause menu in the relic look (owner, 2026-11-04; .agents/DESIGN.md §4 "Pause window"): one centred relic
 * window over the dimmed, frozen run. Left, the actions as a vertical list (a 16x16 colour pixel icon, the
 * name, one quiet line; Continuar first and the only ember, quitting last and in the danger colour). Right,
 * the run summary card: the partner whole in its sprite box, dungeon and floor, tier, time, coins, the
 * equipped moves and the held items. Actions that lose progress go through the shared confirm dialog.
 *
 * Keys: Up / Down (or W / S) move, Enter or Space act, Left / Right cross between the list and the held items.
 * Esc and the pad's Start resume (the game owns that key); a click on the veil does nothing, so a stray press
 * never resumes a run that is about to start moving again or reaches a destructive action.
 */

export interface PauseViewOptions {
  actions: MenuActions;
  summary: PauseSummary;
  /** The action the cursor starts on (coming back from the settings or the report form); Continuar by default. */
  initial?: PauseEntry;
  /** Skip the open animation (the menu coming back from the settings). */
  still?: boolean;
  /** The partner's animated portrait; drawn inside the sprite box. Absent: the box stays empty (tests). */
  portrait?(species: SpeciesId): HTMLElement;
  /** The floor plan: the explored tiles and markers, and the dungeon's tileset colours. Absent: the panel says there is none. */
  map?: { model: PauseMapModel; palette: TilePalette } | null;
  onSettings(): void;
  onReport(): void;
  /** Ask the player before an action that loses progress; the shared confirm dialog by default. */
  confirm?(action: PauseAction): Promise<boolean>;
}

export interface PauseView {
  element: HTMLElement;
  /** Puts the cursor on an action (coming back from the settings or the report form). */
  focus(id?: PauseEntry): void;
  dispose(): void;
}

const askConfirm = (action: PauseAction): Promise<boolean> =>
  confirmDialog({ title: t(action.confirm!.titleKey), body: t(action.confirm!.bodyKey), confirmLabel: t(action.confirm!.confirmKey) });

export function pauseView(options: PauseViewOptions): PauseView {
  const { actions, summary } = options;
  const list = pauseActions(actions, t, summary.coop);
  let busy = false;

  // ---- actions
  const rows = list.map((action) => {
    const row = h('button', { type: 'button', className: ['pz-action', action.primary ? 'is-primary' : '', action.danger ? 'is-danger' : ''].filter(Boolean).join(' ') }, [
      h('span', { className: 'pz-action-icon' }, [pixelSvgOf(PAUSE_ICONS[action.id], 'px-icon')]),
      h('span', { className: 'pz-action-text' }, [h('span', { className: 'pz-action-label', textContent: action.label }), h('span', { className: 'pz-action-hint', textContent: action.hint })]),
    ]);
    row.dataset.action = action.id;
    row.setAttribute('role', 'menuitem');
    if (action.disabled) row.setAttribute('aria-disabled', 'true');
    row.addEventListener('click', () => void run(action));
    row.addEventListener('mouseenter', () => row.focus({ preventScroll: true }));
    return row;
  });
  const menu = h('div', { className: 'pz-actions' }, rows);
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', t('pause.title'));

  async function run(action: PauseAction): Promise<void> {
    if (busy || action.disabled) return;
    if (action.confirm) {
      busy = true;
      const ok = await (options.confirm ?? askConfirm)(action);
      busy = false;
      if (!ok) {
        focus(action.id);
        return;
      }
    }
    switch (action.id) {
      case 'resume':
        return actions.resume();
      case 'restart':
        return actions.restart();
      case 'settings':
        return options.onSettings();
      case 'fullscreen':
        actions.toggleFullscreen?.();
        // The change lands a moment later (the browser's event); `fullscreenchange` refreshes the row too.
        return void queueMicrotask(syncFullscreen);
      case 'report':
        return options.onReport();
      case 'copyReport':
        return actions.copyReport?.();
      case 'quit':
        return actions.quit();
    }
  }

  // The fullscreen row says which way it goes: its label follows the page's state.
  function syncFullscreen(): void {
    const next = pauseActions(actions, t, summary.coop).find((a) => a.id === 'fullscreen');
    const row = rows.find((r) => r.dataset.action === 'fullscreen');
    if (!next || !row) return;
    row.querySelector('.pz-action-label')!.textContent = next.label;
    row.querySelector('.pz-action-hint')!.textContent = next.hint;
    row.setAttribute('aria-pressed', String(actions.isFullscreen?.() === true));
  }
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();

  // ---- summary card
  const sprite = h('div', { className: 'pz-sprite sprite-box' }, [options.portrait?.(summary.species)]);
  const stat = (icon: Node | null, label: string, value: string) =>
    h('div', { className: 'pz-stat' }, [icon, h('span', { className: 'pz-stat-label', textContent: label }), h('strong', { className: 'pz-stat-value', textContent: value })]);
  const moveTiles = summary.moves.map((move) =>
    h('li', { className: `pz-move${move.id ? '' : ' is-empty'}` }, [
      pixelSvgOf(TUTOR_ICONS[move.slot]!, 'px-icon'),
      h('span', { className: 'pz-move-text' }, [h('strong', { textContent: move.name }), h('small', { textContent: t(`slot.${move.slot}`) })]),
    ]),
  );
  const detail = h('p', { className: 'pz-detail', textContent: summary.items[0]?.description ?? '' });
  detail.setAttribute('aria-live', 'polite');
  const itemChips = summary.items.map((item) => {
    const chip = h('button', { type: 'button', className: `pz-item rarity-${ITEMS[item.id].rarity}`, textContent: `${item.name}${item.count > 1 ? ` ×${item.count}` : ''}` });
    chip.title = item.description;
    const show = () => (detail.textContent = item.description);
    chip.addEventListener('focus', show);
    chip.addEventListener('mouseenter', show);
    return chip;
  });
  const items =
    summary.items.length === 0
      ? h('p', { className: 'pz-none' }, [pixelIconSvg('seal', 'px-icon'), h('span', { textContent: t('pause.itemsEmpty') })])
      : h('div', { className: 'pz-items-body' }, [h('div', { className: 'pz-chips' }, itemChips), detail]);
  const mapPanel = floorPlan(options.map ?? null, summary.floorLine);
  const card = h('aside', { className: 'pz-card' }, [
    h('div', { className: 'pz-id' }, [
      sprite,
      h('div', { className: 'pz-id-text' }, [h('h3', { className: 'pz-species', textContent: summary.speciesName }), Object.assign(h('p', { className: 'pz-dungeon', textContent: summary.dungeonName }), { title: summary.dungeonName }), h('p', { className: 'pz-floor', textContent: summary.floorLine })]),
    ]),
    h('div', { className: 'pz-stats' }, [
      stat(null, t('pause.stat.difficulty'), summary.difficultyName),
      stat(null, t('pause.stat.time'), summary.time),
      stat(pixelIconSvg('coin', 'px-icon'), t('pause.stat.coins'), t('hud.coins').replace('{coins}', String(summary.coins))),
    ]),
    h('section', { className: 'pz-section' }, [h('h4', { className: 'pz-section-title', textContent: t('pause.moves') }), h('ul', { className: 'pz-moves' }, moveTiles)]),
    h('section', { className: 'pz-section pz-items' }, [h('h4', { className: 'pz-section-title', textContent: t('pause.items') }), items]),
    summary.coop ? h('p', { className: 'pz-coop', textContent: t('pause.coop') }) : null,
  ]);
  card.setAttribute('aria-label', t('pause.summary'));

  const win = mdWindow({ title: t('pause.title'), className: 'pz-window', still: options.still === true }, [h('div', { className: 'pz-body' }, [menu, mapPanel.element, card])]);

  // ---- keys
  const chips = (): HTMLElement[] => itemChips;
  function focus(id: PauseEntry = 'resume'): void {
    (rows.find((row) => row.dataset.action === id) ?? rows[0])?.focus({ preventScroll: true });
  }
  const onKey = (e: KeyboardEvent): void => {
    if (busy || !win.isConnected || e.ctrlKey || e.altKey || e.metaKey) return;
    const target = document.activeElement as HTMLElement | null;
    const inItems = !!target && chips().includes(target);
    const at = target ? rows.indexOf(target as HTMLButtonElement) : -1;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    const step = (set: HTMLElement[], from: number, delta: number) => set[(from + delta + set.length) % set.length]?.focus({ preventScroll: true });
    const down = e.key === 'ArrowDown' || e.code === 'KeyS';
    const up = e.key === 'ArrowUp' || e.code === 'KeyW';
    if (down || up) {
      stop();
      if (inItems) step(chips(), chips().indexOf(target!), down ? 1 : -1);
      else step(rows, at < 0 ? 0 : at, down ? 1 : -1);
    } else if (e.key === 'ArrowRight' || e.code === 'KeyD') {
      if (at >= 0 && chips().length > 0) {
        stop();
        chips()[0]!.focus({ preventScroll: true });
      } else if (inItems) {
        stop();
        step(chips(), chips().indexOf(target!), 1);
      }
    } else if (e.key === 'ArrowLeft' || e.code === 'KeyA') {
      if (inItems) {
        stop();
        const i = chips().indexOf(target!);
        if (i === 0) focus('resume');
        else step(chips(), i, -1);
      }
    } else if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLButtonElement && win.contains(target)) {
      // A pad sends synthetic keys, which never click on their own.
      stop();
      target.click();
    } else if (e.key === 'Tab') {
      const order = [...rows, ...chips()];
      const i = target ? order.indexOf(target) : -1;
      stop();
      step(order, i < 0 ? 0 : i, e.shiftKey ? -1 : 1);
    }
  };
  window.addEventListener('keydown', onKey, true);
  queueMicrotask(() => focus(options.initial));

  return {
    element: win,
    focus,
    dispose: () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      mapPanel.dispose();
    },
  };
}

/**
 * The floor plan panel: the tiles on a canvas painted at the largest whole scale that fits the box (crisp, the
 * whole floor always in view), the markers as pixel icons over it, and a legend of exactly what is shown.
 */
function floorPlan(map: { model: PauseMapModel; palette: TilePalette } | null, floorLine: string): { element: HTMLElement; dispose(): void } {
  const head = h('div', { className: 'pz-map-head' }, [h('h3', { className: 'pz-map-title', textContent: t('pause.map.title') }), h('span', { className: 'pz-map-floor', textContent: floorLine })]);
  const element = h('section', { className: 'pz-map' }, [head]);
  element.setAttribute('aria-label', t('pause.map.title'));
  if (!map) {
    element.append(h('div', { className: 'pz-map-stage' }, [h('p', { className: 'pz-none', textContent: t('pause.map.none') })]));
    return { element, dispose: () => undefined };
  }
  const { model, palette } = map;
  const canvas = h('canvas', { className: 'pz-map-canvas' });
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', t('pause.map.title'));
  const board = h('div', { className: 'pz-map-board' }, [canvas]);
  const stage = h('div', { className: 'pz-map-stage' }, [board]);
  const place = (marker: MapMarker, size: number, scale: number): HTMLElement => {
    const pin = h('span', { className: `pz-marker pz-marker-${marker.kind}` }, [pixelSvgOf(MAP_ICONS[marker.kind], 'px-icon')]);
    pin.style.width = pin.style.height = `${size}px`;
    pin.style.left = `${Math.round(marker.x * scale - size / 2)}px`;
    pin.style.top = `${Math.round(marker.y * scale - size / 2)}px`;
    return pin;
  };
  const markers = (): MapMarker[] => [...model.markers].sort((a, b) => MARKER_ORDER.indexOf(a.kind) - MARKER_ORDER.indexOf(b.kind));
  const draw = (): void => {
    // Layout size, not the bounding box: the window is still scaling in when this first runs.
    if (stage.clientWidth < 2 || stage.clientHeight < 2) return;
    const plan = planScale(model, stage.clientWidth, stage.clientHeight);
    canvas.width = model.cols * plan.paintScale;
    canvas.height = model.rows * plan.paintScale;
    const width = Math.round(plan.width);
    const height = Math.round(plan.height);
    board.style.width = `${width}px`;
    board.style.height = `${height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      paintPauseMap(ctx, model, palette, plan.paintScale);
    }
    // The icons grow with the plan, never under 14 px and never past the corridor they mark (about one tile and a half).
    const size = Math.max(14, Math.min(26, Math.round(plan.scale * 1.2)));
    board.replaceChildren(canvas, ...markers().map((m) => place(m, size, plan.scale)));
  };
  const legend = legendOf(model);
  const swatch = (kind: (typeof legend.tiles)[number]): HTMLElement => {
    const chip = h('span', { className: 'pz-swatch' });
    chip.style.background = mapColor(kind, palette);
    return h('li', { className: 'pz-legend-item' }, [chip, h('span', { textContent: t(`pause.legend.${kind}`) })]);
  };
  const legendList = h('ul', { className: 'pz-legend' }, [
    ...legend.markers.map((kind) => h('li', { className: 'pz-legend-item' }, [pixelSvgOf(MAP_ICONS[kind], 'px-icon'), h('span', { textContent: t(`pause.legend.${kind}`) })])),
    ...legend.tiles.map(swatch),
  ]);
  element.append(stage, legendList);
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(draw);
  observer?.observe(stage);
  queueMicrotask(draw);
  return { element, dispose: () => observer?.disconnect() };
}

/** Draw order of the markers: the player on top of everything. */
const MARKER_ORDER: readonly MapMarker['kind'][] = ['gate', 'event', 'stairs', 'item', 'enemy', 'partner', 'player'];
