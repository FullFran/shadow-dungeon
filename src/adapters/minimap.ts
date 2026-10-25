import { EVENT_COLORS } from './sima-events-view';
import { fogRadiusTiles } from '../core/fog';
import type { TileRect } from '../core/dungeon';
import { collapseFront } from '../core/collapse';
import type { Rect, WorldState } from '../core/state';
import { isWall, TILE, tileOf, type TileGrid, type TilePoint } from '../core/tiles';
import { distance, type Vec2 } from '../core/vec';
import { insideRect } from '../core/geometry';
import { drawPanel } from '../ui/canvas';

/**
 * Mystery Dungeon-style minimap with fog of war. The memory of seen tiles is
 * presentation state kept by the game loop per floor: entering a room reveals
 * all of it (walls included), corridors reveal a small square around the
 * player. The stairs show once their tile has been seen; enemies only while
 * they are on screen; Oran Berries once their tile has been seen (until eaten).
 */
export const MINIMAP = {
  /** Corridor reveal: tiles in every direction around the player. */
  revealRadius: 3,
  /** Size of one map tile on the minimap, in view pixels. */
  tilePx: 3,
  /** Gap to the top-right corner of the view (the floor shows in the status window now). */
  margin: 10,
  top: 10,
} as const;

export interface MinimapMemory {
  cols: number;
  rows: number;
  /** 1 where the tile has been seen. */
  seen: Uint8Array;
}

export const createMemory = (grid: TileGrid): MinimapMemory => ({ cols: grid.cols, rows: grid.rows, seen: new Uint8Array(grid.cols * grid.rows) });

export const isSeen = (memory: MinimapMemory, x: number, y: number): boolean =>
  x >= 0 && y >= 0 && x < memory.cols && y < memory.rows && memory.seen[y * memory.cols + x] === 1;

function markRect(memory: MinimapMemory, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = Math.max(0, y0); y <= Math.min(memory.rows - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(memory.cols - 1, x1); x++) memory.seen[y * memory.cols + x] = 1;
  }
}

/** Marks what the player at `at` sees: its whole room (and walls) or a square around it. Mutates `memory`. */
/**
 * Marks what the player sees from `at`: its whole room on entering it and a
 * square around it. In the fog (`sightTiles`) only the tiles inside the sight
 * circle are remembered, rooms included.
 */
export function revealAround(memory: MinimapMemory, grid: TileGrid, rooms: readonly TileRect[], at: TilePoint, sightTiles?: number): void {
  if (sightTiles !== undefined) {
    const r = Math.floor(sightTiles);
    for (let y = at.y - r; y <= at.y + r; y++) for (let x = at.x - r; x <= at.x + r; x++) if ((x - at.x) ** 2 + (y - at.y) ** 2 <= sightTiles ** 2) markRect(memory, x, y, x, y);
    return;
  }
  const room = isWall(grid, at.x, at.y) ? undefined : rooms.find((r) => at.x >= r.x && at.x < r.x + r.width && at.y >= r.y && at.y < r.y + r.height);
  if (room) markRect(memory, room.x - 1, room.y - 1, room.x + room.width, room.y + room.height);
  const r = MINIMAP.revealRadius;
  markRect(memory, at.x - r, at.y - r, at.x + r, at.y + r);
}

export interface MinimapMarks {
  /** Positions in tile units (fractional). */
  player: Vec2;
  stairs: TilePoint | null;
  enemies: Vec2[];
  /** Berries still on the floor whose tile has been seen. */
  berries: TilePoint[];
  /** The Sima's floor event, once its tile has been seen (not the hunter: it has no place). */
  event?: { tile: TilePoint; color: string; done: boolean } | null;
}

function eventMark(state: WorldState, memory: MinimapMemory): MinimapMarks['event'] {
  const event = state.simaEvent;
  if (!event || event.kind === 'hunter') return null;
  const tile = tileOf(event.pos);
  return isSeen(memory, tile.x, tile.y) ? { tile, color: EVENT_COLORS[event.kind], done: event.done } : null;
}

