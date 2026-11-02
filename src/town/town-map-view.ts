import type { WorldMap } from '../data/world';
import { isWall } from '../core/tiles';
import { h } from '../ui/window';
import { buildTownGrid } from './map';
import { stepMarker, type TownMapMarker } from './town-map';
import type { TownService } from './town-menu';

/**
 * The town's Esc menu drawn as an inked plan (odd/tasks/menu-redesign.md S8,
 * S9: souls tone, original glyphs): the town's walkable ground, one marker per
 * service at its NPC or place, and a column beside it for the services with
 * no place and the exit rows. Arrows, WASD, a stick (the gamepad sends arrow
 * keys) or a tap move the cursor; Enter or a second tap opens; Esc closes.
 */
export interface TownMapEntry {
  id: string;
  label: string;
  about: string;
  /** The glyph drawn on the marker. */
  glyph: Glyph;
  onConfirm: () => void;
}

export type Glyph = TownService | 'title' | 'resume' | 'room';

export interface TownMapViewOptions {
  heading: string;
  map: WorldMap;
  /** The markers on the plan, each with its row (same order). */
  placed: readonly (TownMapMarker & { entry: TownMapEntry })[];
  /** The column beside the plan: loose services, then the exit rows. */
  column: readonly TownMapEntry[];
  onClose: () => void;
}

/** View pixels per tile of the plan. */
const CELL = 12;

/** Original line glyphs, 16x16 viewBox (no art from other games): one per service and exit row. */
const GLYPHS: Record<Glyph, string> = {
  shop: 'M3 6h10l-1 8H4zM6 6a2 2 0 0 1 4 0',
  tutor: 'M3 13l7-7 3 3-7 7H3zM10 6l2-2 3 3-2 2',
  gacha: 'M8 2l1.8 4.2L14 7l-3.2 3 .8 4.5L8 12.3 4.4 14.5l.8-4.5L2 7l4.2-.8z',
  evolve: 'M11 2a6 6 0 1 0 3 10 5 5 0 1 1-3-10z',
  dungeons: 'M8 2l5 5-5 7-5-7z',
  challenges: 'M8 2l5 5-5 7-5-7zM8 6v4',
  travel: 'M2 8h12M10 4l4 4-4 4',
  board: 'M3 3h10v8H3zM5 6h6M5 8h4M8 11v3',
  shrine: 'M2 5h12M4 5v9M12 5v9M3 3l5-1 5 1',
  online: 'M8 2c2 3-2 4 0 7 1-1 1-2 3-3 0 4-1 8-3 8s-4-2-4-5c0-3 3-4 4-7z',
  pokemon: 'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2zM2 8h12M8 6.5a1.5 1.5 0 1 0 0 3',
  achievements: 'M5 2h6v4a3 3 0 0 1-6 0zM8 9v3M5 14h6',
  gallery: 'M2 4h12v9H2zM2 11l4-4 3 3 2-2 3 3',
  friends: 'M5 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM11 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM1 13c0-3 8-3 8 0M7 13c0-3 8-3 8 0',
  account: 'M8 7a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 15c0-4 12-4 12 0',
  settings: 'M8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3',
  controls: 'M2 6h12v6H2zM5 9h2M6 8v2M10 9h.5M12 9h.5',
  title: 'M3 2h7v12H3zM10 8h4M12 6l2 2-2 2',
  resume: 'M5 3l8 5-8 5z',
  room: 'M2 7l6-5 6 5v7H2zM6 14v-4h4v4',
};

function glyphSvg(glyph: Glyph): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', GLYPHS[glyph]);
  svg.append(path);
  return svg;
}

