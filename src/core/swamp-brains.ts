import { atLeast } from '../data/difficulty';
import type { EnemyAttackDef, EnemyDef, SwampDef } from '../data/enemies';
import type { DasherDef, RollerDef, SniperDef } from '../data/swamp-enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, perpendicular, replaceEnemy, spawnShot, spreadDirections, telegraph, towardTarget } from './brain';
import { worldDifficulty } from './difficulty';
import { confineCircle } from './geometry';
import type { Arena, EnemyState, GameEvent, WorldState } from './state';
import { queenAttack, ultraAttack, updateQueen, updateUltra } from './swamp-bosses';
import { TUNING } from '../data/tuning';
import { add, distance, length, normalize, scale, vec, type Vec2 } from './vec';

/** Body contact (a roll, a dash), the same rule as a lunge (victim.ts). */
const lungeTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + TUNING.player.radius;

/**
 * Brains of the Toxic Swamp's new enemies (data/swamp-enemies.ts): Venipede
 * rolls down a locked lane and bounces off walls (roller), Salandit dashes
 * past the player leaving a line of toxic smoke (dasher), Skrelp aims a
 * locked ink line from afar and spits a fast bolt, then hops back (sniper).
 * Each has one extra trick on hard and above.
 */
export const isSwampDef = (def: EnemyDef): def is SwampDef =>
  def.kind === 'roller' || def.kind === 'dasher' || def.kind === 'sniper' || def.kind === 'queen' || def.kind === 'ultra';

/** The aim follows the player until the last `lockMs` of the wind-up (the dodge cue). */
const tracking = (enemy: EnemyState, lockMs: number): boolean => enemy.ai.modeDurationMs - enemy.ai.modeMs > lockMs;

function trackAim(enemy: EnemyState, toPlayer: Vec2, lockMs: number): EnemyState {
  return tracking(enemy, lockMs) ? { ...enemy, facing: toPlayer, ai: { ...enemy.ai, attackDir: toPlayer } } : enemy;
}

function recover(enemy: EnemyState, recoverMs: number, cooldownMs: number): EnemyState {
  const { chain: _done, ...ai } = enemy.ai;
  return { ...enemy, ai: { ...enterMode(ai, 'recover', recoverMs), cooldownMs } };
}

function rested(enemy: EnemyState): EnemyState {
  if (!modeOver(enemy.ai)) return enemy;
  return { ...enemy, ai: { ...enterMode(enemy.ai, 'approach'), strafeSign: enemy.ai.strafeSign === 1 ? -1 : 1 } };
}

/** Walk towards the target (around walls when out of sight), stopping `stopAt` away. */
function closeIn(state: WorldState, enemy: EnemyState, target: Vec2, speed: number, stopAt: number, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dir = pathDirection(state, enemy, target) ?? toPlayer;
  const moved = distance(enemy.pos, target) > stopAt ? moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)) : enemy;
  return { ...moved, facing: dir };
}

/** Number of walls a roll may bounce off: one more on hard and above. */
export const rollerBounces = (def: RollerDef, state: Pick<WorldState, 'difficulty'>): number =>
  def.bounces + (atLeast(worldDifficulty(state), def.extraBounce.minDifficulty) ? 1 : 0);

/**
 * One step of a roll: straight along the committed lane; meeting a wall or a
 * block turns it back along the blocked axis while bounces are left (it
 * stops dead otherwise).
 */
export function rollStep(state: WorldState, enemy: EnemyState, def: RollerDef, ms: number): EnemyState {
  const stepVec = scale(enemy.ai.attackDir, (def.rollSpeed * ms) / 1000);
  const desired = add(enemy.pos, stepVec);
  const pos = confineCircle(state.arena, desired, enemy.radius);
  if (distance(pos, desired) < 0.5) return { ...enemy, pos, facing: enemy.ai.attackDir };
  const left = enemy.ai.chain ?? 0;
  if (left <= 0) return { ...enemy, pos, ai: { ...enemy.ai, modeMs: enemy.ai.modeDurationMs } };
  const blockedX = distance(confineCircle(state.arena, add(enemy.pos, vec(stepVec.x, 0)), enemy.radius), add(enemy.pos, vec(stepVec.x, 0))) >= 0.5;
  const blockedY = distance(confineCircle(state.arena, add(enemy.pos, vec(0, stepVec.y)), enemy.radius), add(enemy.pos, vec(0, stepVec.y))) >= 0.5;
  const dir = enemy.ai.attackDir;
  const bounced = normalize(vec(blockedX || !blockedY ? -dir.x : dir.x, blockedY || !blockedX ? -dir.y : dir.y));
  return { ...enemy, pos, facing: bounced, ai: { ...enemy.ai, attackDir: bounced, chain: left - 1 } };
}