export function minimapMarks(state: WorldState, memory: MinimapMemory, view: Rect): MinimapMarks {
  const stairsRect = state.arena.stairs;
  const stairs = stairsRect ? tileOf({ x: stairsRect.x + 1, y: stairsRect.y + 1 }) : null;
  return {
    player: { x: state.player.pos.x / TILE, y: state.player.pos.y / TILE },
    stairs: stairs && isSeen(memory, stairs.x, stairs.y) ? stairs : null,
    // In the fog only what is inside the sight circle shows.
    enemies: state.enemies
      .filter((e) => e.alive && insideRect(e.pos, view) && (!state.fog || distance(e.pos, state.player.pos) <= fogRadiusTiles(state.fog) * TILE))
      .map((e) => ({ x: e.pos.x / TILE, y: e.pos.y / TILE })),
    berries: state.berries.map((b) => tileOf(b.pos)).filter((t) => isSeen(memory, t.x, t.y)),
    event: eventMark(state, memory),
  };
}

const COLORS = {
  floor: 'rgba(190, 210, 255, 0.75)',
  rubble: 'rgba(200, 70, 50, 0.55)',
  player: '#ffe066',
  stairs: '#7fd8ff',
  enemy: '#ff5a5a',
  berry: '#5b8cff',
};

/** Draws the minimap at the top right of the view (view units; the caller has applied the pixel scale). */
export function drawMinimap(ctx: CanvasRenderingContext2D, state: WorldState, memory: MinimapMemory, view: Rect, timeMs: number): void {
  const grid = state.arena.tiles;
  if (!grid) return;
  const px = MINIMAP.tilePx;
  const x0 = view.width - MINIMAP.margin - grid.cols * px;
  const y0 = MINIMAP.top;
  // The same window frame as the HUD, mostly see-through so the floor shows behind the map.
  drawPanel(ctx, x0 - 4, y0 - 4, grid.cols * px + 8, grid.rows * px + 8, { alpha: 0.9, fill: 0.7 });
  const collapse = state.collapse;
  const front = collapse ? collapseFront(collapse) : 0;
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.cols; x++) {
      // Floor only, Mystery Dungeon style: rooms and corridors read as shapes on the dark panel.
      if (!isSeen(memory, x, y) || isWall(grid, x, y)) continue;
      const d = collapse ? (collapse.dist[y * grid.cols + x] ?? -1) : -1;
      ctx.fillStyle = front > 0 && d >= 0 && d < front ? COLORS.rubble : COLORS.floor;
      ctx.fillRect(x0 + x * px, y0 + y * px, px, px);
    }
  }
  const marks = minimapMarks(state, memory, view);
  if (marks.stairs) {
    ctx.fillStyle = COLORS.stairs;
    ctx.fillRect(x0 + marks.stairs.x * px - 1, y0 + marks.stairs.y * px - 1, px + 2, px + 2);
  }
  ctx.fillStyle = COLORS.berry;
  for (const b of marks.berries) ctx.fillRect(x0 + b.x * px, y0 + b.y * px, px, px);
  if (marks.event) {
    // A small diamond in the event's colour, dim once it is over.
    const { tile, color, done } = marks.event;
    const cx = x0 + tile.x * px + px / 2;
    const cy = y0 + tile.y * px + px / 2;
    ctx.globalAlpha = done ? 0.4 : 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 3, cy);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = COLORS.enemy;
  for (const e of marks.enemies) ctx.fillRect(Math.round(x0 + e.x * px - 1), Math.round(y0 + e.y * px - 1), 2, 2);
  // The player blinks slowly so it is easy to find.
  ctx.globalAlpha = 0.65 + 0.35 * Math.sin(timeMs / 160);
  ctx.fillStyle = COLORS.player;
  ctx.fillRect(Math.round(x0 + marks.player.x * px - 1.5), Math.round(y0 + marks.player.y * px - 1.5), 3, 3);
  ctx.globalAlpha = 1;
}
