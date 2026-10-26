import { awakeningsOf, lineRoot, MATERIAL_TIERS, PLAYER_EVOLUTIONS, STAGE_BONUS_CAP, type AwakeningStep, type PlayerEvolution } from '../data/player-evolutions';
import type { SpeciesId } from '../data/species';
import { awakenedOf, rosterOf, type Collection } from './collection';
import type { LearnedMoves, RankedMoves } from './tutor';

/**
 * Evolving a species the player has (odd/tasks/gacha-evolutions.md T3,
 * odd/tasks/roster-parity.md), pure: the lines (data/player-evolutions.ts),
 * the price of the next stage, the evolution itself and the stage bonus a run
 * gets. A species that never evolves (Mimikyu) awakens instead: the same
 * prices and bonuses, the same id, its steps kept in `awakened`. Portable
 * like the gacha.
 */

/** What evolving reads and writes: the collection, the Mejoras and the bought moves (they carry over to the new form). */
export type EvolutionWallet = Collection & { ranks?: RankedMoves; learned?: LearnedMoves };

/** The evolution out of `species`, or null for a final form, Mimikyu or an enemy. */
export const evolutionOf = (species: SpeciesId): PlayerEvolution | null => PLAYER_EVOLUTIONS.find((e) => e.from === species) ?? null;

/** The evolution into `species`, or null for a first form. */
const evolutionInto = (species: SpeciesId): PlayerEvolution | null => PLAYER_EVOLUTIONS.find((e) => e.to === species) ?? null;

/** The first form of `species`' line (itself when it has no line). */
export const lineOf = lineRoot;

/** Evolutions behind `species`: 0 for a first form (and anyone outside a line), 1, 2. */
export function stageOf(species: SpeciesId): number {
  const into = evolutionInto(species);
  return into ? 1 + stageOf(into.from) : 0;
}

/** The next awakening step of `species` for this collection, or null when it does not awaken or is fully awakened. */
export const awakeningOf = (wallet: Pick<Collection, 'awakened'>, species: SpeciesId): AwakeningStep | null => awakeningsOf(species)[awakenedOf(wallet, species)] ?? null;

/**
 * The stage bonus of `species` (after `awakened` awakening steps, for one
 * that awakens) in a run of `party` players, under its hard ceiling (lower in
 * a party).
 */
export function stageBonus(species: SpeciesId, party: number, awakened = 0): { hp: number; damage: number } {
  const steps = awakeningsOf(species);
  const bonus = evolutionInto(species)?.bonus ?? steps[Math.min(awakened, steps.length) - 1]?.bonus ?? { hp: 0, damage: 0 };
  const cap = party > 1 ? STAGE_BONUS_CAP.party : STAGE_BONUS_CAP.solo;
  return { hp: Math.min(bonus.hp, cap), damage: Math.min(bonus.damage, cap) };
}

/** The next step of `species` for this wallet: its evolution, or its next awakening; null when it has none. */
export const nextStep = (wallet: Pick<Collection, 'awakened'>, species: SpeciesId): AwakeningStep | null => evolutionOf(species) ?? awakeningOf(wallet, species);

/** Whether the player has `species`, it can evolve (or awaken), and the wallet pays its Pokémonedas and every tier of materials. */
export function canEvolve(wallet: EvolutionWallet, species: SpeciesId): boolean {
  const next = nextStep(wallet, species);
  if (!next || !rosterOf(wallet).includes(species)) return false;
  const have = wallet.materials?.[lineOf(species)] ?? {};
  return wallet.coins >= next.coins && MATERIAL_TIERS.every((tier) => (have[tier] ?? 0) >= (next.materials[tier] ?? 0));
}

/** A per-species table with `from`'s entry moved to `to` (an evolution takes it along); absent stays absent. */
function moveEntry<T>(table: Readonly<Partial<Record<SpeciesId, T>>> | undefined, from: SpeciesId, to: SpeciesId): Partial<Record<SpeciesId, T>> | undefined {
  if (!table) return undefined;
  const { [from]: mine, ...others } = table;
  return { ...others, ...(mine !== undefined ? { [to]: mine } : {}) };
}

/**
 * The wallet after `species` evolves (the new form takes its place, its
 * Mejoras and its bought moves; an evolved starter joins `owned`) or awakens
 * (one more step in `awakened`), or null (nothing changes) when it cannot.
 */
export function evolve(wallet: EvolutionWallet, species: SpeciesId): EvolutionWallet | null {
  const next = nextStep(wallet, species);
  if (!next || !canEvolve(wallet, species)) return null;
  const line = lineOf(species);
  const have = wallet.materials?.[line] ?? {};
  const left = Object.fromEntries(MATERIAL_TIERS.map((tier) => [tier, (have[tier] ?? 0) - (next.materials[tier] ?? 0)]).filter(([, n]) => (n as number) > 0));
  const paid = { ...wallet, coins: wallet.coins - next.coins, materials: { ...wallet.materials, [line]: left } };
  const evolution = evolutionOf(species);
  if (!evolution) return { ...paid, awakened: { ...wallet.awakened, [species]: awakenedOf(wallet, species) + 1 } };
  const owned = wallet.owned ?? [];
  const ranks = moveEntry(wallet.ranks, species, evolution.to);
  const learned = moveEntry(wallet.learned, species, evolution.to);
  return {
    ...paid,
    owned: owned.includes(species) ? owned.map((id) => (id === species ? evolution.to : id)) : [...owned, evolution.to],
    ...(ranks ? { ranks } : {}),
    ...(learned ? { learned } : {}),
  };
}
