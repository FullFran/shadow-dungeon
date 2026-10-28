import type { FigurationMode } from '../adapters/figurations';
import { sanitizeNickname } from '../net/nickname';
import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { isPlayable, SPECIES, STARTER_SPECIES, type SpeciesId } from '../data/species';
import { lineRoot, PLAYER_EVOLUTIONS } from '../data/player-evolutions';
import { padLoadout, validateLoadout } from '../core/loadout';
import { NEW_PLAYER_DIFFICULTY, isDifficulty, type Difficulty } from '../data/difficulty';
import { LOCK_TYPES, type LockType } from '../core/state';
import { LANGUAGES, type Language } from '../i18n';
import type { KeyValueStore } from '../adapters/storage';
import { TOUCH_MODES, type TouchMode, type TouchPrefs } from '../adapters/touch-mode';
import { TOUCH_SCALES } from '../ui/touch-layout';

/** Player settings remembered between sessions (guest-only, local). */
export interface Settings {
  language: Language;
  /** How Shift / middle mouse lock on (toggle, hold, click only, off). */
  lockType: LockType;
  /** A left click on an enemy locks onto it (with toggle and hold; implied by click only, ignored by off). */
  clickToLock: boolean;
  /** The playable species of solo and shared runs: the quiz's starter, changeable on the loadout screen. */
  species: SpeciesId;
  /** The personality quiz has picked the starter (until then the first Play runs the quiz). */
  starterChosen: boolean;
  /** Moves of `species`, aligned with the slot layout. */
  loadout: readonly (MoveId | null)[];
  /** Volumes in 0..1; the music and sfx buses sit under the master gain. */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  /** Touch UI: Auto (on after the first touch), On or Off. */
  touchMode: TouchMode;
  /** Touch only: with nothing locked, moves aim at the nearest enemy in a cone in front. */
  autoAim: boolean;
  /** Touch only: short vibrations on a hit taken and on a perfect dodge. */
  haptics: boolean;
  /** Touch only: button size (a `TOUCH_SCALES` step), opacity (a `TOUCH_OPACITIES` step) and the mirrored left-handed layout (src/ui/touch-layout.ts). */
  touchSize: number;
  touchOpacity: number;
  touchLeftHanded: boolean;
  /** Shown over this player in online rooms (src/net/nickname.ts); empty uses "Jugador-XYZ". */
  nickname: string;
  /** The last difficulty tier picked (solo, and the host's for a room); normal for new players (data/difficulty.ts). */
  difficulty: Difficulty;
  /** The Sima's figuraciones (adapters/figurations.ts): on, reduced (rarer, fainter, still) or off. Reduced motion turns «on» down to reduced. */
  figurations: FigurationMode;
}

/** The figuraciones settings, in the order the row cycles them. */
export const FIGURATION_MODES: readonly FigurationMode[] = ['on', 'reduced', 'off'];

const KEY = 'mazmorra-sombria.settings';

/** Touch button opacities offered in the settings. */
export const TOUCH_OPACITIES = [0.5, 0.75, 1] as const;

/** The touch layout preferences of these settings (src/adapters/touch-mode.ts `setTouchPrefs`). */
export const touchPrefsOf = (s: Pick<Settings, 'touchSize' | 'touchOpacity' | 'touchLeftHanded'>): TouchPrefs => ({ scale: s.touchSize, opacity: s.touchOpacity, leftHanded: s.touchLeftHanded });

/** A stored value only when it is one of `choices`. */
const offered = (value: unknown, choices: readonly number[], fallback: number): number => (typeof value === 'number' && choices.includes(value) ? value : fallback);

export function defaultSettings(language: Language): Settings {
  return { language, lockType: 'toggle', clickToLock: true, species: 'mimikyu', starterChosen: false, loadout: SPECIES.mimikyu.defaultLoadout, masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.8, muted: false, touchMode: 'auto', autoAim: true, haptics: true, touchSize: 1, touchOpacity: 1, touchLeftHanded: false, nickname: '', difficulty: NEW_PLAYER_DIFFICULTY, figurations: 'on' };
}

/** A stored volume clamped to 0..1, or the fallback when it is not a finite number. */
function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

/** Moves of a species' movepool that fit a slot kind; with `known`, only those (the learned ones, app/tutor.ts). */
export function slotOptions(kind: SlotKind, species: SpeciesId = 'mimikyu', known?: readonly MoveId[]): MoveId[] {
  return SPECIES[species].movepool.filter((id) => MOVES[id].slot === kind && (!known || known.includes(id)));
}

/** The settings with `species` picked: another species comes with its default loadout, the same one keeps the current moves. */
export function withSpecies(settings: Settings, species: SpeciesId): Settings {
  return species === settings.species ? settings : { ...settings, species, loadout: SPECIES[species].defaultLoadout };
}

/** The settings after the personality quiz: its starter becomes the species (see `withSpecies`) and counts as chosen. */
export function withStarter(settings: Settings, species: SpeciesId): Settings {
  return { ...withSpecies(settings, species), starterChosen: true };
}

/** Evolution steps from the first form of its player line (0 for a first form or a species outside a line). */
function lineDepth(species: SpeciesId): number {
  let depth = 0;
  for (let current = species; depth <= PLAYER_EVOLUTIONS.length; depth++) {
    const into = PLAYER_EVOLUTIONS.find((e) => e.to === current);
    if (!into) return depth;
    current = into.from;
  }
  return depth;
}

