import { ENEMY_BEHAVIOUR, type GastlyDef, type PoochyenaDef, type SlammerDef, type SporeDef } from '../data/enemies';
import { updateArcher } from './archer';
import { updateBoss } from './boss';
import { updateThief } from './thief';
import { flowStep } from './flow';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, spawnShot, spreadDirections, towardTarget } from './brain';
import { targetOf } from './party';
import { lungeTouches, slammerTouches } from './victim';
import type { AiMode, AiState, EnemyState, GameEvent, WorldState } from './state';
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
function pathDirection(state: WorldState, enemy: EnemyState, target: Vec2, floats = false): Vec2 | null {
  const grid = state.arena.tiles;
  // Fliers and phasers go straight over the walls.
  if (floats) return null;
  if (!grid || !state.flow || lineOfSight(grid, enemy.pos, target)) return null;
  const next = flowStep(grid, state.flow, tileOf(enemy.pos));
  if (!next) return null;
  const dir = normalize(sub(tileCenter(next), enemy.pos));
  return length(dir) > 0 ? dir : null;
}

/**
 * Lungers (Poochyena, Phantump, Pumpkaboo Small, Hoothoot, Pawniard): stalk,
 * telegraph with Charge, lunge in a straight line; a dodged lunge leaves them
 * exposed. Fliers and phasers (`floats`) cross walls; Phantump drains on a
 * hit; Pawniard chains a short, re-aimed second cut (`followUp`).
 */
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
      const path = pathDirection(state, enemy, target, def.floats === true);
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
        const second = def.followUp !== undefined && ai.chain === 1;
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: second ? 'lunge2' : 'lunge' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', second ? def.followUp!.lungeMs : def.lungeMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      const second = def.followUp !== undefined && ai.chain === 1;
      const speed = second ? def.followUp!.lungeDistance / def.followUp!.lungeMs : def.lungeDistance / def.lungeMs;
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, speed * ms));
      const hit = contactPlayer(state, enemy, def.attack, lungeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      // Pawniard: the first cut always chains into the second (hit, dodged or missed); its end follows the rules below.
      if (def.followUp && !second && (hit.contact === 'hit' || modeOver(ai))) {
        const { chain: _first, ...rest } = enemy.ai;
        enemy = telegraph({ ...enemy, ai: { ...rest, chain: 1 } }, 'lunge2', def.followUp.telegraphMs, toPlayer, events);
        break;
      }
      const done = (recoverMs: number): EnemyState => {
        const { chain: _cut, ...rest } = enemy.ai;
        return { ...enemy, ai: { ...enterMode(rest, 'recover', recoverMs), cooldownMs: def.cooldownMs } };
      };
      if (hit.contact === 'hit') {
        if (def.drainHp) enemy = { ...enemy, hp: Math.min(enemy.maxHp, enemy.hp + def.drainHp) };
        enemy = done(def.hitRecoverMs);
      } else if (modeOver(ai)) {
        enemy = done(def.missRecoverMs);
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

/** Casters: keep a distance band, telegraph and cast a slow ball (Gastly floats; Duskull floats and its wisp bends towards you) or a fan of threads (Spinarak walks). */
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
        for (const dir of spreadDirections(enemy.ai.attackDir, def.spread?.count ?? 1, def.spread?.degrees ?? 0)) state = spawnShot(state, enemy, def.projectile, dir);
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

/** Tanks (Pumpkaboo Super, Trevenant, Golett): walk in slowly, a long wind-up, then a ground slam around them (Golett: in front, aim fixed; Trevenant: and a ring of leaves). */
function updateSlammer(state: WorldState, start: EnemyState, def: SlammerDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach': {
      if (ai.cooldownMs <= 0 && dist <= def.slamRange) {
        enemy = telegraph(enemy, 'slam', def.telegraphMs, toPlayer, events);
        break;
      }
      const dir = pathDirection(state, enemy, target) ?? toPlayer;
      // Close enough to slam: hold the ground while the slam recharges.
      if (dist > def.slamRange * 0.6) enemy = moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000));
      enemy = { ...enemy, facing: dir };
      break;
    }
    case 'telegraph':
      // A frontal slam (Golett) keeps the aim it started with: step around it.
      if (def.arcDegrees === undefined) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'slam' });
        if (def.ring) for (const dir of spreadDirections(toPlayer, def.ring.count, 360 - 360 / def.ring.count)) state = spawnShot(state, enemy, def.ring.projectile, dir);
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.slamMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      const hit = contactPlayer(state, enemy, def.attack, slammerTouches(enemy, state.player.pos, def), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (modeOver(ai)) enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Foongus: stands still; when a player comes close it puffs and leaves a spore cloud on the spot. */
function updateSpore(state: WorldState, start: EnemyState, def: SporeDef, target: Vec2, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  switch (ai.mode) {
    case 'idle':
    case 'approach':
      enemy = { ...enemy, facing: toPlayer };
      if (ai.cooldownMs <= 0 && distance(enemy.pos, target) <= def.triggerRange) enemy = telegraph(enemy, 'spores', def.telegraphMs, toPlayer, events);
      break;
    case 'telegraph':
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'spores' });
        state = spawnShot(state, enemy, { ...def.cloud, speed: 0 }, toPlayer, enemy.pos);
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'recover', def.recoverMs), cooldownMs: def.cooldownMs } };
      }
      break;
    case 'recover':
      if (modeOver(ai)) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
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
  const { chain: _cut, ...ai } = enemy.ai;
  return { ...enemy, ai: enterMode(ai, mode) };
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
    else if (def.kind === 'slammer') current = updateSlammer(current, ticked, def, target, ms, events);
    else if (def.kind === 'spore') current = updateSpore(current, ticked, def, target, events);
    else if (def.kind === 'archer') current = updateArcher(current, ticked, def, target, ms, events);
    else if (def.kind === 'thief') current = updateThief(current, ticked, def, target, ms, events);
    else current = updateBoss(current, ticked, def, target, ms, events);
  }
  return current;
}
