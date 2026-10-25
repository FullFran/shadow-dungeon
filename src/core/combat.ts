import { AEGISLASH, floatsOf, poiseOf } from '../data/enemies';
import { MOVES, type MoveDef } from '../data/moves';
import { TUNING } from '../data/tuning';
import { blocksHit, onBossDamaged } from './boss';
import { computeDamage } from './damage';
import { confineCircle } from './geometry';
import { landHitOnPlayer } from './hits';
import type { ActionPhase, ActionState, EnemyState, GameEvent, PlayerInput, ProjectileState, WorldState } from './state';
import { enemyTimeScale } from './time';
import { FIXED_DT_MS } from './timestep';
import { add, distance, dot, length, normalize, scale, sub, vec, type Vec2 } from './vec';

const { combat: COMBAT, player: PLAYER } = TUNING;
export const PLAYER_ID = 'player';

/**
 * Direction the player's moves go: at the locked target if any, else towards
 * the cursor; the facing when the point is on top of the player.
 */
export function aimDirection(state: WorldState, input: PlayerInput): Vec2 {
  const target = state.lock.targetId ? state.enemies.find((e) => e.id === state.lock.targetId) : undefined;
  const dir = normalize(sub(target?.pos ?? input.aim, state.player.pos));
  return length(dir) > 0 ? dir : state.player.facing;
}

function chargeLevelFor(move: MoveDef, chargeMs: number): number {
  const levels = move.charge ?? [];
  let level = 0;
  levels.forEach((candidate, index) => {
    if (chargeMs >= candidate.holdMs) level = index;
  });
  return level;
}

function chargeOf(move: MoveDef, level: number) {
  return move.charge?.[level] ?? { holdMs: 0, damageMultiplier: 1, sizeMultiplier: 1, speedMultiplier: 1 };
}

function phaseDuration(move: MoveDef, phase: ActionPhase): number {
  if (phase === 'windup') return move.windupMs;
  if (phase === 'active') return move.activeMs;
  if (phase === 'recovery') return move.recoveryMs;
  return Number.POSITIVE_INFINITY;
}

const NEXT_PHASE: Record<ActionPhase, ActionPhase | null> = {
  charging: 'windup',
  windup: 'active',
  active: 'recovery',
  recovery: null,
};

/** Pressing a slot button starts its move if the player is free and can pay the stamina. */
function tryStartAction(state: WorldState, input: PlayerInput, events: GameEvent[]): WorldState {
  const { player } = state;
  if (player.action || player.roll) return state;
  const slotIndex = player.loadout.findIndex((moveId, i) => moveId !== null && input.slots[i] && !player.slotsHeld[i]);
  if (slotIndex < 0) return state;
  const move = MOVES[player.loadout[slotIndex]!];
  if (player.stamina < move.staminaCost) {
    events.push({ type: 'moveDenied', moveId: move.id });
    return state;
  }
  events.push({ type: 'moveStarted', moveId: move.id, slotIndex });
  const action: ActionState = {
    slotIndex,
    moveId: move.id,
    phase: move.charge ? 'charging' : 'windup',
    phaseMs: 0,
    chargeMs: 0,
    chargeLevel: 0,
    aimDir: aimDirection(state, input),
    hitIds: [],
  };
  const paid =
    move.staminaCost > 0
      ? { stamina: player.stamina - move.staminaCost, staminaRegenDelayMs: TUNING.stamina.regenDelayMs }
      : {};
  return { ...state, player: { ...player, ...paid, action } };
}

type StrikeHit = { power: number; type: MoveDef['type']; multiplier: number; hitstunMs: number; knockback: number; from: Vec2 };

/** A hit stopped by a guard: chip damage at most, no stagger, and the next-hit buff is kept. */
function blockedStrike(state: WorldState, enemy: EnemyState, hit: StrikeHit, events: GameEvent[]): WorldState {
  const { damage } = computeDamage({
    power: hit.power,
    moveType: hit.type,
    attackerTypes: state.player.types,
    defenderTypes: enemy.types,
    multiplier: hit.multiplier,
  });
  const chip = Math.round(damage * AEGISLASH.shield.chipFactor);
  events.push({ type: 'hitBlocked', enemyId: enemy.id, pos: enemy.pos });
  if (chip <= 0) return state;
  const hp = Math.max(1, enemy.hp - chip);
  return { ...state, enemies: state.enemies.map((e) => (e.id === enemy.id ? { ...e, hp } : e)) };
}

