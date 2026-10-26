import { isPlayable, isStarter, STARTER_SPECIES, type SpeciesId } from '../data/species';

/**
 * The player's collection (odd/tasks/gacha-evolutions.md), pure: the species
 * won at the gacha, kept as their current form (an evolution replaces it),
 * the evolution materials per line and the gacha's pity counter. The save
 * facade (app/save.ts) stores it; the starters are always owned and never
 * listed. Pure and portable so a server can run the same rules later.
 */
export interface Collection {
  coins: number;
  /** Gacha species, as their current form, in the order obtained. */
  owned?: readonly SpeciesId[];
  /** Evolution materials per line, keyed by the line's first form. */
  materials?: Readonly<Partial<Record<SpeciesId, number>>>;
  /** Gacha pulls since the last rare (the pity counter). */
  pity?: number;
}

/** Everyone a player can play as: the starters, then the owned species. */
export function rosterOf(collection: Pick<Collection, 'owned'>): SpeciesId[] {
  const owned = (collection.owned ?? []).filter((id) => isPlayable(id) && !isStarter(id));
  return [...STARTER_SPECIES, ...new Set(owned)];
}
