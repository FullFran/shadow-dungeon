import type { SpeciesId } from './species';

/**
 * Santuario de los Juramentos (docs/gdd.md §3 "El Santuario de los
 * Juramentos"): the boss shrine of the Refugio. «Reflejos» re-fight one boss
 * already beaten; «Desafíos» chain bosses back to back. Values are provisional.
 */
export type GauntletId = 'guardians' | 'oaths';

export interface GauntletDef {
  id: GauntletId;
  /** The bosses in fight order (the species of each fixed arena's first spawn). */
  bosses: readonly SpeciesId[];
  /** Pokémonedas of the first clear on each tier (times that tier's coin multiplier); later clears pay nothing. */
  reward: number;
}

export const SHRINE = {
  /** Share of max HP healed between two fights of a gauntlet (HP carries over otherwise). */
  heal: 0.3,
  /** Play time after a gauntlet fight falls before the next arena loads (ms); the next arena's banner follows. */
  pauseMs: 2500,
  /** The Sima depth a herald is re-fought at (rounded to a herald floor). */
  heraldFloor: 22,
} as const;

/** In menu order. */
export const GAUNTLETS: readonly GauntletDef[] = [
  { id: 'guardians', bosses: ['aegislash', 'decidueye', 'dhelmise', 'nihilego'], reward: 150 },
  { id: 'oaths', bosses: ['sableye', 'aegislash', 'trevenant', 'decidueye', 'lanturn', 'dhelmise', 'salazzle', 'nihilego'], reward: 300 },
];

export const gauntletById = (id: GauntletId): GauntletDef => GAUNTLETS.find((g) => g.id === id)!;