/** The town's ground as an inked plan: walkable tiles filled, an ink line where they meet a wall. */
function drawPlan(map: WorldMap): HTMLCanvasElement {
  const grid = buildTownGrid(map);
  const canvas = h('canvas', { className: 'town-map-plan' }) as HTMLCanvasElement;
  canvas.width = grid.cols * CELL;
  canvas.height = grid.rows * CELL;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const style = getComputedStyle(document.documentElement);
  const ground = style.getPropertyValue('--md-map-ground').trim() || '#2a2419';
  const ink = style.getPropertyValue('--md-map-ink').trim() || '#c9b98f';
  ctx.fillStyle = ground;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if (!isWall(grid, x, y)) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  ctx.fillStyle = ink;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      if (isWall(grid, x, y)) continue;
      if (isWall(grid, x, y - 1)) ctx.fillRect(x * CELL, y * CELL, CELL, 1);
      if (isWall(grid, x, y + 1)) ctx.fillRect(x * CELL, (y + 1) * CELL - 1, CELL, 1);
      if (isWall(grid, x - 1, y)) ctx.fillRect(x * CELL, y * CELL, 1, CELL);
      if (isWall(grid, x + 1, y)) ctx.fillRect((x + 1) * CELL - 1, y * CELL, 1, CELL);
    }
  }
  return canvas;
}

export function townMapView(options: TownMapViewOptions): { element: HTMLElement; dispose(): void } {
  const { map, placed, column } = options;
  const cols = Math.max(...map.rows.map((r) => r.length));
  const rows = map.rows.length;
  // Every entry as a marker: the plan's at their tiles, the column's in a line to the right of the plan.
  const columnX = cols + 3;
  const step = column.length > 1 ? (rows - 2) / (column.length - 1) : 0;
  const entries: (TownMapMarker & { entry: TownMapEntry })[] = [
    ...placed,
    ...column.map((entry, i) => ({ id: entry.id, service: 'shop' as const, x: columnX, y: 1 + i * step, entry })),
  ];
  let index = 0;
  const caption = h('p', { className: 'town-map-caption' });
  const buttons = entries.map((m, i) => {
    const button = h('button', { className: `town-map-mark${i >= placed.length ? ' in-column' : ''}`, type: 'button' }, [glyphSvg(m.entry.glyph), h('span', { className: 'town-map-label', textContent: m.entry.label })]);
    if (i < placed.length) {
      button.style.left = `${(m.x / cols) * 100}%`;
      button.style.top = `${(m.y / rows) * 100}%`;
    }
    button.addEventListener('click', () => {
      if (index === i) m.entry.onConfirm();
      else select(i);
    });
    return button;
  });
  function select(i: number): void {
    index = i;
    buttons.forEach((b, j) => b.classList.toggle('selected', j === i));
    // The column scrolls on short screens: keep the chosen row in view.
    buttons[i]!.scrollIntoView?.({ block: 'nearest' });
    const entry = entries[i]!.entry;
    caption.replaceChildren(h('strong', { textContent: entry.label }), document.createTextNode(` · ${entry.about}`));
  }
  const plan = h('div', { className: 'town-map-board' }, [drawPlan(map), ...buttons.slice(0, placed.length)]);
  const side = h('div', { className: 'town-map-column' }, buttons.slice(placed.length));
  const element = h('div', { className: 'md-window town-map' }, [h('h2', { className: 'md-window-title', textContent: options.heading }), h('div', { className: 'town-map-body' }, [plan, side]), caption]);
  select(0);

  const DIRS: Record<string, { x: number; y: number }> = {
    ArrowLeft: { x: -1, y: 0 },
    KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    KeyD: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    KeyS: { x: 0, y: 1 },
  };
  const onKey = (e: KeyboardEvent) => {
    const dir = DIRS[e.code];
    if (dir) {
      e.preventDefault();
      // Inside the column, up and down walk its rows in order (the plan's geometry does not apply there).
      if (index >= placed.length && dir.x === 0) {
        const next = index + dir.y;
        if (next >= placed.length && next < entries.length) select(next);
        return;
      }
      select(stepMarker(entries, index, dir));
    } else if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      entries[index]!.entry.onConfirm();
    } else if (e.code === 'Escape') {
      e.preventDefault();
      options.onClose();
    }
  };
  window.addEventListener('keydown', onKey);
  return { element, dispose: () => window.removeEventListener('keydown', onKey) };
}
