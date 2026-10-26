import { ENEMY_BEHAVIOUR, type BeamDef, type BomberDef, type ConeDef, type CounterDef, type EnemyAttackDef, type EnemyDef, type MortarDef, type PulseDef, type RepeatDef } from '../data/enemies';
import { atLeast } from '../data/difficulty';
import { worldDifficulty } from './difficulty';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, perpendicular, replaceEnemy, spawnShot, spreadDirections, telegraph, towardTarget } from './brain';
import type { EnemyState, GameEvent, WorldState } from './state';
import { add, angleOf, clamp, distance, dot, fromAngle, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Brains of the experimental roster (data/enemies.ts, docs/gdd.md "Plantel
 * experimental"): crabs with a water jet down a locked lane and a frontal
 * shell (beam), Chinchou's electric ring (pulse), breath cones (Houndour,
 * Stunky), Slugma's lobbed lava (mortar), Koffing's gas and fuse (bomber)
 * and Croagunk's counter stance (counter). The hitboxes are shared with a
 * guest's victim-side check (`rosterAttack`), like victim.ts does for the
 * older kinds.
 */
export type RosterDef = BeamDef | PulseDef | ConeDef | MortarDef | BomberDef | CounterDef;

const PLAYER_RADIUS = TUNING.player.radius;
const DEG = Math.PI / 180;

function angleBetween(a: Vec2, b: Vec2): number {
  if (length(a) === 0 || length(b) === 0) return 0;
  return Math.acos(clamp(dot(normalize(a), normalize(b)), -1, 1));
}

/** `from` turned towards `to` by at most `maxRadians`. */
function turnToward(from: Vec2, to: Vec2, maxRadians: number): Vec2 {
  let delta = angleOf(to) - angleOf(from);
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  if (Math.abs(delta) <= maxRadians) return to;
  return fromAngle(angleOf(from) + Math.sign(delta) * maxRadians);
}

/** Starts the active part of the named attack. */
function fire(enemy: EnemyState, attack: string, durationMs: number, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyAttack', enemyId: enemy.id, attack });
  return { ...enemy, ai: { ...enterMode(enemy.ai, 'attack', durationMs), contact: 'none', attack } };
}

const rest = (enemy: EnemyState, recoverMs: number, cooldownMs: number): EnemyState => {
  const { chain: _again, ...ai } = enemy.ai;
  return { ...enemy, ai: { ...enterMode(ai, 'recover', recoverMs), cooldownMs } };
};

/**
 * Harder tiers (data `repeat`): the attack again after its own short,
 * re-aimed wind-up, up to `times` more, before the recovery. Null when it
 * is over (or the tier does not repeat): the caller rests.
 */
function again(state: WorldState, enemy: EnemyState, repeat: RepeatDef | undefined, attack: string, dir: Vec2, events: GameEvent[]): EnemyState | null {
  const done = enemy.ai.chain ?? 0;
  if (!repeat || !atLeast(worldDifficulty(state), repeat.minDifficulty) || done >= repeat.times) return null;
  return telegraph({ ...enemy, ai: { ...enemy.ai, chain: done + 1 } }, attack, repeat.telegraphMs, dir, events);
}

/** After the recovery: back to hunting, circling the other way. */
function rested(enemy: EnemyState): EnemyState {
  if (!modeOver(enemy.ai)) return enemy;
  return { ...enemy, ai: { ...enterMode(enemy.ai, 'approach'), strafeSign: enemy.ai.strafeSign === 1 ? -1 : 1 } };
}

/** Keeps a distance band to the target while strafing; out of sight it follows the flow field (floaters too). */
function holdBand(state: WorldState, enemy: EnemyState, target: Vec2, band: { min: number; max: number; speed: number }, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const path = pathDirection(state, enemy, target);
  const radial = dist < band.min ? scale(toPlayer, -1) : dist > band.max ? toPlayer : vec(0, 0);
  const dir = path ?? normalize(add(radial, scale(perpendicular(toPlayer, enemy.ai.strafeSign), 0.5)));
  return moveEnemy(state, enemy, scale(dir, (band.speed * ms) / 1000));
}

/** Walks at the target until `closeEnough`. */
function closeIn(state: WorldState, enemy: EnemyState, target: Vec2, speed: number, closeEnough: number, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dir = pathDirection(state, enemy, target) ?? toPlayer;
  const moved = distance(enemy.pos, target) > closeEnough ? moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)) : enemy;
  return { ...moved, facing: dir };
}

