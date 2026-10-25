import { BUBBLE, DHELMISE, DHELMISE_PATTERNS, LANTURN_PATTERNS } from './enemies';
import type { Trick } from './forest-tricks';
import { CRAWDAUNT } from './evolved-enemies';
import type { SpeciesId } from './species';

/**
 * Flooded Caves difficulty hooks (docs/gdd.md §9): patches over each caves
 * species' behaviour, applied by core/tricks.ts `behaviourFor` once the run's
 * tier is `minDifficulty` or harder (read through `atLeast`). Every new enemy
 * gets one extra trick on hard; Lanturn and Dhelmise one more spiral arm on
 * hard and one extra card on nightmare. Easy and normal play the data as
 * written. Values are provisional.
 */
export const CAVES_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  // A second, re-aimed pincer right after the first.
  krabby: [{ minDifficulty: 'hard', patch: { followUp: { telegraphMs: 320, lungeMs: 160, lungeDistance: 95 } } }],
  // A longer Octazooka burst.
  remoraid: [{ minDifficulty: 'hard', patch: { burst: { shots: 5, gapMs: 120 }, castMs: 560 } }],
  // The landing splashes droplets around it.
  shellos: [{ minDifficulty: 'hard', patch: { splash: { count: 6, projectile: { power: 14, type: 'water', speed: 110, radius: 5, lifetimeMs: 1400 } } } }],
  // Evolved forms (data/evolved-enemies.ts): the jet a third time; a third pincer.
  crawdaunt: [{ minDifficulty: 'hard', patch: { repeat: { ...CRAWDAUNT.repeat!, times: 2 } } }],
  kingler: [{ minDifficulty: 'hard', patch: { thirdCut: { minDifficulty: 'hard', telegraphMs: 400, lungeMs: 200, lungeDistance: 110 } } }],
  lanturn: [
    {
      minDifficulty: 'hard',
      patch: {
        patterns: {
          ...LANTURN_PATTERNS,
          lure: { ...LANTURN_PATTERNS.lure!, pattern: { kind: 'spiral', arms: 3, everyMs: 120, durationMs: 2600, turnDegPerShot: 13, shot: { power: 16, type: 'electric', speed: 120, radius: 5, lifetimeMs: 4500 } } },
        },
      },
    },
    { minDifficulty: 'nightmare', patch: { cards: ['bubbles', 'lure', 'surge', 'deep'] } },
  ],
  dhelmise: [
    {
      minDifficulty: 'hard',
      patch: {
        patterns: {
          ...DHELMISE_PATTERNS,
          whirlpool: { ...DHELMISE_PATTERNS.whirlpool!, pattern: { kind: 'spiral', arms: 3, everyMs: 130, durationMs: 3000, turnDegPerShot: 11, shot: BUBBLE(16, 110, 6) } },
        },
      },
    },
    { minDifficulty: 'nightmare', patch: { phase2: { ...DHELMISE.phase2!, cards: ['riptide', 'kelp', 'bell', 'undertow', 'maelstrom'] } } },
  ],
};
