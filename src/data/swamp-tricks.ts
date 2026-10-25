import type { Trick } from './forest-tricks';
import type { SpeciesId } from './species';
import { TOXICROAK } from './evolved-enemies';
import { NIHILEGO, SALAZZLE, VENIPEDE } from './swamp-enemies';

/**
 * Toxic Swamp difficulty hooks (docs/gdd.md §9): patches over each swamp
 * species' behaviour, applied by core/tricks.ts `behaviourFor` once the run's
 * tier is `minDifficulty` or harder (read through `atLeast`). Every new enemy
 * gets one extra trick on hard; Salazzle a fourth dash and Nihilego a third
 * tendril wave and a fourth shard ring on hard, and each boss an extra card on
 * nightmare (Salazzle's court, Nihilego's downpour closing every turn). Easy
 * and normal play the data as written. Values are provisional.
 */
export const SWAMP_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  // One more bounce off a wall.
  venipede: [{ minDifficulty: 'hard', patch: { bounces: VENIPEDE.bounces + 1 } }],
  // It turns and dashes back once.
  salandit: [{ minDifficulty: 'hard', patch: { returnDash: { telegraphMs: 360 } } }],
  // A narrow fan of three bolts.
  skrelp: [{ minDifficulty: 'hard', patch: { fan: { count: 3, degrees: 22 } } }],
  // Evolved forms (data/evolved-enemies.ts): the jab a third time; a ring of sludge with the slam.
  toxicroak: [{ minDifficulty: 'hard', patch: { repeat: { ...TOXICROAK.repeat!, times: 2 } } }],
  muk: [{ minDifficulty: 'hard', patch: { hardRing: { minDifficulty: 'hard', count: 8, projectile: { power: 16, type: 'poison', speed: 65, radius: 7, lifetimeMs: 3200 } } } }],
  salazzle: [
    { minDifficulty: 'hard', patch: { dance: { ...SALAZZLE.dance, dashes: SALAZZLE.dance.dashes + 1 } } },
    { minDifficulty: 'nightmare', patch: { cards: [...SALAZZLE.cards, 'escort'] } },
  ],
  nihilego: [
    {
      minDifficulty: 'hard',
      patch: { tendrils: { ...NIHILEGO.tendrils, waves: NIHILEGO.tendrils.waves + 1 }, shards: { ...NIHILEGO.shards, rings: NIHILEGO.shards.rings + 1 } },
    },
    { minDifficulty: 'nightmare', patch: { phase1: [...NIHILEGO.phase1, 'downpour'], phase2: { ...NIHILEGO.phase2, cards: [...NIHILEGO.phase2.cards, 'downpour'] } } },
  ],
};