// Hitboxes against one player position (host brains and guest victim side).

/** A crab's jet: a lane of `length` x `width` from its body along the committed direction. */
export function beamTouches(enemy: EnemyState, player: Vec2, def: BeamDef): boolean {
  const offset = sub(player, enemy.pos);
  const dir = enemy.ai.attackDir;
  const along = dot(offset, dir);
  const across = Math.abs(offset.x * dir.y - offset.y * dir.x);
  return along >= -PLAYER_RADIUS && along <= def.length + PLAYER_RADIUS && across <= def.width / 2 + PLAYER_RADIUS;
}

/** Radius of Chinchou's ring front now: from its body out to `radius` over the attack. */
export function ringRadius(enemy: Pick<EnemyState, 'radius' | 'ai'>, def: PulseDef): number {
  const progress = enemy.ai.modeDurationMs > 0 ? clamp(enemy.ai.modeMs / enemy.ai.modeDurationMs, 0, 1) : 1;
  return enemy.radius + (def.radius - enemy.radius) * progress;
}

export function ringTouches(enemy: EnemyState, player: Vec2, def: PulseDef): boolean {
  return Math.abs(distance(enemy.pos, player) - ringRadius(enemy, def)) <= def.width / 2 + PLAYER_RADIUS;
}

/** A breath: a frontal sector of `reach` and `arcDegrees` along the committed direction. */
export function coneTouches(enemy: EnemyState, player: Vec2, def: ConeDef): boolean {
  const offset = sub(player, enemy.pos);
  const dist = length(offset);
  if (dist > def.reach + PLAYER_RADIUS) return false;
  return dist <= enemy.radius + PLAYER_RADIUS || angleBetween(enemy.ai.attackDir, offset) <= (def.arcDegrees * DEG) / 2;
}

/** Slugma's blob: only the landing (the last `impactMs` of the flight) hits, around the fixed landing point. */
export function landingTouches(enemy: EnemyState, player: Vec2, def: MortarDef): boolean {
  const at = enemy.ai.aimPoint;
  if (!at || enemy.ai.modeMs < enemy.ai.modeDurationMs - def.impactMs) return false;
  return distance(at, player) <= def.radius + PLAYER_RADIUS;
}

const bodyTouches = (enemy: EnemyState, player: Vec2): boolean => distance(enemy.pos, player) <= enemy.radius + PLAYER_RADIUS;

/** Croagunk's blow in progress: the counter-punch or the Poison Jab. */
const counterBlow = (enemy: EnemyState, def: CounterDef) => (enemy.ai.attack === 'counter' ? def.counter : def.jab);

/** The roster attack an enemy in its attack mode is throwing at `player`, and whether it touches; null when nothing melee is active. */
export function rosterAttack(enemy: EnemyState, def: RosterDef, player: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  switch (def.kind) {
    case 'beam':
      return { attack: def.attack, touches: beamTouches(enemy, player, def) };
    case 'pulse':
      return { attack: def.attack, touches: ringTouches(enemy, player, def) };
    case 'cone':
      return { attack: def.attack, touches: coneTouches(enemy, player, def) };
    case 'mortar':
      return { attack: def.attack, touches: landingTouches(enemy, player, def) };
    case 'bomber':
      return enemy.ai.attack === 'explode' ? { attack: def.explode.attack, touches: distance(enemy.pos, player) <= def.explode.radius + PLAYER_RADIUS } : null;
    case 'counter':
      return { attack: counterBlow(enemy, def).attack, touches: bodyTouches(enemy, player) };
  }
}

