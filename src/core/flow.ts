import { tileDistances } from './dungeon';
import type { WorldState } from './state';
import { isWall, tileOf, type TileGrid, type TilePoint } from './tiles';

/**
 * A tile flow field towards the player: the walking distance (in tiles) from
 * the player's tile to every floor tile, -1 where unreachable. One field is
 * shared by every enemy and rebuilt only when the player changes tile, so
 * walkers that lose sight of the player can follow it downhill around walls.
 */
export interface FlowField {
  /** The grid the field was built on: a new floor always rebuilds it. */
  grid: TileGrid;
  /** The tile the distances are measured from (the player's). */
  origin: TilePoint;
  dist: readonly number[];
}

export const flowField = (grid: TileGrid, origin: TilePoint): FlowField => ({ grid, origin, dist: tileDistances(grid, origin) });

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;

/**
 * The neighbour tile one step closer to the field's origin, or null when the
 * tile is off the field. Diagonals only when both side tiles are floor, so a
 * body never cuts a wall corner.
 */
export function flowStep(grid: TileGrid, field: FlowField, from: TilePoint): TilePoint | null {
  const here = isWall(grid, from.x, from.y) ? -1 : field.dist[from.y * grid.cols + from.x]!;
  if (here <= 0) return null;
  let best: TilePoint | null = null;
  let bestDist = here;
  for (const [dx, dy] of NEIGHBOURS) {
    const x = from.x + dx;
    const y = from.y + dy;
    if (isWall(grid, x, y)) continue;
    if (dx !== 0 && dy !== 0 && (isWall(grid, from.x + dx, from.y) || isWall(grid, from.x, from.y + dy))) continue;
    const d = field.dist[y * grid.cols + x]!;
    if (d >= 0 && d < bestDist) {
      best = { x, y };
      bestDist = d;
    }
  }
  return best;
}

/** Keeps the world's flow field on the player's current tile (generated floors only). */
export function updateFlow(state: WorldState): WorldState {
  const grid = state.arena.tiles;
  if (!grid) return state.flow ? { ...state, flow: undefined } : state;
  const origin = tileOf(state.player.pos);
  if (state.flow && state.flow.grid === grid && state.flow.origin.x === origin.x && state.flow.origin.y === origin.y) return state;
  return { ...state, flow: flowField(grid, origin) };
}
