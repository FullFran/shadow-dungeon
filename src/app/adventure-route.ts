/** The screens a new adventure goes through before the run. */
export type AdventureScreen = 'prologue' | 'quiz' | 'loadout';

export interface AdventureProgress {
  /** The prologue cinematic was seen (or skipped) in this browser. */
  prologueSeen: boolean;
  /** The personality quiz picked the starter (stored as the `species` setting). */
  starterChosen: boolean;
}

/**
 * Where "Play" goes next: the prologue the first time, then the quiz while no
 * starter is chosen, then the loadout. Called again after each step, so a
 * finished prologue leads to the quiz and a finished quiz to the loadout.
 */
export function nextAdventureScreen(progress: AdventureProgress): AdventureScreen {
  if (!progress.prologueSeen) return 'prologue';
  if (!progress.starterChosen) return 'quiz';
  return 'loadout';
}
