import { MOVES, type MoveId } from '../data/moves';
import { M0_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { isPlayable, SPECIES, type SpeciesId } from '../data/species';
import { validateLoadout } from '../core/loadout';
import { LOCK_TYPES, type LockType } from '../core/state';
import { LANGUAGES, type Language } from '../i18n';
import type { KeyValueStore } from '../adapters/storage';

/** Player settings remembered between sessions (guest-only, local). */
export interface Settings {
  language: Language;
  /** How Shift / middle mouse lock on (toggle, hold, click only, off). */
  lockType: LockType;
  /** A left click on an enemy locks onto it (with toggle and hold; implied by click only, ignored by off). */
  clickToLock: boolean;
  /** The playable species of solo and shared runs (picked on the loadout screen). */
  species: SpeciesId;
  /** Moves of `species`, aligned with the slot layout. */
  loadout: readonly (MoveId | null)[];
  /** Volumes in 0..1; the music and sfx buses sit under the master gain. */
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

const KEY = 'mazmorra-sombria.settings';

export function defaultSettings(language: Language): Settings {
  return { language, lockType: 'toggle', clickToLock: true, species: 'mimikyu', loadout: SPECIES.mimikyu.defaultLoadout, masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.8, muted: false };
}

/** A stored volume clamped to 0..1, or the fallback when it is not a finite number. */
function volume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

/** Moves of a species' movepool that fit a slot kind. */
export function slotOptions(kind: SlotKind, species: SpeciesId = 'mimikyu'): MoveId[] {
  return SPECIES[species].movepool.filter((id) => MOVES[id].slot === kind);
}

/**
 * Reads settings, keeping each stored field only if it is valid. Unknown fields
 * are dropped; fields added later (sound) take the fallback. The old `lockMode`
 * field maps to `lockType` when that is missing (`hold` stays hold, else toggle).
 * The loadout must fit the stored species; otherwise that species' default.
 */
export function loadSettings(store: KeyValueStore, fallback: Settings): Settings {
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
  const species = isPlayable(stored.species) ? stored.species : fallback.species;
  const loadoutOk =
    Array.isArray(stored.loadout) &&
    stored.loadout.every((m) => m === null || typeof m === 'string') &&
    validateLoadout(SPECIES[species], M0_SLOT_LAYOUT, stored.loadout as (string | null)[]).length === 0;
  const loadout = loadoutOk ? (stored.loadout as (MoveId | null)[]) : species === fallback.species ? fallback.loadout : SPECIES[species].defaultLoadout;
  return {
    language,
    lockType,
    clickToLock,
    species,
    loadout,
    masterVolume: volume(stored.masterVolume, fallback.masterVolume),
    musicVolume: volume(stored.musicVolume, fallback.musicVolume),
    sfxVolume: volume(stored.sfxVolume, fallback.sfxVolume),
    muted: typeof stored.muted === 'boolean' ? stored.muted : fallback.muted,
  };
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  store.set(KEY, JSON.stringify(settings));
}
