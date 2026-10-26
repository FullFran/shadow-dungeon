import type { StarterId } from '../data/learnsets';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { isPlayable, originalKit, SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, movePrice, RANK_COSTS, RANK_EFFECT, TUTOR_OFFER } from '../data/tutor';

/**
 * The move tutor, pure (odd/tasks/movepools.md T3): which moves a starter
 * knows (its original kit, free, plus the ones bought), buying one, ranking
 * up an original move ("Mejoras") and what ranks do in a run (more damage,
 * shorter boost/area cooldowns). The save facade (app/save.ts) stores
 * `learned` and `ranks`; a run gets the ranks of its species through
 * `createPlayer` (`PlayerState.moveRanks`).
 */

/** Moves bought per starter. */
export type LearnedMoves = Readonly<Partial<Record<StarterId, readonly MoveId[]>>>;
/** Mejoras per starter: rank (1..MAX_RANK) per original move. */
export type MoveRanks = Readonly<Partial<Record<MoveId, number>>>;
export type RankedMoves = Readonly<Partial<Record<StarterId, MoveRanks>>>;

/** What the tutor reads and writes: the balance and the two tables. */
export interface TutorWallet {
  coins: number;
  learned?: LearnedMoves;
  ranks?: RankedMoves;
}

const asStarter = (id: SpeciesId): StarterId | null => (isPlayable(id) ? (id as StarterId) : null);

/** Every move `species` can equip now: its original kit and what it bought, in movepool order. */
export function knownMoves(wallet: Pick<TutorWallet, 'learned'>, species: SpeciesId): MoveId[] {
  const starter = asStarter(species);
  const kit = originalKit(species);
  const bought = starter ? (wallet.learned?.[starter] ?? []) : [];
  return SPECIES[species].movepool.filter((m) => kit.includes(m) || bought.includes(m));
}

/** Price of `move` for `species`: 0 for its original kit, null when the tutor does not teach it that move. */
export function tutorPrice(species: SpeciesId, move: MoveId): number | null {
  const starter = asStarter(species);
  if (originalKit(species).includes(move)) return 0;
  if (!starter || !TUTOR_OFFER[starter].includes(move)) return null;
  return movePrice(MOVES[move]);
}

/** The wallet after `species` learns `move`, or null (nothing changes) when it is known, not taught or unaffordable. */
export function buyMove(wallet: TutorWallet, species: SpeciesId, move: MoveId): TutorWallet | null {
  const starter = asStarter(species);
  const price = tutorPrice(species, move);
  if (!starter || price === null || price === 0 || knownMoves(wallet, species).includes(move) || wallet.coins < price) return null;
  const learned = { ...wallet.learned, [starter]: [...(wallet.learned?.[starter] ?? []), move] };
  return { ...wallet, coins: wallet.coins - price, learned };
}

/** The rank of an original move (0 = none). */
export function moveRank(wallet: Pick<TutorWallet, 'ranks'>, species: SpeciesId, move: MoveId): number {
  const starter = asStarter(species);
  const rank = starter ? (wallet.ranks?.[starter]?.[move] ?? 0) : 0;
  return Math.min(MAX_RANK, Math.max(0, Math.floor(rank)));
}

/** Cost of the next rank of `move`, or null when it is maxed or not an original move. */
export function rankCost(wallet: Pick<TutorWallet, 'ranks'>, species: SpeciesId, move: MoveId): number | null {
  if (!asStarter(species) || !originalKit(species).includes(move)) return null;
  return RANK_COSTS[moveRank(wallet, species, move)] ?? null;
}

/** The wallet after one more rank of `move`, or null when maxed, not original or unaffordable. */
export function rankUp(wallet: TutorWallet, species: SpeciesId, move: MoveId): TutorWallet | null {
  const starter = asStarter(species);
  const cost = rankCost(wallet, species, move);
  if (!starter || cost === null || wallet.coins < cost) return null;
  const ranks = { ...wallet.ranks, [starter]: { ...wallet.ranks?.[starter], [move]: moveRank(wallet, species, move) + 1 } };
  return { ...wallet, coins: wallet.coins - cost, ranks };
}

/** The ranks a run of `species` takes (absent when there are none, so a plain run's state is unchanged). */
export function runRanks(wallet: Pick<TutorWallet, 'ranks'>, species: SpeciesId): MoveRanks | undefined {
  const starter = asStarter(species);
  const ranks = starter ? wallet.ranks?.[starter] : undefined;
  return ranks && Object.keys(ranks).length > 0 ? ranks : undefined;
}

/**
 * The loadout a run may use: each slot keeps its move only if the species
 * knows it (a stale or edited setting), else takes the species default.
 */
export function knownLoadout(wallet: Pick<TutorWallet, 'learned'>, species: SpeciesId, loadout: readonly (MoveId | null)[]): (MoveId | null)[] {
  const known = knownMoves(wallet, species);
  return loadout.map((m, i) => (m === null || known.includes(m) ? m : (SPECIES[species].defaultLoadout[i] ?? null)));
}

/** In a run: the damage factor of a ranked move (1 unranked). */
export const rankDamage = (ranks: MoveRanks | undefined, move: MoveDef): number => 1 + RANK_EFFECT.damage * (ranks?.[move.id] ?? 0);

/** In a run: the cooldown of a ranked boost or area move (its own unranked). */
export const rankCooldown = (ranks: MoveRanks | undefined, move: MoveDef): number => (move.cooldownMs ?? 0) * (1 - RANK_EFFECT.cooldown * (ranks?.[move.id] ?? 0));
