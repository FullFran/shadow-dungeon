import { chanceAt, type DungeonDef } from '../data/dungeons';
import { tileDistances, type Floor } from './dungeon';
import { deriveSeed, nextRandom } from './rng';
import type { Berry } from './state';
import { isWall, tileCenter, type TilePoint } from './tiles';
import { distance, type Vec2 } from './vec';

/**
 * The Misty Forest's event (docs/gdd.md, Bosque Brumoso): on some generated
 * floors a wandering spirit light shows the way to a hidden cache of Oran
 * Berries in the side room with the longest walk from the start (never the
 * start room, nor the stairs room when there is another). Drawn from the
 * floor seed like the berries (the generator itself is untouched), so every
 * peer of a shared run places the same cache; the host's snapshots carry
 * which berries are left, as for any berry.
 */

/** Marks the cache's berries in their ids: `f<floor>w<n>`. */
export const WISP_BERRY = 'w';

/** Salt that keeps the event's draw independent of the generator and of the berries. */
const WISP_SALT = 0x3157;

export interface WispCache {
  /** Room of the floor that holds the cache. */
  room: number;
  /** Where the light leads (the cache's middle). */
  cache: Vec2;
  berries: Berry[];
}

const centre = (room: Floor['rooms'][number]): TilePoint => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });

export function wispCache(floor: Floor, seed: number, depth: number, dungeon: DungeonDef, avoid: readonly Berry[] = []): WispCache | null {
  const wisp = dungeon.wisp;
  if (!wisp || nextRandom(deriveSeed(seed, WISP_SALT)).value >= chanceAt(wisp.chance, depth)) return null;
  const side = floor.rooms.map((_, i) => i).filter((i) => i !== floor.startRoom && i !== floor.stairsRoom);
  const options = side.length > 0 ? side : floor.rooms.map((_, i) => i).filter((i) => i !== floor.startRoom);
  if (options.length === 0) return null;
  const walk = tileDistances(floor, floor.start);
  const walkTo = (i: number) => {
    const c = centre(floor.rooms[i]!);
    return walk[c.y * floor.cols + c.x] ?? -1;
  };
  const room = options.reduce((best, i) => (walkTo(i) > walkTo(best) ? i : best), options[0]!);
  const rect = floor.rooms[room]!;
  const middle = centre(rect);
  const taken = new Set([floor.start, floor.stairs, ...floor.spawns.map((s) => s.tile)].map((t) => `${t.x},${t.y}`));
  const free: TilePoint[] = [];
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      if (isWall(floor, x, y) || taken.has(`${x},${y}`) || avoid.some((b) => distance(b.pos, tileCenter({ x, y })) < 1)) continue;
      free.push({ x, y });
    }
  }
  // The cache huddles around the middle of the room.
  free.sort((a, b) => Math.abs(a.x - middle.x) + Math.abs(a.y - middle.y) - (Math.abs(b.x - middle.x) + Math.abs(b.y - middle.y)) || a.y - b.y || a.x - b.x);
  const berries = free.slice(0, wisp.berries).map((tile, i) => ({ id: `f${depth}${WISP_BERRY}${i}`, pos: tileCenter(tile) }));
  if (berries.length === 0) return null;
  return { room, cache: tileCenter(middle), berries };
}

/** The cache's berries still on the floor. */
export const cacheLeft = (berries: readonly Berry[]): number => berries.filter((b) => b.id.includes(WISP_BERRY)).length;
