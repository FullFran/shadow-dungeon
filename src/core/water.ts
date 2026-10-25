import { WATER, type WaterTuning } from '../data/dungeon';
import type { PokemonType } from '../data/types';
import type { Floor } from './dungeon';
import { floodFactor, type FloodState } from './flood';
import { deriveSeed, nextRandom } from './rng';
import type { Arena } from './state';
import { tileOf } from './tiles';
import type { Vec2 } from './vec';

/**
 * Shallow water of the Flooded Caves (docs/gdd.md §3, Cuevas Inundadas):
 * some rooms hold a pool (an ellipse of shallow water inside the room) that
 * slows every walker who is not a Water type; fliers and phasers pass over
 * it. Pure and seeded by the floor, with its own salt, so every peer lays the
 * same pools and the floor generator's draws stay as they were. The start
 * room stays dry, and the stairs tile is never under water.
 */
const WATER_SALT = 0x3a7e;

export function shallowWater(floor: Floor, tuning: WaterTuning): number[] {
  const water = new Array<number>(floor.cols * floor.rows).fill(0);
  let state = deriveSeed(floor.seed, floor.depth + WATER_SALT);
  const next = () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
  floor.rooms.forEach((room, index) => {
    // One draw per room for its chance and four for its shape, whether it gets a pool or not, so rooms stay independent.
    const roll = next();
    const cx = room.x + 1 + next() * Math.max(0, room.width - 2);
    const cy = room.y + 1 + next() * Math.max(0, room.height - 2);
    const rx = 1.5 + next() * Math.max(0, room.width / 2 - 1.5);
    const ry = 1.2 + next() * Math.max(0, room.height / 2 - 1.2);
    if (index === floor.startRoom || roll >= tuning.poolChance) return;
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if (x === floor.stairs.x && y === floor.stairs.y) continue;
        if (floor.tiles[y * floor.cols + x] === 1) water[y * floor.cols + x] = 1;
      }
    }
  });
  return water;
}

/** True when `pos` stands in shallow water. */
export function inShallowWater(arena: Pick<Arena, 'water' | 'tiles'>, pos: Vec2): boolean {
  const { water, tiles } = arena;
  if (!water || !tiles) return false;
  const { x, y } = tileOf(pos);
  if (x < 0 || y < 0 || x >= tiles.cols || y >= tiles.rows) return false;
  return water[y * tiles.cols + x] === 1;
}

/**
 * Walking speed factor for a walker of these types at `pos`: shallow water
 * slows, the flood (players only) slows more as it rises; Water types are
 * never slowed. Never below `WATER.minFactor`.
 */
export function wadeFactor(types: readonly PokemonType[], arena: Pick<Arena, 'water' | 'tiles'>, pos: Vec2, flood?: FloodState): number {
  if (types.includes('water')) return 1;
  const pool = inShallowWater(arena, pos) ? WATER.shallowFactor : 1;
  const risen = flood ? floodFactor(flood, types) : 1;
  return pool * risen === 1 ? 1 : Math.max(WATER.minFactor, pool * risen);
}
