/**
 * Difficulty tiers (docs/gdd.md §9). The host picks one for the whole group.
 * `easy` is the balance the game shipped with; harder tiers add attacks and
 * longer combos on top of stat changes. Content gates extra patterns with
 * `minDifficulty` and reads the current tier through `atLeast`.
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

export const DEFAULT_DIFFICULTY: Difficulty = 'easy';

export const difficultyRank = (d: Difficulty): number => DIFFICULTIES.indexOf(d);

/** True when `current` is `min` or harder. */
export const atLeast = (current: Difficulty, min: Difficulty): boolean => difficultyRank(current) >= difficultyRank(min);

export const isDifficulty = (value: unknown): value is Difficulty => DIFFICULTIES.some((d) => d === value);
