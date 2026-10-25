import { UPGRADE_IDS, UPGRADES, type UpgradeId, type UpgradeLevels } from '../data/upgrades';
import type { KeyValueStore } from '../adapters/storage';

/**
 * The save facade (docs/gdd.md §12): one versioned local save for what
 * survives a run, the Pokémonedas balance and the owned upgrade levels.
 * Reading goes JSON -> `migrate()` (older versions to the current one) ->
 * `sanitize()` (only known, valid fields survive), so a missing, broken,
 * hostile or newer value reads as a usable save and a failing store never
 * throws: a lost write only costs that write. Settings and the notice board
 * records keep their own keys (they predate the facade; see
 * odd/tasks/meta-pokemonedas.md).
 */
export const SAVE_KEY = 'mazmorra-sombria.save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  upgrades: UpgradeLevels;
}

export const EMPTY_SAVE: SaveData = { version: SAVE_VERSION, coins: 0, upgrades: {} };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Brings stored data to the current version. Version 0 is any object without
 * a `version` (no game ever wrote one, but it costs nothing to accept it).
 * Non-objects become null; versions from a newer game are kept as they are
 * and sanitized best-effort.
 */
export function migrate(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;
  const version = raw.version;
  if (version === undefined) return { ...raw, version: SAVE_VERSION };
  return raw;
}

/** Keeps only valid fields: whole non-negative coins, known upgrades with a whole level clamped to their table. */
export function sanitize(raw: unknown): SaveData {
  if (!isRecord(raw)) return EMPTY_SAVE;
  const coins = typeof raw.coins === 'number' && Number.isFinite(raw.coins) && raw.coins > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(raw.coins)) : 0;
  const upgrades: Partial<Record<UpgradeId, number>> = {};
  if (isRecord(raw.upgrades)) {
    for (const id of UPGRADE_IDS) {
      const level = raw.upgrades[id];
      if (typeof level === 'number' && Number.isInteger(level) && level > 0) upgrades[id] = Math.min(level, UPGRADES[id].costs.length);
    }
  }
  return { version: SAVE_VERSION, coins, upgrades };
}

/** Parses a stored string (null, broken JSON and anything else read as empty). */
export function parseSave(text: string | null): SaveData {
  try {
    return sanitize(migrate(JSON.parse(text ?? 'null')));
  } catch {
    return EMPTY_SAVE;
  }
}

export function loadSave(store: KeyValueStore): SaveData {
  try {
    return parseSave(store.get(SAVE_KEY));
  } catch {
    return EMPTY_SAVE;
  }
}

/** Writes the save; any storage failure is swallowed (the game goes on with the in-memory save). */
export function writeSave(store: KeyValueStore, save: SaveData): void {
  try {
    store.set(SAVE_KEY, JSON.stringify(sanitize(save)));
  } catch {
    // Not persisted.
  }
}

/** Adds a run's coins (negative amounts count as 0) to the stored balance and returns the new save. */
export function earnCoins(store: KeyValueStore, amount: number): SaveData {
  const save = loadSave(store);
  const next = sanitize({ ...save, coins: save.coins + Math.max(0, Math.floor(amount)) });
  writeSave(store, next);
  return next;
}