export const isRosterDef = (def: EnemyDef): def is RosterDef =>
  def.kind === 'beam' || def.kind === 'pulse' || def.kind === 'cone' || def.kind === 'mortar' || def.kind === 'bomber' || def.kind === 'counter';

/** The local player meets the active attack (once per attack). */
function strikePhase(state: WorldState, enemy: EnemyState, def: RosterDef, events: GameEvent[]): { state: WorldState; enemy: EnemyState } {
  const active = rosterAttack(enemy, def, state.player.pos);
  if (!active) return { state, enemy };
  const hit = contactPlayer(state, enemy, active.attack, active.touches, events);
  return { state: hit.state, enemy: { ...enemy, ai: { ...enemy.ai, contact: hit.contact } } };
}

// Guards.

/**
 * Chip factor of a hit from `from` that this enemy's guard stops, or null:
 * a crab's shell covers its front except while it recovers; Croagunk's
 * stance (and the counter it answers with) blocks everything.
 */
export function guardChip(enemy: EnemyState, from: Vec2): number | null {
  const def = ENEMY_BEHAVIOUR[enemy.species];
  if (def?.kind === 'counter') {
    const guarding = enemy.ai.mode === 'telegraph' && (enemy.ai.attack === 'stance' || enemy.ai.attack === 'counter');
    return guarding ? 0 : null;
  }
  if (def?.kind !== 'beam' || !def.guard || enemy.ai.mode === 'recover') return null;
  const incoming = sub(from, enemy.pos);
  if (length(incoming) === 0) return null;
  return angleBetween(enemy.facing, incoming) <= (def.guard.arcDegrees * DEG) / 2 ? def.guard.chipFactor : null;
}

/** Croagunk answers a blocked hit during its stance with the counter-punch, aimed at whoever struck from `from`. */
export function answerGuardedHit(enemy: EnemyState, from: Vec2, events: GameEvent[]): EnemyState {
  const def = ENEMY_BEHAVIOUR[enemy.species];
  if (def?.kind !== 'counter' || enemy.ai.mode !== 'telegraph' || enemy.ai.attack !== 'stance') return enemy;
  const dir = normalize(sub(from, enemy.pos));
  return telegraph(enemy, 'counter', def.counter.telegraphMs, length(dir) > 0 ? dir : enemy.facing, events);
}

