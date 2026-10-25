import { STARTERS, type StarterId } from '../data/quiz';
import { SPECIES, type SpeciesId } from '../data/species';
import type { KeyValueStore } from '../adapters/storage';

/**
 * The starter the personality quiz chose, remembered under its own storage
 * key (apart from the settings). `playableStarter` is the one hand-off to
 * the run start and the loadout: a starter whose species data is not in the
 * game yet (or has no moves) falls back to Mimikyu.
 */
const KEY = 'mazmorra-sombria.starter';

export function loadStarter(store: KeyValueStore): StarterId | null {
  const stored = store.get(KEY);
  return STARTERS.find((id) => id === stored) ?? null;
}

export function saveStarter(store: KeyValueStore, starter: StarterId): void {
  store.set(KEY, starter);
}

export function playableStarter(starter: StarterId | null): SpeciesId {
  const species = starter ? (SPECIES as Partial<Record<string, (typeof SPECIES)[SpeciesId]>>)[starter] : undefined;
  return species && species.movepool.length > 0 ? species.id : 'mimikyu';
}
