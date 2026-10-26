import { UPGRADE_IDS, UPGRADES, type UpgradeId, type UpgradeLevels } from '../data/upgrades';
import type { MoveId } from '../data/moves';
import { isPlayable, isStarter, originalKit, PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, tutorOffer } from '../data/tutor';
import { lineOf } from '../core/evolution';
import type { Materials } from '../core/collection';
import { awakeningsOf, MATERIAL_TIERS } from '../data/player-evolutions';
import { challengeReward } from '../core/challenge';
import type { DungeonDef } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import type { LearnedMoves, RankedMoves } from '../core/tutor';
import type { KeyValueStore } from '../adapters/storage';
import { ACHIEVEMENTS } from '../data/achievements';
import { MISSIONS } from '../data/missions';
import { missionById, type MissionState } from '../core/missions';

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
 *    Since odd/tasks/roster-parity.md (same version, optional fields only): `owned` also holds evolved
 *    starters, `materials` the starters' lines, and `awakened` Mimikyu's awakening steps.
 * 4: achievements, lifetime Pokémonedas and missions (odd/tasks/achievements-missions.md); a v3 save reads with none.
 */
export const SAVE_VERSION = 4;

export interface SaveData {
  version: typeof SAVE_VERSION;
  coins: number;
  upgrades: UpgradeLevels;
  /** Moves bought at the move tutor, per species (absent = none). */
  learned?: LearnedMoves;
  /** Mejoras of any move, per species (absent = none). */
  ranks?: RankedMoves;
  /** Gacha species and evolved starters, as their current form (absent = none; core/collection.ts). */
  owned?: SpeciesId[];
  /** Awakening steps of the species that never evolve (absent = none; data/player-evolutions.ts `PLAYER_AWAKENINGS`). */
  awakened?: Partial<Record<SpeciesId, number>>;
  /** Evolution materials per line and tier (absent = none). */
  materials?: Partial<Record<SpeciesId, Materials>>;
  /** Gacha pulls since the last rare (absent = 0). */
  pity?: number;
  /** Unlocked achievements: id -> UTC day (absent = none; core/achievements.ts). */
  achievements?: Record<string, string>;
  /** Pokémonedas earned in total, spending aside (absent = 0). */
  earned?: number;
  /** The notice board's missions: accepted with their progress, and claimed (absent = none; core/missions.ts). */
  missions?: MissionState;
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
  // v1 -> v2 -> v3 -> v4: nothing learned, owned or unlocked yet (the new fields are optional).
  if (version === 1 || version === 2 || version === 3) return { ...raw, version: SAVE_VERSION };
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
  const awakened = sanitizeAwakened(raw.awakened);
  const pity = wholeCount(raw.pity);
  const achievements = sanitizeAchievements(raw.achievements);
  const earned = wholeCount(raw.earned);
  const missions = sanitizeMissions(raw.missions);
  return {
    version: SAVE_VERSION,
    coins,
    upgrades,
    ...(learned ? { learned } : {}),
    ...(ranks ? { ranks } : {}),
    ...(owned ? { owned } : {}),
    ...(materials ? { materials } : {}),
    ...(awakened ? { awakened } : {}),
    ...(pity > 0 ? { pity } : {}),
    ...(achievements ? { achievements } : {}),
    ...(earned > 0 ? { earned } : {}),
    ...(missions ? { missions } : {}),
  };
}

/**
 * Missions: accepted ones that name a real mission, once each, with whole
 * progress up to its target, at most the board's limit; claimed ones that
 * name a real mission, once each, the latest kept. Expiry is the board's
 * business (core/missions.ts `pruneMissions`, it needs the clock). Null when none.
 */
