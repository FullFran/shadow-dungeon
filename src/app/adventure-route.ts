import type { Records } from '../town/records';
import type { SaveData } from './save';
import { CRYPT } from '../data/dungeons';

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

/**
 * The screens "Play" on the title goes through: the first-time prologue and
 * quiz, then the town (the hub is where every run starts), or the Crypt while
 * the town is still closed (odd/tasks/menu-redesign.md S7: like a souls, the
 * first dungeon comes before the hub).
 */
export type PlayScreen = 'prologue' | 'quiz' | 'town' | 'crypt';

/** Where the title's "Play" goes next: the same first-time steps as a new adventure, then the town, or the Crypt until `townOpen`. */
export function nextPlayScreen(progress: AdventureProgress & { townOpen: boolean }): PlayScreen {
  const next = nextAdventureScreen(progress);
  if (next !== 'loadout') return next;
  return progress.townOpen ? 'town' : 'crypt';
}

/** The parts of the save only the town can grow (a purchase, a learned move, a gacha species, a Senda chapter). */
export type TownTraces = Pick<SaveData, 'owned' | 'upgrades' | 'learned' | 'story'>;

/**
 * Whether the town is open: once the Crypt's guardian has fallen, or for a
 * player who already used the town before it opened this way (anything in
 * the save that only the town gives), so nobody who played earlier versions
 * is locked out of it.
 */
export function townOpen(cleared: ReadonlySet<string>, save: TownTraces): boolean {
  const some = (o: object | undefined): boolean => o !== undefined && Object.values(o).some((v) => (typeof v === 'number' ? v > 0 : Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null));
  return cleared.has(CRYPT.id) || (save.owned?.length ?? 0) > 0 || some(save.upgrades) || some(save.learned) || some(save.story);
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