function updateRoller(state: WorldState, start: EnemyState, def: RollerDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.engageRange && !pathDirection(state, enemy, target)) {
        enemy = telegraph(enemy, 'roll', def.telegraphMs, toPlayer, events);
        enemy = { ...enemy, ai: { ...enemy.ai, chain: rollerBounces(def, state) } };
        break;
      }
      enemy = closeIn(state, enemy, target, def.walkSpeed, def.engageRange * 0.5, ms);
      break;
    case 'telegraph':
      enemy = trackAim(enemy, toPlayer, def.lockMs);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'roll' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.rollMs), contact: 'none' } };
      }
      break;
    case 'attack': {
      enemy = rollStep(state, enemy, def, ms);
      const hit = contactPlayer(state, enemy, def.attack, lungeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (modeOver(enemy.ai)) enemy = recover(enemy, def.recoverMs, def.cooldownMs);
      break;
    }
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** True when Salandit turns for a second dash (hard and above). */
export const dashesBack = (def: DasherDef, state: Pick<WorldState, 'difficulty'>): boolean => atLeast(worldDifficulty(state), def.returnDash.minDifficulty);

function updateDasher(state: WorldState, start: EnemyState, def: DasherDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
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
        enemy = { ...moveEnemy(state, enemy, scale(path, (def.walkSpeed * ms) / 1000)), facing: path };
        break;
      }
      if (ai.cooldownMs <= 0 && dist <= def.engageRange) {
        enemy = telegraph(enemy, 'dash', def.telegraphMs, toPlayer, events);
        break;
      }
      // Circles the player at its range, quick on its feet.
      const radial = dist > def.circleRange + 20 ? toPlayer : dist < def.circleRange - 30 ? scale(toPlayer, -1) : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.8)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      enemy = trackAim(enemy, toPlayer, ai.chain === 1 ? 0 : def.lockMs);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: ai.chain === 1 ? 'dash2' : 'dash' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.dashMs), contact: 'none', aimPoint: enemy.pos } };
      }
      break;
    case 'attack': {
      const from = enemy.pos;
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, (def.dashDistance / def.dashMs) * ms));
      // Smoke puffs along the way, one every `everyPx` from where the dash began.
      const origin = ai.aimPoint ?? from;
      const before = Math.floor(distance(origin, from) / def.smoke.everyPx);
      const after = Math.floor(distance(origin, enemy.pos) / def.smoke.everyPx);
      if (after > before) state = spawnShot(state, enemy, { ...def.smoke.puff, speed: 0 }, ai.attackDir, enemy.pos);
      const hit = contactPlayer(state, enemy, def.attack, lungeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (!modeOver(ai)) break;
      if (ai.chain !== 1 && dashesBack(def, state)) {
        const back = towardTarget(target, enemy);
        enemy = telegraph({ ...enemy, ai: { ...enemy.ai, chain: 1 } }, 'dash2', def.returnDash.telegraphMs, back, events);
        break;
      }
      const { aimPoint: _from, ...rest } = enemy.ai;
      enemy = recover({ ...enemy, ai: rest }, def.recoverMs, def.cooldownMs);
      break;
    }
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Ink bolts per spit: a narrow fan on hard and above. */
export const sniperShots = (def: SniperDef, state: Pick<WorldState, 'difficulty'>): number => (atLeast(worldDifficulty(state), def.fan.minDifficulty) ? def.fan.count : 1);

function updateSniper(state: WorldState, start: EnemyState, def: SniperDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
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
      const inBand = dist >= def.minDistance && dist <= def.maxDistance;
      if (!path && inBand && ai.cooldownMs <= 0) {
        enemy = telegraph(enemy, 'ink', def.telegraphMs, toPlayer, events);
        break;
      }
      const radial = dist < def.minDistance ? scale(toPlayer, -1) : dist > def.maxDistance ? toPlayer : vec(0, 0);
      const dir = path ?? (length(radial) > 0 ? radial : perpendicular(toPlayer, ai.strafeSign));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      enemy = trackAim(enemy, toPlayer, def.lockMs);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'ink' });
        const count = sniperShots(def, state);
        for (const dir of spreadDirections(enemy.ai.attackDir, count, count > 1 ? def.fan.degrees : 0)) state = spawnShot(state, enemy, def.bolt, dir);
        enemy = { ...enemy, ai: enterMode(enemy.ai, 'attack', def.hop.ms) };
      }
      break;
    case 'attack':
      // The hop back after spitting.
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, -(def.hop.distance / def.hop.ms) * ms));
      if (modeOver(ai)) enemy = recover(enemy, def.recoverMs, def.cooldownMs);
      break;
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

export function updateSwamp(state: WorldState, enemy: EnemyState, def: SwampDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (def.kind === 'roller') return updateRoller(state, enemy, def, target, ms, events);
  if (def.kind === 'dasher') return updateDasher(state, enemy, def, target, ms, events);
  if (def.kind === 'queen') return updateQueen(state, enemy, def, target, ms, events);
  if (def.kind === 'ultra') return updateUltra(state, enemy, def, target, ms, events);
  return updateSniper(state, enemy, def, target, ms, events);
}

/** Guest side: the swamp melee attack in progress, if any, and whether it touches `player` (Skrelp only throws). */
export function swampAttack(arena: Pick<Arena, 'width' | 'height'>, enemy: EnemyState, def: SwampDef, player: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  if (def.kind === 'queen') return queenAttack(arena, enemy, def, player);
  if (def.kind === 'ultra') return ultraAttack(arena, enemy, def, player);
  if (enemy.ai.mode !== 'attack' || def.kind === 'sniper') return null;
  return { attack: def.attack, touches: lungeTouches(enemy, player) };
}

/** Where the roll would carry from `from` along `dir` (renderer: the lane telegraph's length). */
export const rollReach = (def: RollerDef): number => (def.rollSpeed * def.rollMs) / 1000;
