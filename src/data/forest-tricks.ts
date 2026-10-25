import type { Difficulty } from './difficulty';
import { DECIDUEYE, DRIFLOON, IMPIDIMP, TREVENANT, type EnemyDef } from './enemies';
import { DRIFBLIM } from './evolved-enemies';
import type { SpeciesId } from './species';

/**
 * Misty Forest difficulty hooks (docs/gdd.md §9): what each forest species
 * adds on harder tiers, as patches over its behaviour, applied in order once
 * the run's tier is `minDifficulty` or harder (core/tricks.ts reads the tier
 * through `atLeast(worldDifficulty(state), …)`). Easy and normal play the
 * shipped balance untouched. Every regular enemy gets one extra trick on
 * hard; Trevenant and Decidueye one extra card on hard and longer combos on
 * nightmare. Values are provisional.
 */
export interface Trick {
  minDifficulty: Difficulty;
  /** Replaces whole fields of the behaviour (nested ones are spelled out in full). */
  patch: Partial<EnemyDef>;
}

/** The forest's species, in the order of the GDD table. */
export const FOREST_SPECIES: readonly SpeciesId[] = [
  'phantump',
  'pumpkaboo-small',
  'pumpkaboo-super',
  'foongus',
  'spinarak',
  'hoothoot',
  'impidimp',
  'shroomish',
  'drifloon',
  'trevenant',
  'decidueye',
];

export const FOREST_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  // A second grab, re-aimed, right after the first.
  phantump: [{ minDifficulty: 'hard', patch: { followUp: { telegraphMs: 320, lungeMs: 240, lungeDistance: 90 } } }],
  // A ghost flame left where each lunge ends.
  'pumpkaboo-small': [{ minDifficulty: 'hard', patch: { ember: { power: 12, type: 'ghost', radius: 16, lifetimeMs: 2200 } } }],
  // The slam throws a ring of ghost flames.
  'pumpkaboo-super': [{ minDifficulty: 'hard', patch: { ring: { count: 8, projectile: { power: 18, type: 'ghost', speed: 80, radius: 6, lifetimeMs: 3500 } } } }],
  // The puff also lets go of a ring of slow spores.
  foongus: [{ minDifficulty: 'hard', patch: { burst: { count: 6, shot: { power: 14, type: 'poison', speed: 50, radius: 6, lifetimeMs: 3000 } } } }],
  // Five threads instead of three.
  spinarak: [{ minDifficulty: 'hard', patch: { spread: { count: 5, degrees: 48 } } }],
  // A second dive, re-aimed.
  hoothoot: [{ minDifficulty: 'hard', patch: { followUp: { telegraphMs: 380, lungeMs: 300, lungeDistance: 170 } } }],
  // Two feints before the real lunge.
  impidimp: [{ minDifficulty: 'hard', patch: { feint: { ...IMPIDIMP.feint!, count: 2 } } }],
  // Spores fly out where it lands.
  shroomish: [{ minDifficulty: 'hard', patch: { ring: { count: 6, projectile: { power: 14, type: 'grass', speed: 70, radius: 6, lifetimeMs: 3000 } } } }],
  // A second ring, turned half a step, right behind the first.
  drifloon: [{ minDifficulty: 'hard', patch: { ring: { ...DRIFLOON.ring!, waves: 2, waveGapMs: 350 } } }],
  // Evolved forms (data/evolved-enemies.ts): a third ring; a third dive.
  drifblim: [{ minDifficulty: 'hard', patch: { ring: { ...DRIFBLIM.ring!, waves: 3 } } }],
  noctowl: [{ minDifficulty: 'hard', patch: { thirdCut: { minDifficulty: 'hard', telegraphMs: 420, lungeMs: 300, lungeDistance: 180 } } }],
  trevenant: [
    { minDifficulty: 'hard', patch: { cards: [...TREVENANT.cards, 'grove'] } },
    {
      minDifficulty: 'nightmare',
      patch: {
        roots: { ...TREVENANT.roots, waves: 3 },
        spiral: { ...TREVENANT.spiral, bursts: 18 },
        curse: { ...TREVENANT.curse, rings: 3 },
      },
    },
  ],
  decidueye: [
    // The shadow stitch already in phase 1; one more Volley in phase 2.
    { minDifficulty: 'hard', patch: { cards: [...DECIDUEYE.cards, 'stitch'], phase2: { ...DECIDUEYE.phase2, cards: [...DECIDUEYE.phase2.cards, 'volley'] } } },
    {
      minDifficulty: 'nightmare',
      patch: {
        volley: { ...DECIDUEYE.volley, shots: 7 },
        fan: { ...DECIDUEYE.fan, fans: 4 },
        phase2: {
          ...DECIDUEYE.phase2,
          cards: [...DECIDUEYE.phase2.cards, 'volley'],
          rain: { ...DECIDUEYE.phase2.rain, waves: 4 },
          feathers: { ...DECIDUEYE.phase2.feathers, bursts: 20 },
          stitch: { ...DECIDUEYE.phase2.stitch, stitches: 4 },
        },
      },
    },
  ],
};
