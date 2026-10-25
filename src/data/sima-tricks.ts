import { ECLIPSE_ECHO } from './enemies';
import type { Trick } from './forest-tricks';
import { HOUNDOOM } from './evolved-enemies';
import type { SpeciesId } from './species';

/**
 * Sima del Eclipse difficulty hooks (docs/gdd.md §9): patches over the Sima's
 * own species, applied by core/tricks.ts `behaviourFor` once the run's tier
 * is `minDifficulty` or harder. The Eclipse Echo plays one more spell card
 * from hard (on top of one more per eclipse floor). Easy and normal play the
 * data as written. Values are provisional.
 */
export const SIMA_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  // Houndoom (data/evolved-enemies.ts): the flamethrower turns after you faster.
  houndoom: [{ minDifficulty: 'hard', patch: { sweep: { ...HOUNDOOM.sweep!, degPerSec: 80 } } }],
  'eclipse-echo': [{ minDifficulty: 'hard', patch: { extraCards: ECLIPSE_ECHO.extraCards + 1 } }],
};
