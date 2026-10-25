import { tileDistances, type TileRect } from '../core/dungeon';
import { isWall, tileCenter, tileOf, type TileGrid, type TilePoint } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { decorHash } from './crypt-decor';

/**
 * Where the Misty Forest's dressing goes on a generated floor (presentation
 * only, nothing collides with it): gnarled roots hanging down the lit faces
 * of the walls, glowing mushrooms on floor tiles along the walls, fallen logs
 * inside the rooms, at most one stone shrine set into a wall, and a few
 * fireflies drifting over each room. Placement is a fixed hash of the tile,
 * so the same floor always looks the same.
 */
export interface Firefly {
  /** Centre of its drift (world px) and how far it wanders. */
  x: number;
  y: number;
  rx: number;
  ry: number;
  phase: number;
}

export interface ForestDecor {
  roots: TilePoint[];
  mushrooms: TilePoint[];
  logs: TilePoint[];
  shrines: TilePoint[];
  fireflies: Firefly[];
}

const ROOT_CHANCE = 0.3;
const MUSHROOM_CHANCE = 0.09;
const LOG_CHANCE = 0.02;
const SHRINE_CHANCE = 0.6;
const FIREFLIES_PER_ROOM = 3;

type ForestFloor = TileGrid & { rooms?: readonly TileRect[]; stairs?: TilePoint; start?: TilePoint };

const same = (a: TilePoint | undefined, x: number, y: number) => a !== undefined && a.x === x && a.y === y;

export function forestDecor(floor: ForestFloor): ForestDecor {
  const roots: TilePoint[] = [];
  for (let y = 0; y < floor.rows - 1; y++) {
    for (let x = 0; x < floor.cols; x++) {
      if (isWall(floor, x, y) && !isWall(floor, x, y + 1) && decorHash(x, y, 21) < ROOT_CHANCE) roots.push({ x, y });
    }
  }
  const mushrooms: TilePoint[] = [];
  const logs: TilePoint[] = [];
  const fireflies: Firefly[] = [];
  const rooms = floor.rooms ?? [];
  const free = (x: number, y: number) => !isWall(floor, x, y) && !same(floor.stairs, x, y) && !same(floor.start, x, y);
  for (const room of rooms) {
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (!free(x, y)) continue;
        const byWall = isWall(floor, x - 1, y) || isWall(floor, x + 1, y) || isWall(floor, x, y - 1) || isWall(floor, x, y + 1);
        if (byWall && decorHash(x, y, 23) < MUSHROOM_CHANCE) mushrooms.push({ x, y });
        const inner = x > room.x && x < room.x + room.width - 1 && y > room.y && y < room.y + room.height - 1;
        if (inner && !byWall && decorHash(x, y, 29) < LOG_CHANCE) logs.push({ x, y });
      }
    }
    for (let i = 0; i < FIREFLIES_PER_ROOM; i++) {
      const hx = decorHash(room.x, room.y, 31 + i);
      const hy = decorHash(room.y, room.x, 37 + i);
      fireflies.push({
        x: (room.x + room.width * (0.2 + 0.6 * hx)) * 32,
        y: (room.y + room.height * (0.2 + 0.6 * hy)) * 32,
        rx: room.width * 32 * 0.3,
        ry: room.height * 32 * 0.25,
        phase: decorHash(room.x + i, room.y, 41) * Math.PI * 2,
      });
    }
  }
  // One shrine at most: set into the wall above the middle of the first room (by hash) that has a lit face there.
  const shrines: TilePoint[] = [];
  const ordered = rooms.map((room, i) => ({ room, h: decorHash(room.x, room.y, 43 + i) })).sort((a, b) => a.h - b.h);
  if ((ordered[0]?.h ?? 1) < SHRINE_CHANCE) {
    for (const { room } of ordered) {
      const x = room.x + Math.floor(room.width / 2);
      const y = room.y - 1;
      if (y >= 0 && isWall(floor, x, y) && !isWall(floor, x, y + 1)) {
        shrines.push({ x, y });
        break;
      }
    }
  }
  return { roots, mushrooms, logs, shrines, fireflies };
}

/**
 * Where the spirit light floats: a few steps ahead of the player along the
 * walk to the cache (downhill on the walking distances from it), and right
 * over the cache once the player is close. `walk` may be passed in to reuse
 * the distance field (tileDistances from the cache tile).
 */
export function wispGuide(grid: TileGrid, cache: Vec2, player: Vec2, walk: readonly number[] = tileDistances(grid, tileOf(cache)), steps = 3): Vec2 {
  let tile = tileOf(player);
  const at = (t: TilePoint) => walk[t.y * grid.cols + t.x] ?? -1;
  if (at(tile) < 0 || at(tile) <= steps) return cache;
  for (let i = 0; i < steps; i++) {
    const options = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ].filter((t) => at(t) >= 0 && at(t) < at(tile));
    if (options.length === 0) break;
    tile = options[0]!;
  }
  return tileCenter(tile);
}
