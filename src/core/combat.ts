import { AEGISLASH, floatsOf, poiseOf } from '../data/enemies';
import { ITEM_EFFECTS } from '../data/items';
import { MOVES, type MoveDef } from '../data/moves';
import { TUNING } from '../data/tuning';
import { blocksHit, onBossDamaged } from './boss';
import { computeDamage, typeEffectiveness } from './damage';
import { confineCircle } from './geometry';
import { wallAt } from './tiles';
import { landHitOnPlayer } from './hits';
import { onHitDealt, playerStats, rollCrit, type PlayerStats } from './items';
import type { ActionPhase, ActionState, EnemyState, GameEvent, HitClaim, PlayerInput, ProjectileState, WorldState } from './state';
import { enemyTimeScale } from './time';
import { FIXED_DT_MS } from './timestep';
import { add, distance, dot, length, normalize, scale, sub, vec, type Vec2 } from './vec';

const { combat: COMBAT, player: PLAYER } = TUNING;
export const PLAYER_ID = 'player';

/**
 * Direction the player's moves go: at the locked target if any; else towards
 * the cursor for a mouse-triggered move, along the facing (last WASD
 * direction) for a key-triggered one. The facing also covers a point on top
 * of the player.
 */
export function aimDirection(state: WorldState, input: PlayerInput, mouseAim: boolean): Vec2 {
  const target = state.lock.targetId ? state.enemies.find((e) => e.id === state.lock.targetId) : undefined;
  const point = target?.pos ?? (mouseAim ? input.aim : null);
  if (!point) return state.player.facing;
  const dir = normalize(sub(point, state.player.pos));
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

/** Length of a move phase, scaled by the player's action time (Quick Claw). */
function phaseDuration(move: MoveDef, phase: ActionPhase, actionTime: number): number {
  if (phase === 'windup') return move.windupMs * actionTime;
  if (phase === 'active') return move.activeMs * actionTime;
  if (phase === 'recovery') return move.recoveryMs * actionTime;
  return Number.POSITIVE_INFINITY;
}

/** Damage multiplier of the player's items and level for a move (heavy-slot bonus included). */
const moveMultiplier = (stats: PlayerStats, move: MoveDef): number => stats.damage * (move.slot === 'heavy' ? stats.heavyDamage : 1);

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
  const cost = move.staminaCost * playerStats(player).staminaCost;
  if (player.stamina < cost) {
    events.push({ type: 'moveDenied', moveId: move.id });
    return state;
  }
  events.push({ type: 'moveStarted', moveId: move.id, slotIndex });
  const mouseAim = Boolean(input.slotMouse[slotIndex]);
  const action: ActionState = {
    slotIndex,
    moveId: move.id,
    phase: move.charge ? 'charging' : 'windup',
    phaseMs: 0,
    chargeMs: 0,
    chargeLevel: 0,
    aimDir: aimDirection(state, input, mouseAim),
    mouseAim,
    hitIds: [],
    startTick: state.tick,
  };
  const paid = cost > 0 ? { stamina: player.stamina - cost, staminaRegenDelayMs: TUNING.stamina.regenDelayMs } : {};
  return { ...state, player: { ...player, ...paid, action } };
}

type StrikeHit = {
  power: number;
  type: MoveDef['type'];
  multiplier: number;
  hitstunMs: number;
  knockback: number;
  from: Vec2;
  /** Names the swing or projectile in hit claims. */
  source: string;
};

/**
 * On a guest, the local player's hit is shown at once (feedback) and sent to
 * the host as a claim; host snapshots then carry the result. Hosts (and solo)
 * are authoritative and claim nothing.
 */
function claim(state: WorldState, enemy: EnemyState, hit: StrikeHit, struck: Omit<HitClaim, 'id' | 'playerId' | 'enemyId'>, events: GameEvent[]): void {
  if (state.role !== 'guest') return;
  events.push({
    type: 'hitClaim',
    claim: { id: `${state.localId}:${hit.source}:${enemy.id}`, playerId: state.localId, enemyId: enemy.id, ...struck },
  });
}

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
  claim(state, enemy, hit, { damage: Math.max(0, chip), effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: true }, events);
  if (chip <= 0) return state;
  const hp = Math.max(1, enemy.hp - chip);
  return { ...state, enemies: state.enemies.map((e) => (e.id === enemy.id ? { ...e, hp } : e)) };
}

/**
 * Damages one enemy, applies stagger and knockback away from `from`, and
 * consumes the next-hit buff. Held items act here: Expert Belt on super
 * effective hits, Scope Lens crits (seeded RNG) and the Shell Bell heal.
 */
