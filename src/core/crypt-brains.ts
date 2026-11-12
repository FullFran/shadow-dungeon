import type { EnemyAttackDef, EnemyDef } from '../data/enemies';
import type { AlarmDef, BoomerangDef, CryptDef, DiverDef, SupportDef } from '../data/crypt-enemies';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, perpendicular, replaceEnemy, telegraph, towardTarget } from './brain';
import { wakeEnemy } from './activation';
import type { EnemyState, GameEvent, WorldState } from './state';
import { stealItem } from './stolen';
import { add, distance, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Brains of the Crypt's second wave (data/crypt-enemies.ts): Honedge's
 * boomerang spin (out and back, both passes hit), Bronzor's warding ring
 * (support), Klefki's jingle (alarm) and Murkrow's thieving dive. Yamask is a
 * caster with a disguise (core/activation.ts) and a cursed shot (core/combat.ts).
 */
export const isCryptDef = (def: EnemyDef): def is CryptDef => def.kind === 'boomerang' || def.kind === 'support' || def.kind === 'alarm' || def.kind === 'diver';

/** Body contact (a spin, a dive), the same rule as a lunge (victim.ts). */
const bodyTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + TUNING.player.radius;

/** The aim follows the player until the last `lockMs` of the wind-up (the dodge cue). */
function trackAim(enemy: EnemyState, toPlayer: Vec2, lockMs: number): EnemyState {
  return enemy.ai.modeDurationMs - enemy.ai.modeMs > lockMs ? { ...enemy, facing: toPlayer, ai: { ...enemy.ai, attackDir: toPlayer } } : enemy;
}

function recover(enemy: EnemyState, recoverMs: number, cooldownMs: number): EnemyState {
  const { chain: _done, aimPoint: _from, ...ai } = enemy.ai;
  return { ...enemy, ai: { ...enterMode(ai, 'recover', recoverMs), cooldownMs } };
}

function rested(enemy: EnemyState): EnemyState {
  if (!modeOver(enemy.ai)) return enemy;
  return { ...enemy, ai: { ...enterMode(enemy.ai, 'approach'), strafeSign: enemy.ai.strafeSign === 1 ? -1 : 1 } };
}

/** Keeps the distance band to the target (around walls when out of sight), sliding sideways inside it. */
function keepBand(state: WorldState, enemy: EnemyState, target: Vec2, speed: number, min: number, max: number, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const path = pathDirection(state, enemy, target);
  const radial = dist < min ? scale(toPlayer, -1) : dist > max ? toPlayer : vec(0, 0);
  const dir = dist > max && path ? path : length(radial) > 0 ? radial : perpendicular(toPlayer, enemy.ai.strafeSign);
  return { ...moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)), facing: toPlayer };
}

/** Walk towards the target (around walls when out of sight), stopping `stopAt` away. */
function closeIn(state: WorldState, enemy: EnemyState, target: Vec2, speed: number, stopAt: number, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dir = pathDirection(state, enemy, target) ?? toPlayer;
  const moved = distance(enemy.pos, target) > stopAt ? moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)) : enemy;
  return { ...moved, facing: dir };
}

// Boomerang (Honedge).

/** Where the spin is going this step: out along the lane for `outMs`, then back to where it started. */
export function boomerangStep(enemy: EnemyState, def: BoomerangDef, ms: number): { delta: Vec2; leg: 'out' | 'back' } {
  const ai = enemy.ai;
  if (ai.modeMs < def.outMs) return { delta: scale(ai.attackDir, (def.reach / def.outMs) * ms), leg: 'out' };
  const home = ai.aimPoint ?? enemy.pos;
  const offset = sub(home, enemy.pos);
  const step = (def.reach / def.backMs) * ms;
  return { delta: length(offset) <= step ? offset : scale(normalize(offset), step), leg: 'back' };
}

