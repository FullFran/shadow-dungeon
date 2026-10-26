import { PLAYER_EVOLUTIONS, STAGE_BONUS_CAP, type PlayerEvolution } from '../data/player-evolutions';
import type { SpeciesId } from '../data/species';
import type { Collection } from './collection';
import type { RankedMoves } from './tutor';

/**
 * Evolving an owned gacha species (odd/tasks/gacha-evolutions.md T3), pure:
 * the lines (data/player-evolutions.ts), the price of the next stage, the
 * evolution itself and the stage bonus a run gets. Portable like the gacha.
 */

/** What evolving reads and writes: the collection and the Mejoras (they carry over to the new form). */
export type EvolutionWallet = Collection & { ranks?: RankedMoves };

/** The evolution out of `species`, or null for a final form, a starter or an enemy. */
export const evolutionOf = (species: SpeciesId): PlayerEvolution | null => PLAYER_EVOLUTIONS.find((e) => e.from === species) ?? null;

/** The evolution into `species`, or null for a first form. */
const evolutionInto = (species: SpeciesId): PlayerEvolution | null => PLAYER_EVOLUTIONS.find((e) => e.to === species) ?? null;

/** The first form of `species`' line (itself when it has no line). */
export function lineOf(species: SpeciesId): SpeciesId {
  const into = evolutionInto(species);
  return into ? lineOf(into.from) : species;
}

/** Evolutions behind `species`: 0 for a first form (and anyone outside a line), 1, 2. */
export function stageOf(species: SpeciesId): number {
  const into = evolutionInto(species);
  return into ? 1 + stageOf(into.from) : 0;
}

/** The stage bonus of `species` in a run of `party` players, under its hard ceiling (lower in a party). */
export function stageBonus(species: SpeciesId, party: number): { hp: number; damage: number } {
  const bonus = evolutionInto(species)?.bonus ?? { hp: 0, damage: 0 };
  const cap = party > 1 ? STAGE_BONUS_CAP.party : STAGE_BONUS_CAP.solo;
  return { hp: Math.min(bonus.hp, cap), damage: Math.min(bonus.damage, cap) };
}

/** Whether `species` is owned, can evolve, and the wallet pays its Pokémonedas and materials. */
export function canEvolve(wallet: EvolutionWallet, species: SpeciesId): boolean {
  const next = evolutionOf(species);
  if (!next || !(wallet.owned ?? []).includes(species)) return false;
  return wallet.coins >= next.coins && (wallet.materials?.[lineOf(species)] ?? 0) >= next.materials;
}

/** The wallet after `species` evolves (the new form takes its place and its Mejoras), or null (nothing changes) when it cannot. */
export function evolve(wallet: EvolutionWallet, species: SpeciesId): EvolutionWallet | null {
  const next = evolutionOf(species);
  if (!next || !canEvolve(wallet, species)) return null;
  const line = lineOf(species);
  const { [species]: ranks, ...otherRanks } = wallet.ranks ?? {};
  return {
    ...wallet,
    coins: wallet.coins - next.coins,
    owned: (wallet.owned ?? []).map((id) => (id === species ? next.to : id)),
    materials: { ...wallet.materials, [line]: (wallet.materials?.[line] ?? 0) - next.materials },
    ...(wallet.ranks ? { ranks: { ...otherRanks, ...(ranks ? { [next.to]: ranks } : {}) } } : {}),
  };
}
