import type { Records } from '../town/records';
import type { SaveData } from './save';

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

/** The screens "Play" on the title goes through: the first-time prologue and quiz, then the town (the hub is where every run starts). */
export type PlayScreen = 'prologue' | 'quiz' | 'town';

/** Where the title's "Play" goes next: the same first-time steps as a new adventure, then the town instead of the loadout. */
export function nextPlayScreen(progress: AdventureProgress): PlayScreen {
  const next = nextAdventureScreen(progress);
  return next === 'loadout' ? 'town' : next;
}

/** The screens the title's "Play online" goes through: the same first-time steps, so nobody reaches a room without a starter. */
export type OnlineScreen = 'prologue' | 'quiz' | 'online';

export function nextOnlineScreen(progress: AdventureProgress): OnlineScreen {
  const next = nextAdventureScreen(progress);
  return next === 'loadout' ? 'online' : next;
}

/**
 * Whether this profile already played (the save and records, which travel
 * with the cloud profile): any run, Pokémonedas, an owned species, a Senda
 * chapter, an upgrade, a learned move or an achievement. The prologue flag
 * and the chosen starter live on the device only, so an account signed in on
 * a new device would otherwise redo the prologue and the quiz, and the quiz
 * would overwrite its species.
 */
export function hasProgress(save: SaveData, records: Pick<Records, 'runs' | 'victories'>): boolean {
  const some = (o: object | undefined): boolean => o !== undefined && Object.values(o).some((v) => (typeof v === 'number' ? v > 0 : v !== undefined && v !== null));
  return (
    records.runs > 0 ||
    records.victories > 0 ||
    save.coins > 0 ||
    (save.earned ?? 0) > 0 ||
    (save.owned?.length ?? 0) > 0 ||
    some(save.story) ||
    some(save.upgrades) ||
    some(save.learned) ||
    some(save.achievements)
  );
}
