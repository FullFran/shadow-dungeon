import { SPECIES, type SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';

/**
 * What the hub's altar nameplate says about the partner (owner, 2026-11-04; .agents/DESIGN.md §4): its name, its
 * types, its passive on one line and, only when a Senda chapter is closed, its bond. No DOM here.
 */
export interface PartnerPlate {
  nameKey: string;
  types: readonly PokemonType[];
  /** i18n key of the passive's name (its description is `<key>.description`), or null. */
  passiveKey: string | null;
  /** Chapters of the species' Senda closed (the bond), or null before the first. */
  bond: number | null;
}

export function partnerPlate(species: SpeciesId, bondLevel: number | null): PartnerPlate {
  const def = SPECIES[species];
  return { nameKey: `species.${species}`, types: def.types, passiveKey: def.passive ? `passive.${def.passive}` : null, bond: bondLevel && bondLevel > 0 ? bondLevel : null };
}
