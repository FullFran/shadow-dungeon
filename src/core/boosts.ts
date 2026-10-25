import { MOVES, type BuffDef, type MoveDef, type MoveId } from '../data/moves';
import type { GameEvent, PlayerState } from './state';

/**
 * Boost-slot buffs and the cooldowns of boost and area moves (four-slots).
 * Both live on the player only while running, so a player who never uses
 * them keeps exactly the state it had before (and the golden digest with it).
 */

/** Ms left before `moveId` can be used again (0 = ready). */
export const cooldownLeft = (player: Pick<PlayerState, 'cooldowns'>, moveId: MoveId): number => player.cooldowns?.[moveId] ?? 0;

/** The player with `move`'s cooldown started (moves without one: unchanged). */
export function startCooldown(player: PlayerState, move: MoveDef): PlayerState {
  if (!move.cooldownMs) return player;
  return { ...player, cooldowns: { ...player.cooldowns, [move.id]: move.cooldownMs } };
}

/** The running buff's definition, if any. */
export function activeBuff(player: Pick<PlayerState, 'buff'>): BuffDef | null {
  return player.buff ? (MOVES[player.buff.moveId].buff ?? null) : null;
}

/** A boost move takes hold: `kindle` lights Flash Fire at once, the others start their buff (replacing a running one). */
export function castBuff(player: PlayerState, move: MoveDef, events: GameEvent[]): PlayerState {
  const def = move.buff;
  if (!def) return player;
  events.push({ type: 'buffStarted', moveId: move.id });
  if (def.kind === 'kindle') return { ...player, flashFire: true };
  return { ...player, buff: { moveId: move.id, remainingMs: def.durationMs, ...(def.kind === 'power' ? { hitsLeft: def.hits } : {}) } };
}

/** Runs cooldowns and the buff down by `dtMs`; spent ones are removed (fields dropped when empty). */
export function tickBoosts(player: PlayerState, dtMs: number): PlayerState {
  if (!player.cooldowns && !player.buff) return player;
  let next = player;
  if (next.cooldowns) {
    const left = Object.entries(next.cooldowns)
      .map(([id, ms]) => [id, (ms ?? 0) - dtMs] as const)
      .filter(([, ms]) => ms > 0);
    const { cooldowns: _done, ...rest } = next;
    next = left.length > 0 ? { ...rest, cooldowns: Object.fromEntries(left) } : rest;
  }
  if (next.buff) {
    const remainingMs = next.buff.remainingMs - dtMs;
    const { buff: _spent, ...rest } = next;
    next = remainingMs > 0 ? { ...next, buff: { ...next.buff, remainingMs } } : rest;
  }
  return next;
}

/** Damage multiplier of the player's next hit from a `power` buff (1 without). */
export function buffDamage(player: Pick<PlayerState, 'buff'>): number {
  const def = activeBuff(player);
  return def?.kind === 'power' ? def.multiplier : 1;
}

/** A damaging hit landed: a `power` buff spends one of its hits (and ends on the last). */
export function spendBuffHit(player: PlayerState): PlayerState {
  const def = activeBuff(player);
  if (def?.kind !== 'power' || !player.buff) return player;
  const hitsLeft = (player.buff.hitsLeft ?? def.hits) - 1;
  if (hitsLeft > 0) return { ...player, buff: { ...player.buff, hitsLeft } };
  const { buff: _spent, ...rest } = player;
  return rest;
}

/** Extra crit chance from a `haste` buff (0 without). */
export function buffCrit(player: Pick<PlayerState, 'buff'>): number {
  const def = activeBuff(player);
  return def?.kind === 'haste' ? def.critChance : 0;
}

/** Walking speed factor from a `haste` buff (1 without). */
export function buffSpeed(player: Pick<PlayerState, 'buff'>): number {
  const def = activeBuff(player);
  return def?.kind === 'haste' ? def.speed : 1;
}

/** Damage-taken factor from a `guard` buff (1 without). */
export function buffDamageTaken(player: Pick<PlayerState, 'buff'>): number {
  const def = activeBuff(player);
  return def?.kind === 'guard' ? def.damageTaken : 1;
}