/** Damages one enemy, applies stagger and knockback away from `from`, and consumes the next-hit buff. */
function strikeEnemy(
  state: WorldState,
  enemy: EnemyState,
  hit: StrikeHit,
  events: GameEvent[],
): WorldState {
  const buff = state.player.nextHitBuff;
  if (enemy.boss && blocksHit(enemy, hit.from)) return blockedStrike(state, enemy, hit, events);
  const { damage, effectiveness } = computeDamage({
    power: hit.power,
    moveType: hit.type,
    attackerTypes: state.player.types,
    defenderTypes: enemy.types,
    multiplier: hit.multiplier * (buff?.multiplier ?? 1),
  });
  const hp = Math.max(0, enemy.hp - damage);
  const poise = poiseOf(enemy.species);
  const pushDir = normalize(sub(enemy.pos, hit.from));
  const struck: EnemyState = {
    ...(enemy.boss ? onBossDamaged(enemy, damage) : enemy),
    hp,
    alive: hp > 0,
    hitstunMs: Math.max(enemy.hitstunMs, hit.hitstunMs * poise.hitstunScale),
    knockback: scale(length(pushDir) > 0 ? pushDir : state.player.facing, hit.knockback * poise.knockbackScale),
  };
  events.push({ type: 'enemyHit', enemyId: enemy.id, damage, effectiveness, pos: enemy.pos });
  if (!struck.alive) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
  return {
    ...state,
    player: { ...state.player, nextHitBuff: null },
    enemies: state.enemies.map((e) => (e.id === enemy.id ? struck : e)),
  };
}

/** Melee hit test for the active frames of arc and dash moves. */
function resolveMelee(state: WorldState, move: MoveDef, action: ActionState, events: GameEvent[]): WorldState {
  const charge = chargeOf(move, action.chargeLevel);
  const origin = state.player.pos;
  let current = state;
  let hitIds = action.hitIds;
  for (const enemy of state.enemies) {
    if (!enemy.alive || hitIds.includes(enemy.id)) continue;
    const offset = sub(enemy.pos, origin);
    const dist = length(offset);
    let touches = false;
    if (move.hitbox.kind === 'arc') {
      const reach = move.hitbox.range * charge.sizeMultiplier + enemy.radius;
      const halfArc = (move.hitbox.arcDegrees * Math.PI) / 360;
      const cosToEnemy = dist === 0 ? 1 : dot(offset, action.aimDir) / dist;
      touches = dist <= reach && (dist <= enemy.radius || cosToEnemy >= Math.cos(halfArc));
    } else if (move.hitbox.kind === 'dash') {
      touches = dist <= move.hitbox.radius * charge.sizeMultiplier + enemy.radius;
    }
    if (!touches) continue;
    hitIds = [...hitIds, enemy.id];
    current = strikeEnemy(
      current,
      enemy,
      { power: move.power, type: move.type, multiplier: charge.damageMultiplier, hitstunMs: move.hitstunMs, knockback: move.knockback, from: origin },
      events,
    );
  }
  return hitIds === action.hitIds ? current : withAction(current, { ...action, hitIds });
}

function spawnPlayerProjectile(state: WorldState, move: MoveDef, action: ActionState): WorldState {
  if (move.hitbox.kind !== 'projectile') return state;
  const charge = chargeOf(move, action.chargeLevel);
  const radius = move.hitbox.radius * charge.sizeMultiplier;
  const projectile: ProjectileState = {
    id: `p${state.nextId}`,
    owner: 'player',
    type: move.type,
    attackerTypes: state.player.types,
    power: move.power,
    damageMultiplier: charge.damageMultiplier,
    pos: add(state.player.pos, scale(action.aimDir, PLAYER.radius + radius)),
    vel: scale(action.aimDir, move.hitbox.speed * charge.speedMultiplier),
    radius,
    remainingMs: move.hitbox.lifetimeMs,
    hitstunMs: move.hitstunMs,
    knockback: move.knockback,
    hitIds: [],
  };
  return { ...state, nextId: state.nextId + 1, projectiles: [...state.projectiles, projectile] };
}

const withAction = (state: WorldState, action: ActionState | null): WorldState => ({
  ...state,
  player: { ...state.player, action },
});

const confineToArena = (state: WorldState, pos: Vec2, radius: number, solid = true): Vec2 =>
  confineCircle(state.arena, pos, radius, solid);

/** Runs the active-phase work of a move for `ms` of time inside the active window. */
function runActive(state: WorldState, move: MoveDef, action: ActionState, ms: number, events: GameEvent[]): WorldState {
  let current = state;
  if (move.hitbox.kind === 'dash' && ms > 0) {
    const stepDistance = (move.hitbox.distance * ms) / move.activeMs;
    const pos = confineToArena(current, add(current.player.pos, scale(action.aimDir, stepDistance)), PLAYER.radius);
    current = { ...current, player: { ...current.player, pos } };
  }
  return move.hitbox.kind === 'projectile' ? current : resolveMelee(current, move, action, events);
}

