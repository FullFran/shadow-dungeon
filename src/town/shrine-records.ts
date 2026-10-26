import type { KeyValueStore } from '../adapters/storage';
import { SHRINE_BOSSES } from '../core/shrine';
import { COINS } from '../data/coins';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { gauntletById, GAUNTLETS, type GauntletId } from '../data/shrine';
import type { SpeciesId } from '../data/species';
import { clearedDungeons, tierRecord, type Records } from './records';

/**
 * Santuario de los Juramentos records (local, like the run records): per
 * boss and per gauntlet, per tier, the clears, the best time, the best
 * captures and whether a clear was ever without a hit («Sin rasguños»).
 * Only victories are kept. Which bosses the shrine lists comes from the run
 * records instead (`beatenBosses`), so records from before the shrine need
 * no migration. Broken or hostile data reads as empty; a failing store
 * never throws.
 */
export const SHRINE_KEY = 'mazmorra-sombria.shrine';

export interface TrialBest {
  clears: number;
  bestMs: number;
  /** The most spell cards captured in one clear. */
  captures: number;
  /** Present once a clear took no hit. */
  noHit?: true;
}

type ByTier = Partial<Record<Difficulty, TrialBest>>;

export interface ShrineRecords {
  /** By boss species (`sima-herald` is never kept: heralds are by seed and not recorded). */
  bosses: Readonly<Record<string, ByTier>>;
  gauntlets: Readonly<Partial<Record<GauntletId, ByTier>>>;
}

export interface TrialResult {
  kind: 'boss' | 'gauntlet';
  /** A boss species or a gauntlet id. */
  id: string;
  difficulty: Difficulty;
  victory: boolean;
  ms: number;
  noHit: boolean;
  captures: number;
}

export const EMPTY_SHRINE: ShrineRecords = { bosses: {}, gauntlets: {} };

/**
 * The bosses beaten on this device, on any tier: a guardian once its
 * dungeon was cleared (`clearedDungeons`, old records included), a mid-boss
 * then too, or once a run reached a floor past its arena (its exit only
 * opens once it falls).
 */
export function beatenBosses(records: Records): Set<SpeciesId> {
  const cleared = clearedDungeons(records);
  const beaten = new Set<SpeciesId>();
  for (const stop of SHRINE_BOSSES) {
    const record = records.dungeons[stop.dungeon];
    const best = Math.max(record?.bestFloor ?? 0, ...DIFFICULTIES.map((d) => tierRecord(record, d)?.bestFloor ?? 0));
    if (cleared.has(stop.dungeon) || (stop.role === 'midboss' && best > stop.floor)) beaten.add(stop.boss);
  }
  return beaten;
}

export const gauntletUnlocked = (id: GauntletId, beaten: ReadonlySet<string>): boolean => gauntletById(id).bosses.every((b) => beaten.has(b));

/** Pokémonedas of a gauntlet's first clear on tier `d` (its reward times the tier's multiplier); reflections pay none. */
export const gauntletReward = (id: GauntletId, d: Difficulty): number => Math.floor(gauntletById(id).reward * COINS.difficulty[d]);

export function trialBest(records: ShrineRecords, kind: TrialResult['kind'], id: string, d: Difficulty): TrialBest | null {
  const table = kind === 'boss' ? records.bosses[id] : records.gauntlets[id as GauntletId];
  return table?.[d] ?? null;
}

const isGauntlet = (id: string): id is GauntletId => GAUNTLETS.some((g) => g.id === id);

/** Pure: the records after one more trial, and whether it was the first clear of that trial on that tier. */
export function recordTrial(records: ShrineRecords, result: TrialResult): { records: ShrineRecords; firstClear: boolean } {
  if (!result.victory || (result.kind === 'gauntlet' && !isGauntlet(result.id)) || !ID.test(result.id)) return { records, firstClear: false };
  const before = trialBest(records, result.kind, result.id, result.difficulty);
  const ms = Math.max(0, Math.round(result.ms));
  const now: TrialBest = {
    clears: (before?.clears ?? 0) + 1,
    bestMs: before ? Math.min(before.bestMs, ms) : ms,
    captures: Math.max(before?.captures ?? 0, Math.max(0, Math.floor(result.captures))),
    ...(before?.noHit || result.noHit ? { noHit: true as const } : {}),
  };
  const next =
    result.kind === 'boss'
      ? { ...records, bosses: { ...records.bosses, [result.id]: { ...records.bosses[result.id], [result.difficulty]: now } } }
      : { ...records, gauntlets: { ...records.gauntlets, [result.id]: { ...records.gauntlets[result.id as GauntletId], [result.difficulty]: now } } };
  return { records: next, firstClear: before === null };
}

const ID = /^[a-z0-9-]{1,40}$/;
const MAX_BOSSES = 32;
const count = (value: unknown, min: number): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : null);

function parseTiers(raw: unknown): ByTier | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: ByTier = {};
  for (const d of DIFFICULTIES) {
    const entry = (raw as Record<string, unknown>)[d];
    if (typeof entry !== 'object' || entry === null) continue;
    const f = entry as Record<string, unknown>;
    const clears = count(f.clears, 1);
    const bestMs = count(f.bestMs, 0);
    const captures = count(f.captures, 0);
    if (clears !== null && bestMs !== null && captures !== null) out[d] = { clears, bestMs, captures, ...(f.noHit === true ? { noHit: true as const } : {}) };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseTable(raw: unknown, valid: (id: string) => boolean): Record<string, ByTier> {
  const out: Record<string, ByTier> = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  for (const [id, entry] of Object.entries(raw).slice(0, MAX_BOSSES)) {
    const tiers = ID.test(id) && valid(id) ? parseTiers(entry) : null;
    if (tiers) out[id] = tiers;
  }
  return out;
}

export function parseShrine(raw: string | null): ShrineRecords {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    data = null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return EMPTY_SHRINE;
  const record = data as Record<string, unknown>;
  return { bosses: parseTable(record.bosses, () => true), gauntlets: parseTable(record.gauntlets, isGauntlet) };
}

export function readShrine(store: KeyValueStore): ShrineRecords {
  try {
    return parseShrine(store.get(SHRINE_KEY));
  } catch {
    return EMPTY_SHRINE;
  }
}

/** Adds one trial to the stored records; true on a first clear of it on its tier (a failing store: false, nothing kept). */
export function saveTrial(store: KeyValueStore, result: TrialResult): boolean {
  try {
    const before = readShrine(store);
    const { records, firstClear } = recordTrial(before, result);
    if (records !== before) store.set(SHRINE_KEY, JSON.stringify(records));
    return firstClear;
  } catch {
    return false;
  }
}

/** The notice board's shrine line (`shrine.board`: reflections open of all, gauntlets beaten on any tier of all); none before any boss falls. */
export function shrineBoardLine(records: ShrineRecords, beaten: ReadonlySet<string>, tr: (key: string) => string): string[] {
  if (beaten.size === 0) return [];
  const won = GAUNTLETS.filter((g) => Object.keys(records.gauntlets[g.id] ?? {}).length > 0).length;
  return [
    tr('shrine.board')
      .replace('{open}', String(SHRINE_BOSSES.filter((b) => beaten.has(b.boss)).length))
      .replace('{total}', String(SHRINE_BOSSES.length))
      .replace('{won}', String(won))
      .replace('{gauntlets}', String(GAUNTLETS.length)),
  ];
}
