import type { KeyValueStore } from '../adapters/storage';

/**
 * Local records for the notice board, read-only here. Nothing writes this
 * key yet (the run flow will); a missing, broken or hostile value just reads
 * as "no records".
 */
export const RECORDS_KEY = 'mazmorra-sombria.records';

export interface Records {
  bestFloor: number | null;
  runs: number | null;
}

const count = (value: unknown, min: number): number | null => (typeof value === 'number' && Number.isSafeInteger(value) && value >= min ? value : null);

export function parseRecords(raw: string | null): Records {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    data = null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { bestFloor: null, runs: null };
  const record = data as Record<string, unknown>;
  return { bestFloor: count(record.bestFloor, 1), runs: count(record.runs, 0) };
}

export const readRecords = (store: KeyValueStore): Records => parseRecords(store.get(RECORDS_KEY));
