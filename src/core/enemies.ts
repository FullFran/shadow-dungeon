import { ENEMY_BEHAVIOUR, type GastlyDef, type PoochyenaDef } from '../data/enemies';
import { updateBoss } from './boss';
import { flowStep } from './flow';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, towardTarget } from './brain';
import { targetOf } from './party';
import { lungeTouches } from './victim';
import type { AiMode, AiState, EnemyState, GameEvent, ProjectileState, WorldState } from './state';
import { lineOfSight, tileCenter, tileOf } from './tiles';
import { enemyTimeScale } from './time';
import { add, distance, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Enemy behaviour as explicit state machines (docs/gdd.md §4). Each brain
 * reads the world and returns it with its enemy updated; enemies act only
 * while not staggered and run at the enemy time scale (perfect-dodge slow-mo).
 */
export function initialAi(dormant = false): AiState {
  return {
    mode: dormant ? 'dormant' : 'idle',
    modeMs: 0,
    modeDurationMs: 0,
    attackDir: vec(0, 1),
    contact: 'none',
    cooldownMs: 0,
    strafeSign: 1,
  };
}

function telegraph(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return { ...enemy, facing: dir, ai: { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir } };
}

/**
 * Where a walker heads to reach its target: straight at it with a clear line
 * of sight (or on arenas without tiles), otherwise towards the next tile
 * downhill on the shared flow field (towards the nearest player). Null when it sees the target.
 */
function pathDirection(state: WorldState, enemy: EnemyState, target: Vec2): Vec2 | null {
  const grid = state.arena.tiles;
  if (!grid || !state.flow || lineOfSight(grid, enemy.pos, target)) return null;
  const next = flowStep(grid, state.flow, tileOf(enemy.pos));
  if (!next) return null;
  const dir = normalize(sub(tileCenter(next), enemy.pos));
  return length(dir) > 0 ? dir : null;
}

/** Poochyena: stalks, telegraphs with Charge, lunges in a straight line; a dodged lunge leaves it exposed. */
function updateLunger(state: WorldState, start: EnemyState, def: PoochyenaDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach': {
      const path = pathDirection(state, enemy, target);
      if (path) {
        // Out of sight: follow the flow field around the walls, no stalking or lunging.
        enemy = { ...moveEnemy(state, enemy, scale(path, (def.walkSpeed * ms) / 1000)), facing: path };
        break;
      }
      if (ai.cooldownMs <= 0 && dist <= def.lungeRange) {
        enemy = telegraph(enemy, 'lunge', def.telegraphMs, toPlayer, events);
        break;
      }
      // Only while recharging: with the lunge ready it closes in to lunge range (it used to hover at the stalk ring).
      const stalking = ai.cooldownMs > 0 && dist <= def.stalkRange;
      // Circle the player while the lunge recharges, otherwise close in.
      const dir = stalking ? normalize(add(perpendicular(toPlayer, ai.strafeSign), scale(toPlayer, -0.2))) : toPlayer;
      const speed = def.walkSpeed * (stalking ? 0.6 : 1);
      enemy = { ...moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      // Tracks the player during the wind-up; the direction is committed when it fires.
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'lunge' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.lungeMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      const speed = def.lungeDistance / def.lungeMs;
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, speed * ms));
      const hit = contactPlayer(state, enemy, def.attack, lungeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (hit.contact === 'hit') {
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.hitRecoverMs), cooldownMs: def.cooldownMs } };
      } else if (modeOver(ai)) {
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.missRecoverMs), cooldownMs: def.cooldownMs } };
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) {
        const strafeSign = ai.strafeSign === 1 ? -1 : 1;
        enemy = { ...enemy, ai: { ...enterMode(ai, 'approach'), strafeSign } };
      }
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

function spawnEnemyProjectile(state: WorldState, enemy: EnemyState, def: GastlyDef['projectile'], dir: Vec2): WorldState {
  const projectile: ProjectileState = {
    id: `p${state.nextId}`,
    owner: 'enemy',
    type: def.type,
    attackerTypes: enemy.types,
    power: def.power,
    damageMultiplier: 1,
    pos: add(enemy.pos, scale(dir, enemy.radius + def.radius)),
    vel: scale(dir, def.speed),
    radius: def.radius,
    remainingMs: def.lifetimeMs,
    hitstunMs: 0,
    knockback: 0,
    hitIds: [],
  };
  return { ...state, nextId: state.nextId + 1, projectiles: [...state.projectiles, projectile] };
}

/** Gastly: floats, keeps its distance band, telegraphs and casts a slow ball. */
function updateCaster(state: WorldState, start: EnemyState, def: GastlyDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'reposition') };
      break;
    case 'reposition': {
      const inBand = dist >= def.minDistance && dist <= def.maxDistance;
      if (inBand && ai.cooldownMs <= 0) {
        enemy = telegraph(enemy, 'ball', def.telegraphMs, toPlayer, events);
        break;
      }
      const radial = dist < def.minDistance ? scale(toPlayer, -1) : dist > def.maxDistance ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.5)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.speed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'ball' });
        state = spawnEnemyProjectile(state, enemy, def.projectile, enemy.ai.attackDir);
        enemy = { ...enemy, ai: enterMode(enemy.ai, 'attack', def.castMs) };
      }
      break;
    case 'attack':
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      break;
    case 'recover':
      if (modeOver(ai)) {
        const strafeSign = ai.strafeSign === 1 ? -1 : 1;
        enemy = { ...enemy, ai: { ...enterMode(ai, 'reposition'), strafeSign } };
      }
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** A stagger cancels a wind-up or an attack in progress. */
function interrupted(enemy: EnemyState): EnemyState {
  if (enemy.ai.mode !== 'telegraph' && enemy.ai.mode !== 'attack') return enemy;
  const def = ENEMY_BEHAVIOUR[enemy.species];
  const mode: AiMode = def?.kind === 'caster' ? 'reposition' : 'approach';
  return { ...enemy, ai: enterMode(enemy.ai, mode) };
}

const tickAi = (ai: AiState, ms: number): AiState => ({
  ...ai,
  modeMs: ai.modeMs + ms,
  cooldownMs: Math.max(0, ai.cooldownMs - ms),
});

/** Runs every enemy's behaviour for one step at the enemy time scale, each going for its nearest present player. */
export function updateEnemies(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const ms = dtMs * enemyTimeScale(state);
  let current = state;
  for (const { id } of state.enemies) {
    const enemy = current.enemies.find((e) => e.id === id);
    const def = enemy && ENEMY_BEHAVIOUR[enemy.species];
    if (!enemy || !def || !enemy.alive || enemy.ai.mode === 'dormant' || enemy.ai.mode === 'asleep') continue;
    if (enemy.hitstunMs > 0) {
      current = replaceEnemy(current, interrupted(enemy));
      continue;
    }
    const ticked = { ...enemy, ai: tickAi(enemy.ai, ms) };
    const target = targetOf(current, enemy).pos;
    if (def.kind === 'lunger') current = updateLunger(current, ticked, def, target, ms, events);
    else if (def.kind === 'caster') current = updateCaster(current, ticked, def, target, ms, events);
    else current = updateBoss(current, ticked, def, target, ms, events);
  }
  return current;
}
