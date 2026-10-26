import { AEGISLASH_CARDS_HARD, AEGISLASH_CARDS_NIGHTMARE, AEGISLASH_CARDS_NORMAL } from './aegislash-cards';
import { DECIDUEYE_CARDS_HARD, DECIDUEYE_CARDS_NIGHTMARE, DECIDUEYE_CARDS_NORMAL } from './decidueye-cards';
import type { Trick } from './forest-tricks';
import { HOSTED_FIGHTS } from './hosted-cards';
import type { CardFightDef } from './cards';
import type { SpeciesId } from './species';

/**
 * The guardians as spell-card fights (data/cards.ts, core/cards.ts): from
 * Normal on, each tier patches in its own card list (core/tricks.ts
 * `behaviourFor` applies them in order, the hardest reached wins). Easy keeps
 * the shipped fights untouched. The six hosted bosses (data/hosted-cards.ts)
 * opt in the same way.
 */
/** A hosted boss's three fights as tricks (Normal, Hard, Nightmare; data/hosted-cards.ts). */
const hosted = ([normal, hard, nightmare]: readonly [CardFightDef, CardFightDef, CardFightDef]): readonly Trick[] => [
  { minDifficulty: 'normal', patch: { spellCards: normal } },
  { minDifficulty: 'hard', patch: { spellCards: hard } },
  { minDifficulty: 'nightmare', patch: { spellCards: nightmare } },
];

export const GUARDIAN_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  sableye: hosted(HOSTED_FIGHTS.sableye),
  trevenant: hosted(HOSTED_FIGHTS.trevenant),
  lanturn: hosted(HOSTED_FIGHTS.lanturn),
  dhelmise: hosted(HOSTED_FIGHTS.dhelmise),
  salazzle: hosted(HOSTED_FIGHTS.salazzle),
  nihilego: hosted(HOSTED_FIGHTS.nihilego),
  aegislash: [
    { minDifficulty: 'normal', patch: { spellCards: AEGISLASH_CARDS_NORMAL } },
    { minDifficulty: 'hard', patch: { spellCards: AEGISLASH_CARDS_HARD } },
    { minDifficulty: 'nightmare', patch: { spellCards: AEGISLASH_CARDS_NIGHTMARE } },
  ],
  decidueye: [
    { minDifficulty: 'normal', patch: { spellCards: DECIDUEYE_CARDS_NORMAL } },
    { minDifficulty: 'hard', patch: { spellCards: DECIDUEYE_CARDS_HARD } },
    { minDifficulty: 'nightmare', patch: { spellCards: DECIDUEYE_CARDS_NIGHTMARE } },
  ],
};
