import type { KeyValueStore } from '../adapters/storage';

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
  bestFloor: number;
  /** Present (true) once a run of this dungeon ended in victory. */
  cleared?: true;
}

/** One finished run. */
export interface RunRecord {
  dungeon: string;
  floor: number;
  level: number;
  species: string;
  victory: boolean;
}

export const EMPTY_RECORDS: Records = { runs: 0, victories: 0, bestLevel: null, lastSpecies: null, dungeons: {} };

/** Pure: the records after one more run. */
export function recordRun(records: Records, run: RunRecord): Records {
  const previous = records.dungeons[run.dungeon];
  const best = previous?.bestFloor ?? 0;
  const cleared = run.victory || previous?.cleared === true;
  return {
    runs: records.runs + 1,
    victories: records.victories + (run.victory ? 1 : 0),
    bestLevel: Math.max(records.bestLevel ?? 0, run.level),
    lastSpecies: run.species,
    dungeons: { ...records.dungeons, [run.dungeon]: { bestFloor: Math.max(best, run.floor), ...(cleared ? { cleared: true as const } : {}) } },
  };
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
      if (ID.test(id) && bestFloor !== null) dungeons[id] = { bestFloor, ...(fields?.cleared === true ? { cleared: true as const } : {}) };
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

/** The notice board text for one dungeon (`tr` is the i18n lookup). */
export function boardLines(records: Records, dungeon: string, tr: (key: string) => string): string[] {
  if (records.runs === 0) return [tr('town.board.title'), tr('town.board.none')];
  const floor = records.dungeons[dungeon]?.bestFloor;
  const parts = [
    tr('town.board.best').replace('{floor}', floor === undefined ? '-' : String(floor)),
    tr('town.board.runs').replace('{runs}', String(records.runs)),
    tr('town.board.victories').replace('{wins}', String(records.victories)),
    tr('town.board.level').replace('{level}', records.bestLevel === null ? '-' : String(records.bestLevel)),
  ];
  return [`${tr('town.board.title')} ${parts.join(' · ')}`];
}
