import { SHADOW_SELF, type EnemyAttackDef, type ShadowDef, type ShadowShape } from '../data/enemies';
import { MOVES, type MoveId } from '../data/moves';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, perpendicular, replaceEnemy, spawnShot, telegraph, towardTarget } from './brain';
import type { EnemyState, GameEvent, WorldState } from './state';
import { add, distance, dot, length, normalize, scale, sub, type Vec2 } from './vec';

/**
 * Tu Sombra, the tutorial dungeon's boss (odd/tasks/tutorial-dungeon.md S4,
 * data/enemies.ts `SHADOW_SELF`): it mirrors the player. Its kit is the
 * player's own equipped attacking moves, played one after another in slot
 * order, each by its hitbox shape: a swing (melee arcs, and the area moves'
 * cones and rings), a dash, or a shot. Every one is telegraphed for a long
 * while (its aim locks shortly before it fires) and followed by a long
 * recovery, the opening the tutorial's signs taught to punish.
 */

const PLAYER_RADIUS = TUNING.player.radius;

/** The player's equipped moves the shadow mirrors (boosts have no hit to copy), in slot order; a plain swipe when there are none. */
export function shadowKit(loadout: readonly (MoveId | null)[], def: ShadowDef = SHADOW_SELF): MoveId[] {
  const kit = loadout.filter((move): move is MoveId => move !== null && MOVES[move] !== undefined && MOVES[move].hitbox.kind !== 'self');
  return kit.length > 0 ? kit : [def.fallback];
}

/** How the shadow plays `move` (an unknown id plays as a swing). */
export function shadowShape(move: string | undefined): ShadowShape {
  const kind = move !== undefined ? MOVES[move as MoveId]?.hitbox.kind : undefined;
  return kind === 'dash' || kind === 'projectile' ? kind : 'arc';
}

/** The shape and reach of a mirrored move, for the brain and its telegraph (world px). */
export interface ShadowReach {
  shape: ShadowShape;
  /** A swing's radius, a dash's length, or the distance a shot is thrown from. */
  reach: number;
  /** A swing's arc (360 for a ring). */
  arcDegrees: number;
  /** A dash's or a shot's width. */
  width: number;
}

/** Distance the shadow throws a shot from (it closes in to this before winding up). */
const SHOT_RANGE = 240;

export function shadowReach(move: string | undefined): ShadowReach {
  const hitbox = move !== undefined ? MOVES[move as MoveId]?.hitbox : undefined;
  if (hitbox?.kind === 'dash') return { shape: 'dash', reach: hitbox.distance, arcDegrees: 0, width: hitbox.radius * 2 };
  if (hitbox?.kind === 'projectile') return { shape: 'projectile', reach: SHOT_RANGE, arcDegrees: 0, width: hitbox.radius * 2 };
  if (hitbox?.kind === 'arc') return { shape: 'arc', reach: hitbox.range, arcDegrees: hitbox.arcDegrees, width: 0 };
  return { shape: 'arc', reach: 44, arcDegrees: 120, width: 0 };
}

/** The hit of a mirrored move: its own type, a fraction of its power. */
export function shadowAttack(move: string | undefined, def: ShadowDef = SHADOW_SELF): EnemyAttackDef {
  const known = move !== undefined ? MOVES[move as MoveId] : undefined;
  const power = Math.round((known?.power ?? 40) * def.powerScale);
  return { power: Math.min(def.maxPower, Math.max(def.minPower, power)), type: known?.type ?? 'dark' };
}

/** A swing meets the player: within its reach (body included) and inside its arc, or right against its body. */
export function swingTouches(enemy: EnemyState, player: Vec2, reach: ShadowReach): boolean {
  const offset = sub(player, enemy.pos);
  const dist = length(offset);
  if (dist > reach.reach + enemy.radius + PLAYER_RADIUS) return false;
  if (dist <= enemy.radius + PLAYER_RADIUS || reach.arcDegrees >= 360) return true;
  const cos = dot(normalize(offset), enemy.ai.attackDir);
  return Math.acos(Math.max(-1, Math.min(1, cos))) <= (reach.arcDegrees * Math.PI) / 360;
}

