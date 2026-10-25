import type { TileRect } from '../core/dungeon';
import { isWall, type TileGrid, type TilePoint } from '../core/tiles';

/**
 * Where the Crypt's decoration goes on a generated floor (presentation only,
 * nothing collides with it): candles on the lit faces of walls (a wall tile
 * with floor right below it) and grave slabs set into the floor of the rooms
 * (inner tiles only, never on the stairs or the start). Placement is a fixed
 * hash of the tile, so the same floor always looks the same.
 */
export interface CryptDecor {
  candles: TilePoint[];
  slabs: TilePoint[];
}

/** Share of lit wall faces that hold a candle, and of inner room tiles that hold a slab. */
const CANDLE_CHANCE = 0.2;
const SLAB_CHANCE = 0.035;

/** Small deterministic per-tile hash in [0, 1). */
export function decorHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x * 374761393 + y * 668265263 + salt * 2246822519, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const same = (a: TilePoint | undefined, x: number, y: number) => a !== undefined && a.x === x && a.y === y;

export function cryptDecor(floor: TileGrid & { rooms?: readonly TileRect[]; stairs?: TilePoint; start?: TilePoint }): CryptDecor {
  const candles: TilePoint[] = [];
  for (let y = 0; y < floor.rows - 1; y++) {
    for (let x = 0; x < floor.cols; x++) {
      if (isWall(floor, x, y) && !isWall(floor, x, y + 1) && decorHash(x, y, 7) < CANDLE_CHANCE) candles.push({ x, y });
    }
  }
  const slabs: TilePoint[] = [];
  for (const room of floor.rooms ?? []) {
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
        if (same(floor.stairs, x, y) || same(floor.start, x, y) || isWall(floor, x, y)) continue;
        if (decorHash(x, y, 13) < SLAB_CHANCE) slabs.push({ x, y });
      }
    }
  }
  return { candles, slabs };
}
