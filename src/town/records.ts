import type { KeyValueStore } from '../adapters/storage';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';

/**
 * Local run records for the notice board. The app writes them at the end of
 * every solo or hosted run (`saveRun`); the board reads them (`readRecords`).
 * A missing, broken or hostile value reads as empty records, and a failing
 * store never throws: records are a nicety, never a reason to break the
 * result screen.
 */
export const RECORDS_KEY = 'mazmorra-sombria.records';

export interface Records {
  runs: number;
  victories: number;
  bestLevel: number | null;
  lastSpecies: string | null;
  /** Best floor reached per dungeon id (see `src/data/dungeons.ts`), and `cleared` once its guardian fell. */
  dungeons: Readonly<Record<string, DungeonRecord>>;
}

export interface DungeonRecord {
  /** Best floor on any tier (and whether its guardian ever fell): what unlocks the next dungeon. */
  bestFloor: number;
  /** Present (true) once a run of this dungeon ended in victory. */
  cleared?: true;
  /**
   * Per difficulty tier (docs/gdd.md §9): best floor and clears. Absent in
   * records written before tiers: those read as easy (`tierRecord`).
   */
  tiers?: Partial<Record<Difficulty, TierRecord>>;
}

export interface TierRecord {
  bestFloor: number;
  /** Runs of this dungeon on this tier that ended in victory. */
  clears: number;
}

/** One finished run. */
export interface RunRecord {
  dungeon: string;
  floor: number;
  level: number;
  species: string;
  victory: boolean;
  /** The run's tier; absent = a caller from before tiers (only the overall record is kept). */
  difficulty?: Difficulty;
}

export const EMPTY_RECORDS: Records = { runs: 0, victories: 0, bestLevel: null, lastSpecies: null, dungeons: {} };

/**
 * A dungeon's record on one tier. Records from before tiers know only the
 * overall best floor and `cleared`: they count as easy (one clear if cleared).
 */
export function tierRecord(record: DungeonRecord | undefined, d: Difficulty): TierRecord | null {
  if (!record) return null;
  if (record.tiers) return record.tiers[d] ?? null;
  return d === 'easy' ? { bestFloor: record.bestFloor, clears: record.cleared ? 1 : 0 } : null;
}

/** Pure: the records after one more run. */
export function recordRun(records: Records, run: RunRecord): Records {
  const previous = records.dungeons[run.dungeon];
  const best = previous?.bestFloor ?? 0;
  const cleared = run.victory || previous?.cleared === true;
  let tiers = previous?.tiers;
  if (run.difficulty) {
    // The first tiered run of an old record carries its history over as easy.
    const legacy = previous && !previous.tiers ? tierRecord(previous, 'easy') : null;
    const before = previous?.tiers?.[run.difficulty] ?? (run.difficulty === 'easy' ? legacy : null);
    const now: TierRecord = { bestFloor: Math.max(before?.bestFloor ?? 0, run.floor), clears: (before?.clears ?? 0) + (run.victory ? 1 : 0) };
    tiers = { ...(legacy ? { easy: legacy } : {}), ...(previous?.tiers ?? {}), [run.difficulty]: now };
  }
  return {
    runs: records.runs + 1,
    victories: records.victories + (run.victory ? 1 : 0),
    bestLevel: Math.max(records.bestLevel ?? 0, run.level),
    lastSpecies: run.species,
    dungeons: { ...records.dungeons, [run.dungeon]: { bestFloor: Math.max(best, run.floor), ...(cleared ? { cleared: true as const } : {}), ...(tiers ? { tiers } : {}) } },
  };
}

function parseTiers(raw: unknown): Partial<Record<Difficulty, TierRecord>> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const out: Partial<Record<Difficulty, TierRecord>> = {};
  for (const d of DIFFICULTIES) {
    const entry = (raw as Record<string, unknown>)[d];
    if (typeof entry !== 'object' || entry === null) continue;
    const fields = entry as Record<string, unknown>;
    const bestFloor = count(fields.bestFloor, 1);
    const clears = count(fields.clears, 0);
    if (bestFloor !== null && clears !== null) out[d] = { bestFloor, clears };
  }
  return Object.keys(out).length > 0 ? out : null;
}

const count = (value: unknown, min: number): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : null);
const ID = /^[a-z0-9-]{1,40}$/;
const MAX_DUNGEONS = 32;

