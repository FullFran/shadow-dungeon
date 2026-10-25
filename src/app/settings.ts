import { MOVES, type MoveId } from '../data/moves';
import { M0_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { SPECIES } from '../data/species';
import { validateLoadout } from '../core/loadout';
import { LANGUAGES, type Language } from '../i18n';
import type { KeyValueStore } from '../adapters/storage';

/** Player settings remembered between sessions (guest-only, local). */
export interface Settings {
  language: Language;
  /** A left click on an enemy locks onto it. */
  clickToLock: boolean;
  loadout: readonly (MoveId | null)[];
}

const KEY = 'mazmorra-sombria.settings';

export function defaultSettings(language: Language): Settings {
  return { language, clickToLock: true, loadout: SPECIES.mimikyu.defaultLoadout };
}

/** Moves of Mimikyu's movepool that fit a slot kind. */
export function slotOptions(kind: SlotKind): MoveId[] {
  return SPECIES.mimikyu.movepool.filter((id) => MOVES[id].slot === kind);
}

/** Reads settings, keeping each stored field only if it is valid. Unknown fields (the old `lockMode`) are dropped. */
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
  const clickToLock = typeof stored.clickToLock === 'boolean' ? stored.clickToLock : fallback.clickToLock;
  const loadoutOk =
    Array.isArray(stored.loadout) &&
    stored.loadout.every((m) => m === null || typeof m === 'string') &&
    validateLoadout(SPECIES.mimikyu, M0_SLOT_LAYOUT, stored.loadout as (string | null)[]).length === 0;
  const loadout = loadoutOk ? (stored.loadout as (MoveId | null)[]) : fallback.loadout;
  return { language, clickToLock, loadout };
}

export function saveSettings(store: KeyValueStore, settings: Settings): void {
  store.set(KEY, JSON.stringify(settings));
}