function updateBoomerang(state: WorldState, start: EnemyState, def: BoomerangDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const ai = enemy.ai;
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
    case 'reposition':
      if (ai.cooldownMs <= 0 && dist <= def.engageRange && !pathDirection(state, enemy, target)) {
        enemy = telegraph(enemy, 'spin', def.telegraphMs, toPlayer, events);
        break;
      }
      enemy = closeIn(state, enemy, target, def.walkSpeed, def.engageRange * 0.7, ms);
      break;
    case 'telegraph':
      enemy = trackAim(enemy, toPlayer, def.lockMs);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'spin' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.outMs + def.backMs), attack: 'out', contact: 'none', aimPoint: enemy.pos } };
      }
      break;
    case 'attack': {
      const { delta, leg } = boomerangStep(enemy, def, ms);
      // The way back is a second pass: it may hit again.
      if (leg === 'back' && ai.attack !== 'back') enemy = { ...enemy, ai: { ...enemy.ai, attack: 'back', contact: 'none' } };
      enemy = moveEnemy(state, enemy, delta);
      const hit = contactPlayer(state, enemy, def.attack, bodyTouches(enemy, state.player.pos), events);
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

// Support (Bronzor) and alarm (Klefki): a channel that a hit cancels (core/enemies.ts `interrupted`).

/** Awake allies of `enemy` within `radius` that a ward would help (alive, not itself, not armored yet). */
export function wardTargets(state: WorldState, enemy: EnemyState, radius: number): EnemyState[] {
  return state.enemies.filter((e) => e.alive && e.id !== enemy.id && !e.armor && !e.boss && e.ai.mode !== 'asleep' && e.ai.mode !== 'dormant' && distance(e.pos, enemy.pos) <= radius);
}

/** The ring completes: every ally in reach gains one-hit armor (the elite's armor flag, sent with the snapshot). */
export function ward(state: WorldState, enemy: EnemyState, radius: number): WorldState {
  const ids = new Set(wardTargets(state, enemy, radius).map((e) => e.id));
  if (ids.size === 0) return state;
  return { ...state, enemies: state.enemies.map((e) => (ids.has(e.id) ? { ...e, armor: true as const } : e)) };
}

function updateSupport(state: WorldState, start: EnemyState, def: SupportDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const ai = enemy.ai;
  switch (ai.mode) {
    case 'idle':
      if (distance(enemy.pos, target) <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
    case 'reposition':
      if (ai.cooldownMs <= 0 && wardTargets(state, enemy, def.radius).length > 0) {
        enemy = telegraph(enemy, 'ward', def.channelMs, toPlayer, events);
        break;
      }
      enemy = keepBand(state, enemy, target, def.walkSpeed, def.minDistance, def.maxDistance, ms);
      break;
    case 'telegraph':
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'ward' });
        state = ward(state, enemy, def.radius);
        enemy = recover(enemy, def.recoverMs, def.cooldownMs);
      }
      break;
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/** Sleeping enemies within `radius` of `enemy`: the ones its jingle would call. */
export const sleepersNear = (state: WorldState, enemy: EnemyState, radius: number): EnemyState[] =>
  state.enemies.filter((e) => e.alive && e.id !== enemy.id && e.ai.mode === 'asleep' && distance(e.pos, enemy.pos) <= radius);

/** The jingle completes: every sleeper in reach wakes (a disguised one rises first). */
export function ring(state: WorldState, enemy: EnemyState, radius: number): WorldState {
  const ids = new Set(sleepersNear(state, enemy, radius).map((e) => e.id));
  if (ids.size === 0) return state;
  return { ...state, enemies: state.enemies.map((e) => (ids.has(e.id) ? wakeEnemy(e) : e)) };
}

function updateAlarm(state: WorldState, start: EnemyState, def: AlarmDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const toPlayer = towardTarget(target, enemy);
  const ai = enemy.ai;
  switch (ai.mode) {
    case 'idle':
      if (distance(enemy.pos, target) <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
    case 'reposition':
      if (ai.cooldownMs <= 0 && !pathDirection(state, enemy, target)) {
        enemy = telegraph(enemy, 'jingle', def.jingleMs, toPlayer, events);
        break;
      }
      enemy = keepBand(state, enemy, target, def.walkSpeed, def.minDistance, def.maxDistance, ms);
      break;
    case 'telegraph':
      enemy = keepBand(state, enemy, target, def.walkSpeed * 0.5, def.minDistance, def.maxDistance, ms);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'jingle' });
        state = ring(state, enemy, def.wakeRadius);
        enemy = recover(enemy, def.recoverMs, def.cooldownMs);
      }
      break;
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

// Diver (Murkrow).

function updateDiver(state: WorldState, start: EnemyState, def: DiverDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
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
        enemy = telegraph(enemy, 'dive', def.telegraphMs, toPlayer, events);
        break;
      }
      const radial = dist > def.circleRange + 20 ? toPlayer : dist < def.circleRange - 30 ? scale(toPlayer, -1) : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.8)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph':
      enemy = trackAim(enemy, toPlayer, def.lockMs);
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'dive' });
        enemy = { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', def.diveMs), attack: 'dive', contact: 'none' } };
      }
      break;
    case 'attack': {
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, (def.diveDistance / def.diveMs) * ms));
      const before = enemy.ai.contact;
      const hit = contactPlayer(state, enemy, def.attack, bodyTouches(enemy, state.player.pos), events);
      state = hit.state;
      // A dive that hurts takes the last held item (borrowed: core/stolen.ts).
      if (before === 'none' && hit.contact === 'hit') state = { ...state, player: stealItem(state.player, enemy.id, def.stealMs, events) };
      enemy = { ...enemy, ai: { ...enemy.ai, contact: hit.contact } };
      if (!modeOver(enemy.ai)) break;
      // After a hit it flies off to the far side; a miss leaves it open.
      enemy = hit.contact === 'hit' ? { ...enemy, ai: { ...enterMode(enemy.ai, 'reposition', def.fleeMs), attack: 'flee' } } : recover(enemy, def.recoverMs, def.cooldownMs);
      break;
    }
    case 'reposition':
      enemy = { ...moveEnemy(state, enemy, scale(toPlayer, -(def.fleeSpeed * ms) / 1000)), facing: scale(toPlayer, -1) };
      if (modeOver(ai) || ai.modeDurationMs === 0) enemy = recover(enemy, def.recoverMs, def.cooldownMs);
      break;
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

export function updateCrypt(state: WorldState, enemy: EnemyState, def: CryptDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (def.kind === 'boomerang') return updateBoomerang(state, enemy, def, target, ms, events);
  if (def.kind === 'support') return updateSupport(state, enemy, def, target, ms, events);
  if (def.kind === 'alarm') return updateAlarm(state, enemy, def, target, ms, events);
  return updateDiver(state, enemy, def, target, ms, events);
}

/** Guest side: the body attack in progress (a spin, a dive), if any, and whether it touches `player`; the channels never hurt. */
export function cryptAttack(enemy: EnemyState, def: CryptDef, player: Vec2): { attack: EnemyAttackDef; touches: boolean; steals?: number } | null {
  if (enemy.ai.mode !== 'attack') return null;
  if (def.kind === 'boomerang') return { attack: def.attack, touches: bodyTouches(enemy, player) };
  if (def.kind === 'diver') return { attack: def.attack, touches: bodyTouches(enemy, player), steals: def.stealMs };
  return null;
}
