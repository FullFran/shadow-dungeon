import { AEGISLASH_CARDS_HARD, AEGISLASH_CARDS_NIGHTMARE, AEGISLASH_CARDS_NORMAL } from './aegislash-cards';
import type { Trick } from './forest-tricks';
import type { SpeciesId } from './species';

/**
 * The guardians as spell-card fights (data/cards.ts, core/cards.ts): from
 * Normal on, each tier patches in its own card list (core/tricks.ts
 * `behaviourFor` applies them in order, the hardest reached wins). Easy keeps
 * the shipped fights untouched.
 */
export const GUARDIAN_TRICKS: Partial<Record<SpeciesId, readonly Trick[]>> = {
  aegislash: [
    { minDifficulty: 'normal', patch: { spellCards: AEGISLASH_CARDS_NORMAL } },
    { minDifficulty: 'hard', patch: { spellCards: AEGISLASH_CARDS_HARD } },
    { minDifficulty: 'nightmare', patch: { spellCards: AEGISLASH_CARDS_NIGHTMARE } },
  ],
};
