import { UPGRADE_IDS, UPGRADES, type UpgradeId, type UpgradeLevels } from '../data/upgrades';
import type { StarterId } from '../data/learnsets';
import type { MoveId } from '../data/moves';
import { originalKit, PLAYABLE_SPECIES } from '../data/species';
import { MAX_RANK, TUTOR_OFFER } from '../data/tutor';
import type { LearnedMoves, RankedMoves } from '../core/tutor';
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
/** 2: the move tutor's learned moves and Mejoras (odd/tasks/movepools.md); a v1 save reads with none. */
export const SAVE_VERSION = 2;

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  upgrades: UpgradeLevels;
  /** Moves bought at the move tutor, per starter (absent = none). */
  learned?: LearnedMoves;
  /** Mejoras of original moves, per starter (absent = none). */
  ranks?: RankedMoves;
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
  // v1 -> v2: nothing learned yet (the new fields are optional).
  if (version === 1) return { ...raw, version: 2 };
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
  const learned = sanitizeLearned(raw.learned);
  const ranks = sanitizeRanks(raw.ranks);
  return { version: SAVE_VERSION, coins, upgrades, ...(learned ? { learned } : {}), ...(ranks ? { ranks } : {}) };
}

const STARTERS = PLAYABLE_SPECIES as readonly StarterId[];

/** Learned moves: per starter, only moves the tutor teaches it, once each, in shop order; null when none. */
function sanitizeLearned(raw: unknown): LearnedMoves | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<StarterId, MoveId[]>> = {};
  for (const id of STARTERS) {
    const list = raw[id];
    if (!Array.isArray(list)) continue;
    const moves = TUTOR_OFFER[id].filter((m) => list.includes(m));
    if (moves.length > 0) out[id] = moves;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Mejoras: per starter, whole ranks 1..MAX_RANK of its original moves only; null when none. */
function sanitizeRanks(raw: unknown): RankedMoves | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<StarterId, Partial<Record<MoveId, number>>>> = {};
  for (const id of STARTERS) {
    const table = raw[id];
    if (!isRecord(table)) continue;
    const ranks: Partial<Record<MoveId, number>> = {};
    for (const move of originalKit(id)) {
      const rank = table[move];
      if (typeof rank === 'number' && Number.isInteger(rank) && rank > 0) ranks[move] = Math.min(rank, MAX_RANK);
    }
    if (Object.keys(ranks).length > 0) out[id] = ranks;
  }
  return Object.keys(out).length > 0 ? out : null;
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