/**
 * The form of the species last played that the player has now: itself when
 * it is in `roster`, else the furthest form of its evolution line there
 * (it evolved since; Mimikyu awakens keeping its id). Null for no species,
 * an unknown one, or a line the roster lacks.
 */
export function lastPlayedForm(lastSpecies: string | null, roster: readonly SpeciesId[]): SpeciesId | null {
  if (!isPlayable(lastSpecies)) return null;
  if (roster.includes(lastSpecies)) return lastSpecies;
  const line = roster.filter((id) => lineRoot(id) === lineRoot(lastSpecies));
  return line.reduce<SpeciesId | null>((best, id) => (best === null || lineDepth(id) > lineDepth(best) ? id : best), null);
}

/**
 * A returning player (the profile shows progress, `hasProgress`) on a device
 * without a chosen starter: the starter counts as chosen, so the quiz never
 * runs nor overwrites its species; the species it last played is picked in
 * the form the player has now (`lastPlayedForm`), else the current one
 * stays. A chosen starter is kept.
 */
export function withReturningPlayer(settings: Settings, lastSpecies: string | null, roster: readonly SpeciesId[]): Settings {
  if (settings.starterChosen) return settings;
  const last = lastPlayedForm(lastSpecies, roster);
  return { ...(last ? withSpecies(settings, last) : settings), starterChosen: true };
}

/**
 * Reads settings, keeping each stored field only if it is valid. Unknown fields
 * are dropped; fields added later (sound) take the fallback. The old `lockMode`
 * field maps to `lockType` when that is missing (`hold` stays hold, else toggle).
 * The loadout must fit the stored species; otherwise that species' default.
 * The species must be in `roster` (the starters and the owned gacha species,
 * core/collection.ts `rosterOf`); otherwise its line's form in the roster
 * (it evolved), else the fallback's.
 */
export function loadSettings(store: KeyValueStore, fallback: Settings, roster: readonly SpeciesId[] = STARTER_SPECIES): Settings {
  let raw: unknown;
  try {
    raw = JSON.parse(store.get(KEY) ?? 'null');
  } catch {
    return fallback;
  }
  if (typeof raw !== 'object' || raw === null) return fallback;
  const stored = raw as Partial<Record<keyof Settings, unknown>>;
  const language = LANGUAGES.find((l) => l === stored.language) ?? fallback.language;
  const legacy = (raw as { lockMode?: unknown }).lockMode === 'hold' ? 'hold' : 'toggle';
  const lockType = LOCK_TYPES.find((l) => l === stored.lockType) ?? (stored.lockType === undefined && 'lockMode' in raw ? legacy : fallback.lockType);
  const clickToLock = typeof stored.clickToLock === 'boolean' ? stored.clickToLock : fallback.clickToLock;
  // A form the player no longer has (it evolved meanwhile) gives way to its line's current form.
  const sameLine = isPlayable(stored.species) ? roster.find((id) => lineRoot(id) === lineRoot(stored.species as SpeciesId)) : undefined;
  const species = isPlayable(stored.species) && roster.includes(stored.species) ? stored.species : (sameLine ?? fallback.species);
  // A save from before four-slots holds two moves: the new slots take the species defaults.
  const storedLoadout =
    Array.isArray(stored.loadout) && stored.loadout.every((m) => m === null || typeof m === 'string')
      ? padLoadout(SPECIES[species], stored.loadout as (MoveId | null)[])
      : null;
  const loadoutOk = storedLoadout !== null && validateLoadout(SPECIES[species], PLAYER_SLOT_LAYOUT, storedLoadout).length === 0;
  const loadout = loadoutOk ? storedLoadout : padLoadout(SPECIES[species], species === fallback.species ? fallback.loadout : SPECIES[species].defaultLoadout);
  return {
    language,
    lockType,
    clickToLock,
    species,
    starterChosen: typeof stored.starterChosen === 'boolean' ? stored.starterChosen : fallback.starterChosen,
    loadout,
    masterVolume: volume(stored.masterVolume, fallback.masterVolume),
    musicVolume: volume(stored.musicVolume, fallback.musicVolume),
    sfxVolume: volume(stored.sfxVolume, fallback.sfxVolume),
    muted: typeof stored.muted === 'boolean' ? stored.muted : fallback.muted,
    touchMode: TOUCH_MODES.find((m) => m === stored.touchMode) ?? fallback.touchMode,
    autoAim: typeof stored.autoAim === 'boolean' ? stored.autoAim : fallback.autoAim,
    haptics: typeof stored.haptics === 'boolean' ? stored.haptics : fallback.haptics,
    touchSize: offered(stored.touchSize, TOUCH_SCALES, fallback.touchSize),
    touchOpacity: offered(stored.touchOpacity, TOUCH_OPACITIES, fallback.touchOpacity),
    touchLeftHanded: typeof stored.touchLeftHanded === 'boolean' ? stored.touchLeftHanded : fallback.touchLeftHanded,
    nickname: typeof stored.nickname === 'string' ? sanitizeNickname(stored.nickname) : fallback.nickname,
    difficulty: isDifficulty(stored.difficulty) ? stored.difficulty : fallback.difficulty,
    figurations: FIGURATION_MODES.find((m) => m === stored.figurations) ?? fallback.figurations,
  };
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  store.set(KEY, JSON.stringify(settings));
}
