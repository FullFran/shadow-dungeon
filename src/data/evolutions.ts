import type { DungeonId } from './dungeons';
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
  /** The dungeon of its line (the Sima's own species live in the Sima only). */
  home: DungeonId;
}

export const EVOLUTIONS: readonly Evolution[] = [
  // Crypt of the Sword King
  { species: 'mightyena', from: 'poochyena', home: 'crypt-of-the-sword-king' },
  { species: 'haunter', from: 'gastly', home: 'crypt-of-the-sword-king' },
  { species: 'gengar', from: 'haunter', home: 'crypt-of-the-sword-king' },
  { species: 'dusclops', from: 'duskull', home: 'crypt-of-the-sword-king' },
  { species: 'bisharp', from: 'pawniard', home: 'crypt-of-the-sword-king' },
  // Misty Forest
  { species: 'breloom', from: 'shroomish', home: 'misty-forest' },
  { species: 'drifblim', from: 'drifloon', home: 'misty-forest' },
  { species: 'morgrem', from: 'impidimp', home: 'misty-forest' },
  { species: 'noctowl', from: 'hoothoot', home: 'misty-forest' },
  { species: 'ariados', from: 'spinarak', home: 'misty-forest' },
  // Flooded Caves
  { species: 'golbat', from: 'zubat', home: 'flooded-caves' },
  { species: 'kingler', from: 'krabby', home: 'flooded-caves' },
  { species: 'octillery', from: 'remoraid', home: 'flooded-caves' },
  { species: 'crawdaunt', from: 'corphish', home: 'flooded-caves' },
  // Toxic Swamp
  { species: 'arbok', from: 'ekans', home: 'toxic-swamp' },
  { species: 'skuntank', from: 'stunky', home: 'toxic-swamp' },
  { species: 'weezing', from: 'koffing', home: 'toxic-swamp' },
  { species: 'muk', from: 'grimer', home: 'toxic-swamp' },
  { species: 'toxicroak', from: 'croagunk', home: 'toxic-swamp' },
  // The Sima's own (Houndour lives only there)
  { species: 'houndoom', from: 'houndour', home: 'eclipse-chasm' },
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
