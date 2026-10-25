import { presentPlayers } from './party';
import type { WorldState } from './state';
import { isWall, tileOf, type TileGrid, type TilePoint } from './tiles';

/**
 * A tile flow field towards the players: the walking distance (in tiles) from
 * the nearest present player's tile to every floor tile, -1 where unreachable.
 * One field is shared by every enemy (one multi-source search, whatever the
 * number of players) and rebuilt only when a player changes tile, so walkers
 * that lose sight of their target follow it downhill around walls to the
 * nearest player.
 */
export interface FlowField {
  /** The grid the field was built on: a new floor always rebuilds it. */
  grid: TileGrid;
  /** The first origin tile (the local player's, solo the only one). */
  origin: TilePoint;
  /** Every tile the distances are measured from (one per present player). */
  origins: readonly TilePoint[];
  dist: readonly number[];
}

/** Breadth-first walking distances (4-neighbour) from the nearest of `origins`. */
function distancesFrom(grid: TileGrid, origins: readonly TilePoint[]): number[] {
  const dist = new Array<number>(grid.cols * grid.rows).fill(-1);
  const queue: TilePoint[] = [];
  for (const o of origins) {
    if (dist[o.y * grid.cols + o.x] === 0) continue;
    dist[o.y * grid.cols + o.x] = 0;
    queue.push(o);
  }
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head]!;
    const d = dist[y * grid.cols + x]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(grid, nx, ny) || dist[ny * grid.cols + nx] !== -1) continue;
      dist[ny * grid.cols + nx] = d + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

export const flowFieldFrom = (grid: TileGrid, origins: readonly TilePoint[]): FlowField => ({
  grid,
  origin: origins[0]!,
  origins,
  dist: distancesFrom(grid, origins),
});

export const flowField = (grid: TileGrid, origin: TilePoint): FlowField => flowFieldFrom(grid, [origin]);

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

const sameTiles = (a: readonly TilePoint[], b: readonly TilePoint[]) => a.length === b.length && a.every((t, i) => t.x === b[i]!.x && t.y === b[i]!.y);

/** Keeps the world's flow field on the present players' current tiles (generated floors only). */
export function updateFlow(state: WorldState): WorldState {
  const grid = state.arena.tiles;
  if (!grid) return state.flow ? { ...state, flow: undefined } : state;
  const present = presentPlayers(state);
  const origins = (present.length > 0 ? present.map((p) => p.pos) : [state.player.pos]).map(tileOf);
  if (state.flow && state.flow.grid === grid && sameTiles(state.flow.origins, origins)) return state;
  return { ...state, flow: flowFieldFrom(grid, origins) };
}
