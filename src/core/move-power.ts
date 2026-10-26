import { BASE_MOVE_IDS, DOTS, MOVES, type MoveDef } from '../data/moves';
import { ITEM_EFFECTS } from '../data/items';
import type { SlotKind } from '../data/slots';

/**
 * A move's power budget (odd/tasks/move-progression.md T1): its effective
 * single-target damage rate against the best original move of its slot and
 * shape (ranged and multi-hit apart). Básico moves (the original kits) set
 * the baseline; Avanzado moves may go to ×1.2 and Maestro moves to ×1.4
 * (data/tutor.ts `TIER_BUDGET`), paying with real costs (`costsOf`).
 */

/** Raw damage per ms of a tap (multi-hit counted whole, a boomerang twice); area moves per second of cooldown. */
export function damageRate(move: MoveDef): number {
  const total = move.power * (move.multiHit ?? 1) * (move.hitbox.kind === 'projectile' && move.hitbox.boomerang ? 2 : 1);
  if (move.slot === 'area') {
    const zone = move.hitbox.kind === 'projectile' && move.hitbox.linger ? Math.ceil(move.hitbox.lifetimeMs / move.hitbox.linger) : 1;
    return (total * zone) / ((move.cooldownMs ?? 1000) / 1000);
  }
  const cycle = move.windupMs + move.activeMs + move.recoveryMs;
  return total / Math.max(cycle, move.cooldownMs ?? 0);
}

/**
 * The extra damage a move's own effects add, as a factor: a damage over time
 * counts half its share (a new one replaces a running one on a boss struck
 * again and again), a crit bonus its expected extra damage.
 */
export function effectFactor(move: MoveDef): number {
  const dot = move.dot ? DOTS[move.dot].share * 0.5 : 0;
  const crit = (move.critBonus ?? 0) * (ITEM_EFFECTS.critMultiplier - 1);
  return (1 + dot) * (1 + crit);
}

const ranged = (move: MoveDef) => move.hitbox.kind === 'projectile';
const multi = (move: MoveDef) => (move.multiHit ?? 1) > 1 || (move.hitbox.kind === 'projectile' && Boolean(move.hitbox.boomerang));
const KIT = BASE_MOVE_IDS.map((id) => MOVES[id]);

/** The baseline of `move`: the best original move of its slot and shape (any shape when none matches). */
export function slotBaseline(move: MoveDef): number {
  const peers = KIT.filter((b) => b.slot === move.slot && (move.slot === 'area' || (ranged(b) === ranged(move) && multi(b) === multi(move))));
  const pool = peers.length > 0 ? peers : KIT.filter((b) => b.slot === move.slot);
  return Math.max(...pool.map((b) => damageRate(b) * effectFactor(b)));
}

/** Effective damage against the baseline (1 = as strong as the best original move of the slot and shape). */
export const budgetRatio = (move: MoveDef): number => (damageRate(move) * effectFactor(move)) / slotBaseline(move);

/** Stamina a move must cost, per slot, to count it as a cost (the original kits' heavy 30 and area 35 are the norm). */
export const STAMINA_COST: Readonly<Record<SlotKind, number>> = { fast: 5, heavy: 35, boost: Number.POSITIVE_INFINITY, area: 40 };
/** A wind-up this much longer than the slowest original move of the slot counts as a cost. */
export const SLOW_WINDUP = 1.25;

const slowestWindup = (slot: SlotKind): number => Math.max(...KIT.filter((b) => b.slot === slot).map((b) => b.windupMs));

export type MoveCost = 'recoil' | 'hp' | 'cooldown' | 'stamina' | 'windup';

/** The real costs a move pays: recoil, an HP cost, a cooldown on a heavy move, extra stamina, a slow wind-up. */
export function costsOf(move: MoveDef): MoveCost[] {
  const costs: MoveCost[] = [];
  if (move.recoil) costs.push('recoil');
  if (move.hpCost) costs.push('hp');
  if (move.slot === 'heavy' && move.cooldownMs) costs.push('cooldown');
  if (move.staminaCost >= STAMINA_COST[move.slot]) costs.push('stamina');
  if (move.windupMs >= slowestWindup(move.slot) * SLOW_WINDUP) costs.push('windup');
  return costs;
}
