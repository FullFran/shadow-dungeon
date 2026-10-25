import { floatsOf, type EnemyAttackDef } from '../data/enemies';
import { computeDamage } from './damage';
import { confineCircle } from './geometry';
import { landHitOnPlayer } from './hits';
import type { AiMode, AiState, EnemyState, GameEvent, WorldState } from './state';
import { add, distance, length, normalize, sub, vec, type Vec2 } from './vec';

/** Shared building blocks of the enemy state machines (enemies.ts, boss.ts). */

export const enterMode = (ai: AiState, mode: AiMode, durationMs = 0): AiState => ({
  ...ai,
  mode,
  modeMs: 0,
  modeDurationMs: durationMs,
});

export const modeOver = (ai: AiState): boolean => ai.modeMs >= ai.modeDurationMs;

export function replaceEnemy(state: WorldState, enemy: EnemyState): WorldState {
  return { ...state, enemies: state.enemies.map((e) => (e.id === enemy.id ? enemy : e)) };
}

/** Unit vector from the enemy to the player (its facing if they overlap). */
export function towardPlayer(state: WorldState, enemy: EnemyState): Vec2 {
  const dir = normalize(sub(state.player.pos, enemy.pos));
  return length(dir) > 0 ? dir : enemy.facing;
}

export const perpendicular = (v: Vec2, sign: 1 | -1): Vec2 => vec(-v.y * sign, v.x * sign);

/**
 * Moves an enemy by `delta`, confined to the room. Walkers that bump into an
 * obstacle slide along it (sideways by their strafe sign) instead of sticking.
 */
export function moveEnemy(state: WorldState, enemy: EnemyState, delta: Vec2): EnemyState {
  const solid = !floatsOf(enemy.species);
  const desired = add(enemy.pos, delta);
  let pos = confineCircle(state.arena, desired, enemy.radius, solid);
  if (solid && distance(pos, desired) > 0.01 && length(delta) > 0) {
    pos = confineCircle(state.arena, add(pos, perpendicular(delta, enemy.ai.strafeSign)), enemy.radius, solid);
  }
  return { ...enemy, pos };
}

/**
 * Contact of an enemy attack with the player (`touches` = hitbox overlap), once per attack. Returns
 * the world after the hit and the contact result ('dodged' when i-frames
 * absorbed it: the attack passes through and keeps going).
 */
export function contactPlayer(
  state: WorldState,
  enemy: EnemyState,
  attack: EnemyAttackDef,
  touches: boolean,
  events: GameEvent[],
): { state: WorldState; contact: AiState['contact'] } {
  if (enemy.ai.contact !== 'none' || !touches) {
    return { state, contact: enemy.ai.contact };
  }
  const { damage } = computeDamage({
    power: attack.power,
    moveType: attack.type,
    attackerTypes: enemy.types,
    defenderTypes: state.player.types,
  });
  const landed = landHitOnPlayer(state, { damage }, events);
  const dodged = landed.outcome === 'dodged' || landed.outcome === 'perfectDodge';
  return { state: landed.state, contact: dodged ? 'dodged' : 'hit' };
}

