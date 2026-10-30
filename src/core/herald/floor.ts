import { ENDLESS } from '../../data/endless';
import { deriveSeed } from '../rng';
import { worldDifficulty } from '../difficulty';
import type { Difficulty } from '../../data/difficulty';
import type { EnemyState, WorldState } from '../state';
import { SPECIES } from '../../data/species';
import { heraldCardCount, heraldHpScale, heraldWear } from './generate';

/**
 * A herald floor of the Sima (data/endless.ts `heralds`): the arena's
 * `sima-herald` becomes the herald generated from the run seed and the
 * floor, with its types and its HP (the base herald's, scaled by depth and
 * tier as every echo, times its cards' share). Every peer of a shared run
 * (and the daily challenge for everyone) gets the same herald. Loading the
 * floor does not generate the whole boss (its cards come the first time it
 * acts, core/herald/generate.ts `heraldDef`): only its look and its HP.
 */
const HERALD_SALT = 0x4e8a1d;

/** The herald seed of a run's floor. */
export const heraldSeed = (runSeed: number, floor: number): number => deriveSeed(runSeed, HERALD_SALT + floor) >>> 1;

/** The herald floor at or after `floor` (22 for anything shallower or unreadable): the dev route's depth. */
export function devHeraldFloor(floor: number): number {
  const h = ENDLESS.heralds!;
  const f = Number.isFinite(floor) ? Math.max(h.from, Math.floor(floor)) : h.from;
  return f + ((h.offset - (f % h.every) + h.every) % h.every);
}

/** The `sima-herald` enemy as herald `seed` at `depth`: its types and its HP. */
export function asHerald(e: EnemyState, seed: number, depth: number, difficulty: Difficulty): EnemyState {
  const types = SPECIES[heraldWear(seed).source].types;
  const scale = heraldHpScale(heraldCardCount(depth, difficulty));
  // Already a herald (the dev route swaps it): back to the base herald's HP first.
  const base = e.herald ? e.maxHp / heraldHpScale(heraldCardCount(e.herald.depth, difficulty)) : e.maxHp;
  const maxHp = Math.round(base * scale);
  return { ...e, herald: { seed, depth }, types, maxHp, hp: maxHp };
}

/** Turns the room's `sima-herald` into herald `seed` at `depth`. */
export function withHerald(world: WorldState, seed: number, depth: number): WorldState {
  return { ...world, enemies: world.enemies.map((e) => (e.species === 'sima-herald' ? asHerald(e, seed, depth, worldDifficulty(world)) : e)) };
}
