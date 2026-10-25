import type { KeyValueStore } from '../adapters/storage';

/**
 * The heralds met on this device (local only, like the leaderboard): their
 * seeds and names, so the notice board can count them and a herald's intro
 * plays in full only the first time its seed is met. Broken or hostile data
 * reads as none; a failing store never throws.
 */
export const BESTIARY_KEY = 'mazmorra-sombria.heraldsMet';

/** Most heralds remembered (the oldest are forgotten first). */
export const BESTIARY_SIZE = 500;

export interface BestiaryEntry {
  seed: number;
  name: string;
}

export function parseBestiary(raw: string | null): BestiaryEntry[] {
  try {
    const data: unknown = JSON.parse(raw ?? '[]');
    if (!Array.isArray(data)) return [];
    return data
      .filter((e): e is BestiaryEntry => typeof e === 'object' && e !== null && Number.isInteger((e as BestiaryEntry).seed) && typeof (e as BestiaryEntry).name === 'string' && (e as BestiaryEntry).name.length <= 40)
      .slice(-BESTIARY_SIZE)
      .map((e) => ({ seed: e.seed, name: e.name }));
  } catch {
    return [];
  }
}

export function readBestiary(store: KeyValueStore): BestiaryEntry[] {
  try {
    return parseBestiary(store.get(BESTIARY_KEY));
  } catch {
    return [];
  }
}

export const hasMet = (store: KeyValueStore, seed: number): boolean => readBestiary(store).some((e) => e.seed === seed);

/** Remembers a herald (once per seed); returns whether it was new. */
export function recordHerald(store: KeyValueStore, entry: BestiaryEntry): boolean {
  const met = readBestiary(store);
  if (met.some((e) => e.seed === entry.seed)) return false;
  try {
    store.set(BESTIARY_KEY, JSON.stringify([...met, { seed: entry.seed, name: entry.name.slice(0, 40) }].slice(-BESTIARY_SIZE)));
  } catch {
    // Not persisted: worst case its intro plays in full again.
  }
  return true;
}

/** The notice board's line ("Heraldos del Eclipse vistos: 7"), or none before the first. */
export function bestiaryLines(store: KeyValueStore, tr: (key: string) => string): string[] {
  const count = readBestiary(store).length;
  return count > 0 ? [tr('town.board.heralds').replace('{count}', String(count))] : [];
}