function strikeEnemy(
  state: WorldState,
  enemy: EnemyState,
  hit: StrikeHit,
  events: GameEvent[],
): WorldState {
  const buff = state.player.nextHitBuff;
  if (enemy.boss && blocksHit(enemy, hit.from)) return blockedStrike(state, enemy, hit, events);
  const stats = playerStats(state.player);
  const rolled = rollCrit(state, stats.critChance);
  state = rolled.state;
  const superEffective = typeEffectiveness(hit.type, enemy.types) > 1 ? stats.superEffective : 1;
  const crit = rolled.crit ? ITEM_EFFECTS.critMultiplier : 1;
  const { damage, effectiveness } = computeDamage({
    power: hit.power,
    moveType: hit.type,
    attackerTypes: state.player.types,
    defenderTypes: enemy.types,
    multiplier: hit.multiplier * (buff?.multiplier ?? 1) * superEffective * crit,
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
  claim(state, enemy, hit, { damage, effectiveness, hitstunMs: hit.hitstunMs * poise.hitstunScale, knockback: struck.knockback, blocked: false }, events);
  return {
    ...state,
    player: { ...onHitDealt(state.player, damage), nextHitBuff: null },
    enemies: state.enemies.map((e) => (e.id === enemy.id ? struck : e)),
  };
}

/** Melee hit test for the active frames of arc and dash moves. */
function resolveMelee(state: WorldState, move: MoveDef, action: ActionState, events: GameEvent[]): WorldState {
  const charge = chargeOf(move, action.chargeLevel);
  const stats = playerStats(state.player);
  const origin = state.player.pos;
  let current = state;
  let hitIds = action.hitIds;
  for (const enemy of state.enemies) {
    if (!enemy.alive || hitIds.includes(enemy.id)) continue;
    const offset = sub(enemy.pos, origin);
    const dist = length(offset);
    let touches = false;
    if (move.hitbox.kind === 'arc') {
      const reach = move.hitbox.range * charge.sizeMultiplier * stats.reach + enemy.radius;
      const halfArc = (move.hitbox.arcDegrees * Math.PI) / 360;
      const cosToEnemy = dist === 0 ? 1 : dot(offset, action.aimDir) / dist;
      touches = dist <= reach && (dist <= enemy.radius || cosToEnemy >= Math.cos(halfArc));
    } else if (move.hitbox.kind === 'dash') {
      touches = dist <= move.hitbox.radius * charge.sizeMultiplier * stats.reach + enemy.radius;
    }
    if (!touches) continue;
    hitIds = [...hitIds, enemy.id];
    current = strikeEnemy(
      current,
      enemy,
      {
        power: move.power,
        type: move.type,
        multiplier: charge.damageMultiplier * moveMultiplier(stats, move),
        hitstunMs: move.hitstunMs,
        knockback: move.knockback,
        from: origin,
        source: `m${action.startTick ?? state.tick}`,
      },
      events,
    );
  }
  return hitIds === action.hitIds ? current : withAction(current, { ...action, hitIds });
}

function spawnPlayerProjectile(state: WorldState, move: MoveDef, action: ActionState): WorldState {
  if (move.hitbox.kind !== 'projectile') return state;
  const charge = chargeOf(move, action.chargeLevel);
  const stats = playerStats(state.player);
  const radius = move.hitbox.radius * charge.sizeMultiplier * stats.reach;
  const projectile: ProjectileState = {
    id: `p${state.nextId}`,
    owner: 'player',
    type: move.type,
    attackerTypes: state.player.types,
    power: move.power,
    damageMultiplier: charge.damageMultiplier * moveMultiplier(stats, move),
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
    const stepDistance = (move.hitbox.distance * ms) / (move.activeMs * playerStats(current.player).actionTime);
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
    const aimDir = aimDirection(state, input, action.mouseAim);
    if (input.slots[action.slotIndex]) {
      return withAction(current, { ...action, chargeMs, chargeLevel: chargeLevelFor(move, chargeMs), aimDir });
    }
    action = { ...action, phase: 'windup', phaseMs: 0, chargeMs, chargeLevel: chargeLevelFor(move, chargeMs), aimDir };
    events.push({ type: 'moveReleased', moveId: move.id, chargeLevel: action.chargeLevel });
    return withAction(current, action);
  }

  let remaining = dtMs;
  const actionTime = playerStats(state.player).actionTime;
  while (action && remaining > 0) {
    const duration = phaseDuration(move, action.phase, actionTime);
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

/** Inside the map and, on tiled floors, not in a wall: projectiles die on walls. */
const insideArena = (state: WorldState, pos: Vec2) =>
  pos.x >= 0 &&
  pos.y >= 0 &&
  pos.x <= state.arena.width &&
  pos.y <= state.arena.height &&
  !(state.arena.tiles && wallAt(state.arena.tiles, pos));

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
          {
            power: moved.power,
            type: moved.type,
            multiplier: moved.damageMultiplier,
            hitstunMs: moved.hitstunMs,
            knockback: moved.knockback,
            from: moved.pos,
            source: moved.id,
          },
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

/**
 * Player move state machine, hit detection, projectiles and enemy hit reactions for one step.
 * A guest leaves enemy reactions (stagger, knockback) to the host's snapshots.
 */
export function updateCombat(state: WorldState, input: PlayerInput, dtMs: number, events: GameEvent[]): WorldState {
  let current = updatePlayerAction(state, input, dtMs, events);
  current = updateProjectiles(current, dtMs, events);
  return current.role === 'guest' ? current : updateEnemyReactions(current, dtMs);
}
