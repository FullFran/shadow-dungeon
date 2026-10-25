import { SIMA_ELITES } from '../data/sima';
import { floatsOf, type EnemyAttackDef, type SteerDef } from '../data/enemies';
import { computeDamage } from './damage';
import { confineCircle } from './geometry';
import { landHitOnPlayer } from './hits';
import { flowStep } from './flow';
import { onContact } from './items';
import { lineOfSight, tileCenter, tileOf } from './tiles';
import type { AiMode, AiState, EnemyState, GameEvent, ProjectileState, WorldState } from './state';
import { add, angleOf, distance, fromAngle, length, normalize, scale, sub, vec, type Vec2 } from './vec';

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

/** Unit vector from the enemy to its target player's position (its facing if they overlap). */
export function towardTarget(target: Vec2, enemy: EnemyState): Vec2 {
  const dir = normalize(sub(target, enemy.pos));
  return length(dir) > 0 ? dir : enemy.facing;
}

export const perpendicular = (v: Vec2, sign: 1 | -1): Vec2 => vec(-v.y * sign, v.x * sign);

/** `v` turned by `degrees` (counter-clockwise in screen terms is negative y; only the spread matters here). */
export const rotate = (v: Vec2, degrees: number): Vec2 => fromAngle(angleOf(v) + (degrees * Math.PI) / 180);

/** An enemy projectile's shape and hit (and its steering, for shots that bend towards the player). */
export type EnemyShot = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number; steer?: SteerDef };

/**
 * Fires one enemy projectile along `dir`, from just outside the body (or from
 * `at`, e.g. a spore cloud on the spot). A speed of 0 makes it a lingering
 * cloud that hits whoever walks in, once.
 */
export function spawnShot(state: WorldState, enemy: EnemyState, shot: EnemyShot, dir: Vec2, at?: Vec2): WorldState {
  // A Sima volley elite throws two more beside each shot.
  if (enemy.elite === 'volley' && shot.speed > 0) {
    const plain = { ...enemy, elite: undefined };
    const spread = SIMA_ELITES.volleyDegrees;
    return [-spread, spread].reduce((s, deg) => spawnShot(s, plain, shot, rotate(dir, deg), at), spawnShot(state, plain, shot, dir, at));
  }
  const projectile: ProjectileState = {
    id: `p${state.nextId}`,
    owner: 'enemy',
    type: shot.type,
    attackerTypes: enemy.types,
    power: shot.power,
    damageMultiplier: 1,
    pos: at ?? add(enemy.pos, scale(dir, enemy.radius + shot.radius)),
    vel: shot.speed === 0 ? vec(0, 0) : scale(dir, shot.speed),
    radius: shot.radius,
    remainingMs: shot.lifetimeMs,
    hitstunMs: 0,
    knockback: 0,
    hitIds: [],
    ...(shot.steer ? { steer: shot.steer } : {}),
  };
  return { ...state, nextId: state.nextId + 1, projectiles: [...state.projectiles, projectile] };
}

/** `count` shots spread evenly over `degrees` around `dir` (one straight shot when count is 1), plus `offsetDegrees`. */
export function spreadDirections(dir: Vec2, count: number, degrees: number, offsetDegrees = 0): Vec2[] {
  if (count <= 1) return [rotate(dir, offsetDegrees)];
  const step = degrees / (count - 1);
  return Array.from({ length: count }, (_, i) => rotate(dir, -degrees / 2 + i * step + offsetDegrees));
}

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
 * Contact of an enemy attack with the local player (`touches` = hitbox overlap), once per attack.
 * Victim-side: only `state.player` is ever checked; remote players check their own. Returns
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
  const landed = landHitOnPlayer(state, { damage, type: attack.type, from: enemy.pos }, events);
  if (landed.outcome === 'hurt' || landed.outcome === 'absorbed') onContact(state.player, enemy, events);
  const dodged = landed.outcome === 'dodged' || landed.outcome === 'perfectDodge';
  return { state: landed.state, contact: dodged ? 'dodged' : 'hit' };
}

/** Starts a wind-up named `attack` (its telegraph event), aimed along `dir`. */
export function telegraph(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return { ...enemy, facing: dir, ai: { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir, attack } };
}

/**
 * Where a walker heads to reach its target: straight at it with a clear line
 * of sight (or on arenas without tiles), otherwise towards the next tile
 * downhill on the shared flow field (towards the nearest player). Null when it sees the target.
 */
export function pathDirection(state: WorldState, enemy: EnemyState, target: Vec2, floats = false): Vec2 | null {
  const grid = state.arena.tiles;
  // Fliers and phasers go straight over the walls.
  if (floats) return null;
  if (!grid || !state.flow || lineOfSight(grid, enemy.pos, target)) return null;
  const next = flowStep(grid, state.flow, tileOf(enemy.pos));
  if (!next) return null;
  const dir = normalize(sub(tileCenter(next), enemy.pos));
  return length(dir) > 0 ? dir : null;
}
