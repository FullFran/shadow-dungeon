import { DOTS, type DotKind, type MoveDef } from '../data/moves';
import { onBossDamaged } from './boss';
import { cardHpFloor } from './cards';
import type { EnemyState, GameEvent, HitEffects, PlayerState, WorldState } from './state';
import { enemyTimeScale } from './time';

/**
 * The move tutor's effects beyond damage (odd/tasks/movepools.md T2): what a
 * landed hit does to its user (drain heals, recoil hurts, never below 1 HP),
 * the HP a boost costs (Curse, Belly Drum) and the damage over time a hit
 * leaves on an enemy (burn, poison: `DOTS`). Moves without these fields
 * leave every state exactly as before.
 */

/** The effects of `move` its hits carry (only the fields it has). */
export function hitEffects(move: MoveDef): HitEffects | undefined {
  const effects: HitEffects = {
    ...(move.drain ? { drain: move.drain } : {}),
    ...(move.recoil ? { recoil: move.recoil } : {}),
    ...(move.dot ? { dot: move.dot } : {}),
    ...(move.critBonus ? { critBonus: move.critBonus } : {}),
  };
  return Object.keys(effects).length > 0 ? effects : undefined;
}

/** After a landed hit of `damage`: drain heals (up to max HP), recoil hurts (down to 1 HP at worst). */
export function afterHit(player: PlayerState, effects: HitEffects | undefined, damage: number): PlayerState {
  if (!effects || player.hp <= 0) return player;
  let hp = player.hp;
  if (effects.drain) hp = Math.min(player.maxHp, hp + damage * effects.drain);
  if (effects.recoil) hp = Math.max(1, hp - damage * effects.recoil);
  return hp === player.hp ? player : { ...player, hp };
}

/** A boost with `hpCost` takes that share of max HP as it is cast (never below 1 HP). */
export function payHpCost(player: PlayerState, move: MoveDef): PlayerState {
  if (!move.hpCost) return player;
  return { ...player, hp: Math.max(1, player.hp - player.maxHp * move.hpCost) };
}

/** The enemy now carries `kind` from a hit of `damage` (it replaces a running one). */
export function applyDot(enemy: EnemyState, kind: DotKind, damage: number): EnemyState {
  const def = DOTS[kind];
  const perTick = Math.max(1, Math.round((damage * def.share) / def.ticks));
  return { ...enemy, dot: { kind, damage: perTick, ticksLeft: def.ticks, nextMs: def.everyMs } };
}

/**
 * Host (and solo), every step: each running damage over time counts down at
 * the enemy time scale and deals its tick (a spell card's floor holds, as for
 * hits); a felled enemy counts as defeated. Ticks are `enemyHit` events with
 * `dot` set, so they show a number but no hitstop.
 */
export function tickDots(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  if (!state.enemies.some((e) => e.dot)) return state;
  const ms = dtMs * enemyTimeScale(state);
  const enemies = state.enemies.map((enemy) => {
    const dot = enemy.dot;
    if (!dot) return enemy;
    const { dot: _over, ...clean } = enemy;
    if (!enemy.alive) return clean;
    const nextMs = dot.nextMs - ms;
    if (nextMs > 0) return { ...enemy, dot: { ...dot, nextMs } };
    const hp = Math.max(Math.min(cardHpFloor(enemy), enemy.hp), enemy.hp - dot.damage);
    const dealt = enemy.hp - hp;
    if (dealt > 0) events.push({ type: 'enemyHit', enemyId: enemy.id, damage: dealt, effectiveness: 1, pos: enemy.pos, dot: dot.kind });
    if (hp <= 0) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    const hurt = { ...(enemy.boss ? onBossDamaged(clean, dealt) : clean), hp, alive: hp > 0 };
    const ticksLeft = dot.ticksLeft - 1;
    return ticksLeft > 0 && hp > 0 ? { ...hurt, dot: { ...dot, ticksLeft, nextMs: nextMs + DOTS[dot.kind].everyMs } } : hurt;
  });
  return { ...state, enemies };
}