export function parseRecords(raw: string | null): Records {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    data = null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return EMPTY_RECORDS;
  const record = data as Record<string, unknown>;
  const dungeons: Record<string, DungeonRecord> = {};
  const rawDungeons = record.dungeons;
  if (typeof rawDungeons === 'object' && rawDungeons !== null && !Array.isArray(rawDungeons)) {
    for (const [id, entry] of Object.entries(rawDungeons).slice(0, MAX_DUNGEONS)) {
      const fields = typeof entry === 'object' && entry !== null ? (entry as Record<string, unknown>) : null;
      const bestFloor = fields ? count(fields.bestFloor, 1) : null;
      const tiers = fields ? parseTiers(fields.tiers) : null;
      if (ID.test(id) && bestFloor !== null) dungeons[id] = { bestFloor, ...(fields?.cleared === true ? { cleared: true as const } : {}), ...(tiers ? { tiers } : {}) };
    }
  }
  const species = record.lastSpecies;
  return {
    runs: count(record.runs, 0) ?? 0,
    victories: count(record.victories, 0) ?? 0,
    bestLevel: count(record.bestLevel, 1),
    lastSpecies: typeof species === 'string' && ID.test(species) ? species : null,
    dungeons,
  };
}

/** The first dungeon, the only one before `cleared` was recorded. */
const FIRST_DUNGEON = 'crypt-of-the-sword-king';

/**
 * Dungeons whose guardian fell on this device. Records written before
 * `cleared` existed only know a victory count, and back then every victory
 * was in the first dungeon, so a victory there without any `cleared` flag
 * counts as clearing it.
 */
export function clearedDungeons(records: Records): Set<string> {
  const cleared = new Set(Object.entries(records.dungeons).filter(([, d]) => d.cleared === true).map(([id]) => id));
  if (cleared.size === 0 && records.victories > 0 && records.dungeons[FIRST_DUNGEON]) cleared.add(FIRST_DUNGEON);
  return cleared;
}

export function readRecords(store: KeyValueStore): Records {
  try {
    return parseRecords(store.get(RECORDS_KEY));
  } catch {
    return EMPTY_RECORDS;
  }
}

/** Adds one finished run to the stored records; any storage failure is swallowed. */
export function saveRun(store: KeyValueStore, run: RunRecord): void {
  try {
    store.set(RECORDS_KEY, JSON.stringify(recordRun(readRecords(store), run)));
  } catch {
    // Not persisted; the board just shows older records.
  }
}

/**
 * The notice board text for one dungeon (`tr` is the i18n lookup), plus a
 * best-floor line for each of the `others` (later dungeons, by translated
 * name) once a run went there.
 */
export function boardLines(
  records: Records,
  dungeon: string,
  tr: (key: string) => string,
  others: readonly { id: string; name: string }[] = [],
  tier?: { difficulty: Difficulty; name: string },
): string[] {
  if (records.runs === 0) return [tr('town.board.title'), tr('town.board.none')];
  // With a tier (the one picked now), floors and clears are that tier's.
  const bestOf = (id: string): number | undefined => (tier ? tierRecord(records.dungeons[id], tier.difficulty)?.bestFloor : records.dungeons[id]?.bestFloor);
  const floor = bestOf(dungeon);
  const elsewhere = others.flatMap((o) => {
    const best = bestOf(o.id);
    return best === undefined ? [] : [tr('town.board.bestIn').replace('{dungeon}', o.name).replace('{floor}', String(best))];
  });
  const tierParts = tier
    ? [tr('town.board.tier').replace('{tier}', tier.name), tr('town.board.clears').replace('{clears}', String(tierRecord(records.dungeons[dungeon], tier.difficulty)?.clears ?? 0))]
    : [];
  const parts = [
    ...tierParts,
    tr('town.board.best').replace('{floor}', floor === undefined ? '-' : String(floor)),
    ...elsewhere,
    tr('town.board.runs').replace('{runs}', String(records.runs)),
    tr('town.board.victories').replace('{wins}', String(records.victories)),
    tr('town.board.level').replace('{level}', records.bestLevel === null ? '-' : String(records.bestLevel)),
  ];
  return [`${tr('town.board.title')} ${parts.join(' · ')}`];
}
