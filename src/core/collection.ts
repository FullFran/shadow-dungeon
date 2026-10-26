import { lineRoot, type MaterialTier } from '../data/player-evolutions';
import { isPlayable, isStarter, STARTER_SPECIES, type SpeciesId } from '../data/species';

/**
 * The player's collection (odd/tasks/gacha-evolutions.md), pure: the species
 * won at the gacha and the evolved starters, kept as their current form (an
 * evolution replaces it), the awakening steps of the species that never
 * evolve (Mimikyu), the evolution materials per line and the gacha's pity
 * counter. The save facade (app/save.ts) stores it; the starters are always
 * owned and only listed once evolved (odd/tasks/roster-parity.md). Pure and
 * portable so a server can run the same rules later.
 */
export interface Collection {
  coins: number;
  /** Gacha species and evolved starters, as their current form, in the order obtained. */
  owned?: readonly SpeciesId[];
  /** Evolution materials per line (keyed by the line's first form) and tier. */
  materials?: Readonly<Partial<Record<SpeciesId, Materials>>>;
  /** Awakening steps taken per species that never evolves (data/player-evolutions.ts `PLAYER_AWAKENINGS`). */
  awakened?: Readonly<Partial<Record<SpeciesId, number>>>;
  /** Gacha pulls since the last rare (the pity counter). */
  pity?: number;
}

/** A line's materials, per tier. */
export type Materials = Readonly<Partial<Record<MaterialTier, number>>>;

/** Everyone a player can play as: the starters (an evolved one as its current form, in its place), then the owned gacha species. */
export function rosterOf(collection: Pick<Collection, 'owned'>): SpeciesId[] {
  const owned = (collection.owned ?? []).filter((id) => isPlayable(id) && !isStarter(id));
  const starters = STARTER_SPECIES.map((s) => owned.find((id) => lineRoot(id) === s) ?? s);
  return [...new Set([...starters, ...owned.filter((id) => !isStarter(lineRoot(id)))])];
}

/** The form a player has of `species`' line (its current form; `species` itself when none is in the roster). */
export const currentForm = (collection: Pick<Collection, 'owned'>, species: SpeciesId): SpeciesId =>
  rosterOf(collection).find((id) => lineRoot(id) === lineRoot(species)) ?? species;

/** Awakening steps taken by `species` (0 for any species that does not awaken). */
export const awakenedOf = (collection: Pick<Collection, 'awakened'>, species: SpeciesId): number => collection.awakened?.[species] ?? 0;
