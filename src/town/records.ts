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
  /** Best floor reached, per dungeon id (see `DUNGEON_LORE`). */
  dungeons: Readonly<Record<string, { bestFloor: number }>>;
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
  const best = records.dungeons[run.dungeon]?.bestFloor ?? 0;
  return {
    runs: records.runs + 1,
    victories: records.victories + (run.victory ? 1 : 0),
    bestLevel: Math.max(records.bestLevel ?? 0, run.level),
    lastSpecies: run.species,
    dungeons: { ...records.dungeons, [run.dungeon]: { bestFloor: Math.max(best, run.floor) } },
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
  const dungeons: Record<string, { bestFloor: number }> = {};
  const rawDungeons = record.dungeons;
  if (typeof rawDungeons === 'object' && rawDungeons !== null && !Array.isArray(rawDungeons)) {
    for (const [id, entry] of Object.entries(rawDungeons).slice(0, MAX_DUNGEONS)) {
      const bestFloor = typeof entry === 'object' && entry !== null ? count((entry as Record<string, unknown>).bestFloor, 1) : null;
      if (ID.test(id) && bestFloor !== null) dungeons[id] = { bestFloor };
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
