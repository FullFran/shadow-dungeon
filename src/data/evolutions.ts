import type { SpeciesId } from './species';

/**
 * Evolved forms of the regular enemies (docs/gdd.md §3 "Evoluciones", user
 * request 2026-10-26): each keeps its line's way of fighting and escalates it
 * (data/evolved-enemies.ts), walks the deeper half of its line's dungeon and
 * the Sima from the late floors of that dungeon's stratum. `from` is the form
 * it evolves from (the one it replaces in the threat budget and leads).
 */
export interface Evolution {
  species: SpeciesId;
  from: SpeciesId;
}

export const EVOLUTIONS: readonly Evolution[] = [
  // Crypt of the Sword King
  { species: 'mightyena', from: 'poochyena' },
  { species: 'haunter', from: 'gastly' },
  { species: 'gengar', from: 'haunter' },
  { species: 'dusclops', from: 'duskull' },
  { species: 'bisharp', from: 'pawniard' },
  // Misty Forest
  { species: 'breloom', from: 'shroomish' },
  { species: 'drifblim', from: 'drifloon' },
  { species: 'morgrem', from: 'impidimp' },
  { species: 'noctowl', from: 'hoothoot' },
  { species: 'ariados', from: 'spinarak' },
  // Flooded Caves
  { species: 'golbat', from: 'zubat' },
  { species: 'kingler', from: 'krabby' },
  { species: 'octillery', from: 'remoraid' },
  { species: 'crawdaunt', from: 'corphish' },
  // Toxic Swamp
  { species: 'arbok', from: 'ekans' },
  { species: 'skuntank', from: 'stunky' },
  { species: 'weezing', from: 'koffing' },
  { species: 'muk', from: 'grimer' },
  { species: 'toxicroak', from: 'croagunk' },
  // The Sima's own
  { species: 'houndoom', from: 'houndour' },
];

/** The first stage of a line (Gengar's is Gastly). */
export function lineRoot(species: SpeciesId): SpeciesId {
  let current = species;
  for (let i = 0; i < EVOLUTIONS.length; i++) {
    const parent = EVOLUTIONS.find((e) => e.species === current)?.from;
    if (!parent) return current;
    current = parent;
  }
  return current;
}

export const isEvolved = (species: SpeciesId): boolean => EVOLUTIONS.some((e) => e.species === species);
