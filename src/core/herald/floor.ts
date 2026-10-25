import { deriveSeed } from '../rng';
import { worldDifficulty } from '../difficulty';
import type { WorldState } from '../state';
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

/** Turns the room's `sima-herald` into herald `seed` at `depth`. */
export function withHerald(world: WorldState, seed: number, depth: number): WorldState {
  const types = SPECIES[heraldWear(seed).source].types;
  const scale = heraldHpScale(heraldCardCount(depth, worldDifficulty(world)));
  return {
    ...world,
    enemies: world.enemies.map((e) => {
      if (e.species !== 'sima-herald') return e;
      const maxHp = Math.round(e.maxHp * scale);
      return { ...e, herald: { seed, depth }, types, maxHp, hp: maxHp };
    }),
  };
}
