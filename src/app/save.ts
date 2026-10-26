import { UPGRADE_IDS, UPGRADES, type UpgradeId, type UpgradeLevels } from '../data/upgrades';
import type { MoveId } from '../data/moves';
import { isPlayable, isStarter, originalKit, PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, tutorOffer } from '../data/tutor';
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
/**
 * 2: the move tutor's learned moves and Mejoras (odd/tasks/movepools.md); a v1 save reads with none.
 * 3: the gacha collection (odd/tasks/gacha-evolutions.md): owned species, materials, pity; a v2 save reads with none.
 */
export const SAVE_VERSION = 3;

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  upgrades: UpgradeLevels;
  /** Moves bought at the move tutor, per species (absent = none). */
  learned?: LearnedMoves;
  /** Mejoras of any move, per species (absent = none). */
  ranks?: RankedMoves;
  /** Gacha species, as their current form (absent = none; core/collection.ts). */
  owned?: SpeciesId[];
  /** Evolution materials per line (absent = none). */
  materials?: Partial<Record<SpeciesId, number>>;
  /** Gacha pulls since the last rare (absent = 0). */
  pity?: number;
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
  // v1 -> v2 -> v3: nothing learned or owned yet (the new fields are optional).
  if (version === 1 || version === 2) return { ...raw, version: SAVE_VERSION };
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
  const owned = sanitizeOwned(raw.owned);
  const materials = sanitizeMaterials(raw.materials);
  const pity = wholeCount(raw.pity);
  return {
    version: SAVE_VERSION,
    coins,
    upgrades,
    ...(learned ? { learned } : {}),
    ...(ranks ? { ranks } : {}),
    ...(owned ? { owned } : {}),
    ...(materials ? { materials } : {}),
    ...(pity > 0 ? { pity } : {}),
  };
}

/** A whole, non-negative, safe count (anything else is 0). */
const wholeCount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0);

/** A species the gacha can give (a playable one that is not a starter). */
const isGacha = (id: unknown): id is SpeciesId => isPlayable(id) && !isStarter(id);

/** Owned species: gacha species only, once each, in the order stored; null when none. */
function sanitizeOwned(raw: unknown): SpeciesId[] | null {
  if (!Array.isArray(raw)) return null;
  const owned = [...new Set(raw.filter(isGacha))];
  return owned.length > 0 ? owned : null;
}

/** Materials: whole positive counts of gacha species' lines; null when none. */
function sanitizeMaterials(raw: unknown): Partial<Record<SpeciesId, number>> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<SpeciesId, number>> = {};
  for (const [id, count] of Object.entries(raw)) if (isGacha(id) && wholeCount(count) > 0) out[id] = wholeCount(count);
  return Object.keys(out).length > 0 ? out : null;
}

/** Learned moves: per species, only moves the tutor teaches it, once each, in shop order; null when none. */
function sanitizeLearned(raw: unknown): LearnedMoves | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<SpeciesId, MoveId[]>> = {};
  for (const id of PLAYABLE_SPECIES) {
    const list = raw[id];
    if (!Array.isArray(list)) continue;
    const moves = tutorOffer(id).filter((m) => list.includes(m));
    if (moves.length > 0) out[id] = moves;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Mejoras: per species, whole ranks 1..MAX_RANK of moves it can know; null when none. */
function sanitizeRanks(raw: unknown): RankedMoves | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<SpeciesId, Partial<Record<MoveId, number>>>> = {};
  for (const id of PLAYABLE_SPECIES) {
    const table = raw[id];
    if (!isRecord(table)) continue;
    const ranks: Partial<Record<MoveId, number>> = {};
    // Any move the species can know (its kit and the tutor's offer): every move can be ranked (move-progression).
    for (const move of [...originalKit(id), ...tutorOffer(id)]) {
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