/** Koffing's fuse and blast go on through stagger. */
export const unstoppable = (enemy: EnemyState): boolean => enemy.ai.attack === 'explode' && (enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack');

// Brains.

function updateBeam(state: WorldState, start: EnemyState, def: BeamDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const turn = def.turnRateDegPerSec * DEG * (ms / 1000);
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach': {
      const facing = turnToward(enemy.facing, toPlayer, turn);
      enemy = { ...holdBand(state, enemy, target, { min: def.minDistance, max: def.maxDistance, speed: def.walkSpeed }, ms), facing };
      const aimed = angleBetween(facing, toPlayer) <= 30 * DEG;
      if (ai.cooldownMs <= 0 && aimed && dist <= def.length && dist >= def.minDistance * 0.6) enemy = telegraph(enemy, 'jet', def.telegraphMs, facing, events);
      break;
    }
    case 'telegraph':
      // The lane follows the player at the crab's turn rate, then locks `lockMs` before the jet.
      if (ai.modeDurationMs - ai.modeMs > def.lockMs) {
        const facing = turnToward(enemy.facing, toPlayer, turn);
        enemy = { ...enemy, facing, ai: { ...ai, attackDir: facing } };
      }
      if (modeOver(ai)) enemy = fire(enemy, 'jet', def.beamMs, events);
      break;
    case 'attack': {
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      // Harder tiers (Corphish): a second jet down a lane re-aimed at the crab's turn rate.
      if (modeOver(ai)) enemy = again(state, enemy, def.repeat, 'jet', enemy.facing, events) ?? rest(enemy, def.recoverMs, def.cooldownMs);
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

function updatePulse(state: WorldState, start: EnemyState, def: PulseDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.maxDistance) {
        enemy = telegraph(enemy, 'pulse', def.telegraphMs, toPlayer, events);
        break;
      }
      enemy = { ...holdBand(state, enemy, target, { min: def.minDistance, max: def.maxDistance, speed: def.speed }, ms), facing: toPlayer };
      break;
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer };
      if (modeOver(ai)) enemy = fire(enemy, 'pulse', def.pulseMs, events);
      break;
    case 'attack':
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      // Harder tiers (Chinchou): a second ring right after.
      if (modeOver(ai)) enemy = again(state, enemy, def.repeat, 'pulse', toPlayer, events) ?? rest(enemy, def.recoverMs, def.cooldownMs);
      break;
    case 'recover':
      enemy = rested(enemy);
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

function updateCone(state: WorldState, start: EnemyState, def: ConeDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  // Stunky turns its back to spray; the cone still points at the player.
  const look = (dir: Vec2) => (def.turnsAway ? scale(dir, -1) : dir);
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.engageRange) {
        const wound = telegraph(enemy, 'breath', def.telegraphMs, toPlayer, events);
        enemy = { ...wound, facing: look(toPlayer) };
        break;
      }
      enemy = closeIn(state, enemy, target, def.walkSpeed, def.engageRange * 0.7, ms);
      break;
    case 'telegraph':
      // Tracks the player until the breath starts; then the cone is fixed (step out of it or roll).
      enemy = { ...enemy, facing: look(toPlayer), ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) enemy = fire(enemy, 'breath', def.breathMs, events);
      break;
    case 'attack':
      // Harder tiers (Houndour): the flame turns after the player while it lasts (outrun it sideways).
      if (def.sweep && atLeast(worldDifficulty(state), def.sweep.minDifficulty)) {
        const attackDir = turnToward(ai.attackDir, toPlayer, def.sweep.degPerSec * DEG * (ms / 1000));
        enemy = { ...enemy, facing: def.turnsAway ? scale(attackDir, -1) : attackDir, ai: { ...enemy.ai, attackDir } };
      }
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      if (modeOver(ai)) {
        if (def.linger) state = spawnShot(state, enemy, { ...def.linger, speed: 0 }, ai.attackDir, add(enemy.pos, scale(ai.attackDir, def.reach * 0.55)));
        enemy = rest(enemy, def.recoverMs, def.cooldownMs);
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

/** Where Slugma's blob lands: at the target, no farther than `maxThrow`. */
function landingPoint(from: Vec2, target: Vec2, def: MortarDef): Vec2 {
  const offset = sub(target, from);
  const dist = length(offset);
  return dist <= def.maxThrow ? target : add(from, scale(offset, def.maxThrow / dist));
}

function updateMortar(state: WorldState, start: EnemyState, def: MortarDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.maxDistance && dist >= def.minDistance * 0.5) {
        const wound = telegraph(enemy, 'lob', def.telegraphMs, toPlayer, events);
        enemy = { ...wound, ai: { ...wound.ai, aimPoint: landingPoint(enemy.pos, target, def) } };
        break;
      }
      enemy = { ...holdBand(state, enemy, target, { min: def.minDistance, max: def.maxDistance, speed: def.walkSpeed }, ms), facing: toPlayer };
      break;
    case 'telegraph':
      // The marked circle follows the player during the wind-up and stays where it was once the blob leaves.
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer, aimPoint: landingPoint(enemy.pos, target, def) } };
      if (modeOver(ai)) enemy = fire(enemy, 'lob', def.flightMs, events);
      break;
    case 'attack':
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      if (modeOver(ai)) {
        if (ai.aimPoint) state = spawnShot(state, enemy, { ...def.pool, speed: 0 }, ai.attackDir, ai.aimPoint);
        // Shellos (hard on): the landing throws a ring of droplets outwards from where it fell.
        if (ai.aimPoint && def.splash) {
          for (const dir of spreadDirections(ai.attackDir, def.splash.count, 360 - 360 / def.splash.count)) {
            state = spawnShot(state, enemy, def.splash.projectile, dir, add(ai.aimPoint, scale(dir, def.splash.projectile.radius + 4)));
          }
        }
        // Harder tiers (Slugma): a second blob at where the player stands now (marked again from its wind-up).
        const next = again(state, enemy, def.repeat, 'lob', toPlayer, events);
        enemy = next ? { ...next, ai: { ...next.ai, aimPoint: landingPoint(enemy.pos, target, def) } } : rest(enemy, def.recoverMs, def.cooldownMs);
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

function updateBomber(state: WorldState, start: EnemyState, def: BomberDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  // Low on HP and hunting: the fuse starts, whatever it was doing.
  if (!unstoppable(enemy) && ai.mode !== 'idle' && enemy.hp <= enemy.maxHp * def.explode.belowHp) {
    return replaceEnemy(state, telegraph(enemy, 'explode', def.explode.telegraphMs, toPlayer, events));
  }
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.puffRange) {
        enemy = telegraph(enemy, 'puff', def.telegraphMs, toPlayer, events);
        break;
      }
      enemy = closeIn(state, enemy, target, def.speed, def.keepDistance, ms);
      break;
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer };
      if (!modeOver(ai)) break;
      if (ai.attack === 'explode') {
        enemy = fire(enemy, 'explode', def.explode.blastMs, events);
      } else {
        // The gas lands between it and the player.
        state = spawnShot(state, enemy, { ...def.cloud, speed: 0 }, toPlayer, add(enemy.pos, scale(toPlayer, Math.min(dist, def.cloud.radius))));
        enemy = rest(enemy, def.recoverMs, def.cooldownMs);
      }
      break;
    case 'attack':
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      if (modeOver(ai)) {
        // The blast spends Koffing.
        events.push({ type: 'enemyDefeated', enemyId: enemy.id });
        enemy = { ...enemy, hp: 0, alive: false, spent: true };
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

function updateCounter(state: WorldState, start: EnemyState, def: CounterDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = { ...enemy, ai: enterMode(ai, 'approach') };
      break;
    case 'approach':
      if (ai.cooldownMs <= 0 && dist <= def.engageRange) {
        enemy = telegraph(enemy, 'stance', def.stanceMs, toPlayer, events);
        break;
      }
      enemy = closeIn(state, enemy, target, def.walkSpeed, enemy.radius + PLAYER_RADIUS + 6, ms);
      break;
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (!modeOver(ai)) break;
      // Nobody took the bait: the stance ends in the slower jab.
      if (ai.attack === 'stance') enemy = telegraph(enemy, 'jab', def.jab.telegraphMs, toPlayer, events);
      else enemy = fire(enemy, ai.attack ?? 'jab', counterBlow(enemy, def).lungeMs, events);
      break;
    case 'attack': {
      const blow = counterBlow(enemy, def);
      enemy = moveEnemy(state, enemy, scale(ai.attackDir, (blow.lungeDistance / blow.lungeMs) * ms));
      ({ state, enemy } = strikePhase(state, enemy, def, events));
      // Harder tiers (Croagunk): the Poison Jab chained once more (never after the counter-punch).
      if (enemy.ai.contact === 'hit' || modeOver(ai)) enemy = (ai.attack === 'jab' ? again(state, enemy, def.repeat, 'jab', toPlayer, events) : null) ?? rest(enemy, def.recoverMs, def.cooldownMs);
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

/** Runs the brain of a roster enemy for one step (enemies.ts dispatches here). */
export function updateRoster(state: WorldState, enemy: EnemyState, def: EnemyDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!isRosterDef(def)) return state;
  switch (def.kind) {
    case 'beam':
      return updateBeam(state, enemy, def, target, ms, events);
    case 'pulse':
      return updatePulse(state, enemy, def, target, ms, events);
    case 'cone':
      return updateCone(state, enemy, def, target, ms, events);
    case 'mortar':
      return updateMortar(state, enemy, def, target, ms, events);
    case 'bomber':
      return updateBomber(state, enemy, def, target, ms, events);
    case 'counter':
      return updateCounter(state, enemy, def, target, ms, events);
  }
}