/** Advances the current move: charge while held, then wind-up, active and recovery. */
function advanceAction(state: WorldState, input: PlayerInput, dtMs: number, events: GameEvent[]): WorldState {
  let action = state.player.action;
  if (!action) return state;
  const move = MOVES[action.moveId];
  let current = state;

  if (action.phase === 'charging') {
    const maxHold = move.charge?.at(-1)?.holdMs ?? 0;
    const chargeMs = Math.min(maxHold, action.chargeMs + dtMs);
    const aimDir = aimDirection(state, input);
    if (input.slots[action.slotIndex]) {
      return withAction(current, { ...action, chargeMs, chargeLevel: chargeLevelFor(move, chargeMs), aimDir });
    }
    action = { ...action, phase: 'windup', phaseMs: 0, chargeMs, chargeLevel: chargeLevelFor(move, chargeMs), aimDir };
    events.push({ type: 'moveReleased', moveId: move.id, chargeLevel: action.chargeLevel });
    return withAction(current, action);
  }

  let remaining = dtMs;
  while (action && remaining > 0) {
    const duration = phaseDuration(move, action.phase);
    const take = Math.min(remaining, duration - action.phaseMs);
    if (action.phase === 'active') {
      current = runActive(withAction(current, action), move, action, take, events);
      action = current.player.action!;
    }
    action = { ...action, phaseMs: action.phaseMs + take };
    remaining -= take;
    if (action.phaseMs >= duration) {
      const next: ActionPhase | null = NEXT_PHASE[action.phase];
      if (next === null) {
        action = null;
        break;
      }
      action = { ...action, phase: next, phaseMs: 0 };
      if (next === 'active') current = spawnPlayerProjectile(current, move, action);
    }
  }
  return withAction(current, action);
}

function updatePlayerAction(state: WorldState, input: PlayerInput, dtMs: number, events: GameEvent[]): WorldState {
  const wasIdle = !state.player.action;
  let current = tryStartAction(state, input, events);
  // A move started this tick begins counting from the next tick.
  if (!(wasIdle && current.player.action)) current = advanceAction(current, input, dtMs, events);
  const slotsHeld = current.player.loadout.map((_, i) => Boolean(input.slots[i]));
  return { ...current, player: { ...current.player, slotsHeld } };
}

const insideArena = (state: WorldState, pos: Vec2) =>
  pos.x >= 0 && pos.y >= 0 && pos.x <= state.arena.width && pos.y <= state.arena.height;

/** Moves projectiles (enemy ones at the slow-mo time scale), resolves hits and expiry. */
function updateProjectiles(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  let current = state;
  const survivors: ProjectileState[] = [];
  for (const projectile of state.projectiles) {
    const ms = dtMs * (projectile.owner === 'enemy' ? enemyTimeScale(state) : 1);
    let moved: ProjectileState | null = {
      ...projectile,
      pos: add(projectile.pos, scale(projectile.vel, ms / 1000)),
      remainingMs: projectile.remainingMs - ms,
    };
    if (moved.remainingMs <= 0 || !insideArena(current, moved.pos)) continue;

    if (moved.owner === 'player') {
      const target = current.enemies.find(
        (e) => e.alive && !moved!.hitIds.includes(e.id) && distance(e.pos, moved!.pos) <= e.radius + moved!.radius,
      );
      if (target) {
        current = strikeEnemy(
          current,
          target,
          { power: moved.power, type: moved.type, multiplier: moved.damageMultiplier, hitstunMs: moved.hitstunMs, knockback: moved.knockback, from: moved.pos },
          events,
        );
        moved = null;
      }
    } else if (!moved.hitIds.includes(PLAYER_ID) && distance(current.player.pos, moved.pos) <= PLAYER.radius + moved.radius) {
      const { damage } = computeDamage({
        power: moved.power,
        moveType: moved.type,
        attackerTypes: moved.attackerTypes,
        defenderTypes: current.player.types,
        multiplier: moved.damageMultiplier,
      });
      const landed = landHitOnPlayer(current, { damage }, events);
      current = landed.state;
      // Rolled through: the projectile keeps flying; otherwise it is spent.
      const dodged = landed.outcome === 'dodged' || landed.outcome === 'perfectDodge';
      moved = dodged ? { ...moved, hitIds: [...moved.hitIds, PLAYER_ID] } : null;
    }
    if (moved) survivors.push(moved);
  }
  return { ...current, projectiles: survivors };
}

/** Ticks enemy stagger and eases out knockback, at the enemy time scale. */
function updateEnemyReactions(state: WorldState, dtMs: number): WorldState {
  const ms = dtMs * enemyTimeScale(state);
  const fraction = 1 - (1 - COMBAT.knockbackPerTick) ** (ms / FIXED_DT_MS);
  const enemies = state.enemies.map((enemy) => {
    if (enemy.hitstunMs <= 0 && length(enemy.knockback) === 0) return enemy;
    const push = scale(enemy.knockback, fraction);
    const rest = sub(enemy.knockback, push);
    return {
      ...enemy,
      hitstunMs: Math.max(0, enemy.hitstunMs - ms),
      pos: confineToArena(state, add(enemy.pos, push), enemy.radius, !floatsOf(enemy.species)),
      knockback: length(rest) < 0.05 ? vec(0, 0) : rest,
    };
  });
  return { ...state, enemies };
}

/** Player move state machine, hit detection, projectiles and enemy hit reactions for one step. */
export function updateCombat(state: WorldState, input: PlayerInput, dtMs: number, events: GameEvent[]): WorldState {
  let current = updatePlayerAction(state, input, dtMs, events);
  current = updateProjectiles(current, dtMs, events);
  return updateEnemyReactions(current, dtMs);
}