/** The swing or the dash in progress meets the player at `player` (its shots are projectiles: never). */
export function shadowTouches(enemy: EnemyState, player: Vec2): boolean {
  const reach = shadowReach(enemy.ai.attack);
  if (reach.shape === 'arc') return swingTouches(enemy, player, reach);
  if (reach.shape === 'dash') return distance(enemy.pos, player) <= enemy.radius + reach.width / 2 + PLAYER_RADIUS;
  return false;
}

/** How close the shadow comes before winding up `reach`. */
const engageAt = (enemy: EnemyState, reach: ShadowReach): number =>
  reach.shape === 'arc' ? reach.reach + enemy.radius + PLAYER_RADIUS - 6 : reach.shape === 'dash' ? Math.max(enemy.radius + PLAYER_RADIUS, reach.reach * 0.85) : reach.reach;

export function updateShadow(state: WorldState, start: EnemyState, def: ShadowDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  // The mirror: whatever the player carries now (solo only: the tutorial dungeon has no rooms).
  const kit = shadowKit(state.player.loadout, def);
  const next = kit[(ai.mirror ?? 0) % kit.length]!;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach': {
      const path = pathDirection(state, enemy, target);
      if (path) {
        enemy = { ...moveEnemy(state, enemy, scale(path, (def.walkSpeed * ms) / 1000)), facing: path };
        break;
      }
      const reach = shadowReach(next);
      const at = engageAt(enemy, reach);
      if (ai.cooldownMs <= 0 && dist <= at) {
        enemy = telegraph(enemy, next, def.telegraphMs[reach.shape], toPlayer, events);
        break;
      }
      // Close in to the move's reach; while it recharges, circle the player a little.
      const circling = ai.cooldownMs > 0 && dist <= at + 30;
      const dir = circling ? normalize(add(perpendicular(toPlayer, ai.strafeSign), scale(toPlayer, -0.2))) : toPlayer;
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * (circling ? 0.6 : 1) * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph': {
      // The aim follows the player until the last `lockMs`: the locked direction is the cue to roll.
      if (ai.modeDurationMs - ai.modeMs > def.lockMs) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (!modeOver(ai)) break;
      const move = ai.attack;
      const reach = shadowReach(move);
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: move ?? 'swipe' });
      if (reach.shape === 'projectile') {
        const hitbox = MOVES[move as MoveId]?.hitbox;
        const speed = (hitbox?.kind === 'projectile' ? hitbox.speed : 300) * def.shotSpeedScale;
        const life = Math.min(4000, (hitbox?.kind === 'projectile' ? hitbox.lifetimeMs : 1000) / def.shotSpeedScale);
        state = spawnShot(state, enemy, { ...shadowAttack(move, def), speed, radius: Math.max(5, reach.width / 2), lifetimeMs: life }, enemy.ai.attackDir);
        enemy = { ...enemy, ai: enterMode(enemy.ai, 'attack', 250) };
      } else {
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', reach.shape === 'dash' ? def.dashMs : def.strikeMs), contact: 'none' } };
      }
      break;
    }
    case 'attack': {
      const reach = shadowReach(ai.attack);
      if (reach.shape === 'dash') enemy = moveEnemy(state, enemy, scale(ai.attackDir, (reach.reach / def.dashMs) * ms));
      if (reach.shape !== 'projectile') {
        const hit = contactPlayer(state, enemy, shadowAttack(ai.attack, def), shadowTouches(enemy, state.player.pos), events);
        state = hit.state;
        enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      }
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs, mirror: (ai.mirror ?? 0) + 1 } };
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(ai, 'approach'), strafeSign: ai.strafeSign === 1 ? -1 : 1 } };
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}