function sanitizeMissions(raw: unknown): MissionState | null {
  if (!isRecord(raw)) return null;
  const accepted: { id: string; progress: number }[] = [];
  for (const entry of Array.isArray(raw.accepted) ? raw.accepted : []) {
    if (accepted.length >= MISSIONS.maxAccepted) break;
    if (!isRecord(entry) || typeof entry.id !== 'string' || accepted.some((a) => a.id === entry.id)) continue;
    const mission = missionById(entry.id);
    if (mission) accepted.push({ id: mission.id, progress: Math.min(mission.target, wholeCount(entry.progress)) });
  }
  const claimed: string[] = [];
  for (const id of Array.isArray(raw.claimed) ? raw.claimed : []) if (typeof id === 'string' && !claimed.includes(id) && missionById(id)) claimed.push(id);
  if (accepted.length === 0 && claimed.length === 0) return null;
  return { accepted, claimed: claimed.slice(-MISSIONS.maxClaimed) };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Achievements: known ids with a YYYY-MM-DD day, in list order; null when none. */
function sanitizeAchievements(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const out: Record<string, string> = {};
  for (const def of ACHIEVEMENTS) {
    if (!Object.hasOwn(raw, def.id)) continue;
    const date = raw[def.id];
    if (typeof date === 'string' && DATE_KEY.test(date)) out[def.id] = date;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** A whole, non-negative, safe count (anything else is 0). */
const wholeCount = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : 0);

/** A species `owned` can hold: a playable one that is not a starter (a gacha form or an evolved starter). */
const isOwnable = (id: unknown): id is SpeciesId => isPlayable(id) && !isStarter(id);

/** Owned species: gacha forms and evolved starters, one form per line (the first stored), in the order stored; null when none. */
function sanitizeOwned(raw: unknown): SpeciesId[] | null {
  if (!Array.isArray(raw)) return null;
  const owned: SpeciesId[] = [];
  for (const id of raw.filter(isOwnable)) if (!owned.some((o) => lineOf(o) === lineOf(id))) owned.push(id);
  return owned.length > 0 ? owned : null;
}

/** Awakening steps: whole, 1 up to the species' steps, of species that awaken; null when none. */
function sanitizeAwakened(raw: unknown): Partial<Record<SpeciesId, number>> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<SpeciesId, number>> = {};
  for (const id of PLAYABLE_SPECIES) {
    const steps = awakeningsOf(id).length;
    const n = wholeCount(raw[id]);
    if (steps > 0 && n > 0) out[id] = Math.min(n, steps);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Materials: keyed by a line's first form (a gacha line's or a starter's),
 * whole positive counts per tier; null when none. An early v3 save kept one flat count per line: it
 * reads as Normal materials.
 */
function sanitizeMaterials(raw: unknown): Partial<Record<SpeciesId, Materials>> | null {
  if (!isRecord(raw)) return null;
  const out: Partial<Record<SpeciesId, Materials>> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (!isPlayable(id) || lineOf(id) !== id) continue;
    const tiers = isRecord(value) ? value : { normal: value };
    const counts: Partial<Record<(typeof MATERIAL_TIERS)[number], number>> = {};
    for (const tier of MATERIAL_TIERS) if (wholeCount(tiers[tier]) > 0) counts[tier] = wholeCount(tiers[tier]);
    if (Object.keys(counts).length > 0) out[id] = counts;
  }
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

/** Adds a run's coins (negative amounts count as 0) to the stored balance and the lifetime count, and returns the new save. */
export function earnCoins(store: KeyValueStore, amount: number): SaveData {
  const save = loadSave(store);
  const gain = Math.max(0, Math.floor(amount));
  const next = sanitize({ ...save, coins: save.coins + gain, earned: (save.earned ?? 0) + gain });
  writeSave(store, next);
  return next;
}

/** Pays a run's challenge materials (core/challenge.ts) into the stored save and returns it; any other run changes nothing. */
export function earnChallengeReward(store: KeyValueStore, dungeon: DungeonDef, victory: boolean, difficulty: Difficulty): SaveData {
  const save = loadSave(store);
  const next = challengeReward(save, dungeon, victory, difficulty);
  if (next !== save) writeSave(store, next);
  return next;
}
