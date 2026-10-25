import { DEFAULT_DIFFICULTY, type Difficulty } from '../data/difficulty';
import type { WorldState } from './state';

/** The run's difficulty tier; worlds created before tiers existed are `easy`. */
export const worldDifficulty = (state: Pick<WorldState, 'difficulty'>): Difficulty => state.difficulty ?? DEFAULT_DIFFICULTY;
