import { TOWN_PROPS, type TownMap, type TownProp } from '../data/town';
import type { TilePoint, TileGrid } from '../core/tiles';

/**
 * Pure helpers over the hand-authored town (src/data/town.ts): the collision
 * grid in the core's TileGrid format, flood-fill reachability for the map
 * validity tests, and which cell of the 3x3 path patch a path tile uses.
 */
export type Ground = 'sky' | 'forest' | 'grass' | 'path';

const GROUND: Record<string, Ground> = { S: 'sky', F: 'forest', '.': 'grass', ',': 'path' };

/** Ground at a tile; outside the map counts as forest. */
export function groundAt(map: TownMap, x: number, y: number): Ground {
  const ch = map.rows[y]?.[x];
  return (ch === undefined ? undefined : GROUND[ch]) ?? 'forest';
}

/** Tiles a prop blocks: its bottom `solidRows` rows. */
export function propSolidTiles(prop: TownProp): TilePoint[] {
  const spec = TOWN_PROPS[prop.kind];
  const out: TilePoint[] = [];
  for (let y = prop.y + spec.height - spec.solidRows; y < prop.y + spec.height; y++) {
    for (let x = prop.x; x < prop.x + spec.width; x++) out.push({ x, y });
  }
  return out;
}

/** Walkable grass and path are floor (1); sky, forest, prop footprints and NPCs are wall (0). */
export function buildTownGrid(map: TownMap): TileGrid {
  const rows = map.rows.length;
  const cols = map.rows[0]?.length ?? 0;
  const tiles: number[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const ground = groundAt(map, x, y);
      tiles.push(ground === 'grass' || ground === 'path' ? 1 : 0);
    }
  }
  const block = (t: TilePoint) => {
    if (t.x >= 0 && t.y >= 0 && t.x < cols && t.y < rows) tiles[t.y * cols + t.x] = 0;
  };
  for (const prop of map.props) propSolidTiles(prop).forEach(block);
  for (const npc of map.npcs) block(npc);
  return { cols, rows, tiles };
}

/** Indices (`y * cols + x`) of the floor tiles connected to `start` through 4-neighbour steps. */
export function reachableFrom(grid: TileGrid, start: TilePoint): Set<number> {
  const seen = new Set<number>();
  const floor = (x: number, y: number) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y * grid.cols + x] === 1;
  if (!floor(start.x, start.y)) return seen;
  const queue: TilePoint[] = [start];
  seen.add(start.y * grid.cols + start.x);
  while (queue.length > 0) {
    const { x, y } = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const index = ny * grid.cols + nx;
      if (floor(nx, ny) && !seen.has(index)) {
        seen.add(index);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return seen;
}

/**
 * Cell (col, row 0..2) of the 3x3 path patch for a path tile: an edge towards
 * each side where the neighbour is not path. The map edge counts as path, so
 * the road runs out of the map cleanly.
 */
export function pathPatchCell(map: TownMap, x: number, y: number): { col: number; row: number } {
  const cols = map.rows[0]?.length ?? 0;
  const path = (px: number, py: number) => px < 0 || px >= cols || py < 0 || py >= map.rows.length || groundAt(map, px, py) === 'path';
  const axis = (before: boolean, after: boolean) => (before === after ? 1 : before ? 2 : 0);
  return { col: axis(path(x - 1, y), path(x + 1, y)), row: axis(path(x, y - 1), path(x, y + 1)) };
}
