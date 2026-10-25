import { UNKILLABLE } from '../data/sima';
import { AEGISLASH, floatsOf, poiseOf } from '../data/enemies';
import { ITEM_EFFECTS } from '../data/items';
import { MOVES, type MoveBonus, type MoveDef } from '../data/moves';
import { TUNING } from '../data/tuning';
import { blocksHit, onBossDamaged, rotateToward } from './boss';
import { computeDamage, typeEffectiveness } from './damage';
import { confineCircle, insideRect } from './geometry';
import { partyStaggerOf, presentPlayers } from './party';
import { noteAggroDamage } from './aggro';
import { wallAt } from './tiles';
import { landHitOnPlayer } from './hits';
import { answerGuardedHit, guardChip } from './roster';
import { onHitDealt, playerStats, rollCrit, type PlayerStats } from './items';
import { bonusMultiplier, breakIllusion, illusionActive, stokeFlashFire } from './passives';
import { buffCrit, buffDamage, castBuff, cooldownLeft, spendBuffHit, startCooldown, tickBoosts } from './boosts';
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

/** Damage multiplier of the player's items, level and passive boost for a move (heavy-slot bonus included). */
const moveMultiplier = (stats: PlayerStats, move: MoveDef, action: ActionState): number =>
  stats.damage * (move.slot === 'heavy' ? stats.heavyDamage : 1) * (action.boost ?? 1);

const NEXT_PHASE: Record<ActionPhase, ActionPhase | null> = {
  charging: 'windup',
  windup: 'active',
  active: 'recovery',
  recovery: null,
};

/** Pressing a slot button starts its move if the player is free, the move is off cooldown and the player can pay the stamina. */
function tryStartAction(state: WorldState, input: PlayerInput, events: GameEvent[]): WorldState {
  const { player } = state;
  if (player.action || player.roll) return state;
  const slotIndex = player.loadout.findIndex((moveId, i) => moveId !== null && input.slots[i] && !player.slotsHeld[i]);
  if (slotIndex < 0) return state;
  const move = MOVES[player.loadout[slotIndex]!];
  const cost = move.staminaCost * playerStats(player).staminaCost;
  if (player.stamina < cost || cooldownLeft(player, move.id) > 0) {
    events.push({ type: 'moveDenied', moveId: move.id });
    return state;
  }
  events.push({ type: 'moveStarted', moveId: move.id, slotIndex });
  const mouseAim = Boolean(input.slotMouse[slotIndex]);
  // Flash Fire: the powered-up heavy move takes the boost with it.
  const boosted = move.slot === 'heavy' && player.flashFire;
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
    ...(boosted ? { boost: TUNING.passives.flashFireBoost } : {}),
  };
  const paid = cost > 0 ? { stamina: player.stamina - cost, staminaRegenDelayMs: TUNING.stamina.regenDelayMs } : {};
  return { ...state, player: startCooldown({ ...player, ...paid, action, ...(boosted ? { flashFire: false } : {}) }, move) };
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
  bonus?: MoveBonus;
  /** The move that landed it, and whether this is the last part of a multi-hit move (game feel only). */
  moveId?: MoveDef['id'];
  finisher?: boolean;
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
function blockedStrike(state: WorldState, enemy: EnemyState, hit: StrikeHit, events: GameEvent[], chipFactor: number): WorldState {
  const { damage } = computeDamage({
    power: hit.power,
    moveType: hit.type,
    attackerTypes: state.player.types,
    defenderTypes: enemy.types,
    multiplier: hit.multiplier,
  });
  const chip = Math.round(damage * chipFactor);
  events.push({ type: 'hitBlocked', enemyId: enemy.id, pos: enemy.pos });
  claim(state, enemy, hit, { damage: Math.max(0, chip), effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: true }, events);
  const hp = chip > 0 ? Math.max(1, enemy.hp - chip) : enemy.hp;
  // Hosts let a guard answer (Croagunk's counter); a guest leaves that to the host's claim handling.
  const guarded = state.role === 'guest' ? { ...enemy, hp } : answerGuardedHit({ ...enemy, hp }, hit.from, events);
  return { ...state, enemies: state.enemies.map((e) => (e.id === enemy.id ? guarded : e)) };
}

/**
 * Damages one enemy, applies stagger and knockback away from `from`, and
 * consumes the next-hit buff. Held items act here: Expert Belt on super
 * effective hits, Scope Lens crits (seeded RNG) and the Shell Bell heal; so
 * do move bonuses (Foul Play, Hex, Stomping Tantrum) and Illusion, whose
 * first hit is critical and breaks it.
 */
function strikeEnemy(
  state: WorldState,
  enemy: EnemyState,
  hit: StrikeHit,
  events: GameEvent[],
): WorldState {
  const buff = state.player.nextHitBuff;
  // The Sima's hunter cannot be felled: every hit is shrugged off.
  if (UNKILLABLE.includes(enemy.species)) return blockedStrike(state, enemy, hit, events, 0);
  // An armored Sima elite shrugs off the first hit, and the armor is gone.
  if (enemy.armor) {
    const blocked = blockedStrike(state, enemy, hit, events, 0);
    return { ...blocked, enemies: blocked.enemies.map((e) => (e.id === enemy.id ? { ...e, armor: undefined } : e)) };
  }
  if (enemy.boss && blocksHit(enemy, hit.from)) return blockedStrike(state, enemy, hit, events, AEGISLASH.shield.chipFactor);
  const guard = guardChip(enemy, hit.from);
  if (guard !== null) return blockedStrike(state, enemy, hit, events, guard);
  const stats = playerStats(state.player);
  // A haste buff (Nasty Plot) sharpens crits for a while.
  const rolled = rollCrit(state, stats.critChance + buffCrit(state.player));
  state = rolled.state;
  const superEffective = typeEffectiveness(hit.type, enemy.types) > 1 ? stats.superEffective : 1;
  const fromIllusion = illusionActive(state.player);
  const crit = rolled.crit || fromIllusion ? ITEM_EFFECTS.critMultiplier : 1;
  const bonus = bonusMultiplier(hit.bonus, enemy, state.player);
  const { damage, effectiveness } = computeDamage({
    power: hit.power,
    moveType: hit.type,
    attackerTypes: state.player.types,
    defenderTypes: enemy.types,
    // A Sima pact's blessing may sharpen the player's hits.
    // A power buff (Swords Dance) adds to the next hits.
    multiplier: hit.multiplier * (buff?.multiplier ?? 1) * superEffective * crit * bonus * buffDamage(state.player) * (state.simaPact?.playerDamage ?? 1),
  });
  const hp = Math.max(0, enemy.hp - damage);
  // A boss takes less stagger in a bigger party (core/party.ts): four players cannot stunlock it.
  const party = partyStaggerOf(state, enemy);
  const base = poiseOf(enemy.species);
  const poise = party === 1 ? base : { hitstunScale: base.hitstunScale * party, knockbackScale: base.knockbackScale * party };
  const pushDir = normalize(sub(enemy.pos, hit.from));
  const struck: EnemyState = {
    // A party boss notes who hurt it (core/aggro.ts; no aggro solo).
    ...noteAggroDamage(enemy.boss ? onBossDamaged(enemy, damage) : enemy, state.localId, damage),
    hp,
    alive: hp > 0,
    hitstunMs: Math.max(enemy.hitstunMs, hit.hitstunMs * poise.hitstunScale),
    knockback: scale(length(pushDir) > 0 ? pushDir : state.player.facing, hit.knockback * poise.knockbackScale),
  };
  events.push({
    type: 'enemyHit',
    enemyId: enemy.id,
    damage,
    effectiveness,
    pos: enemy.pos,
    ...(hit.moveId ? { moveId: hit.moveId } : {}),
    ...(hit.finisher ? { finisher: true } : {}),
  });
  if (!struck.alive) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
  claim(state, enemy, hit, { damage, effectiveness, hitstunMs: hit.hitstunMs * poise.hitstunScale, knockback: struck.knockback, blocked: false }, events);
  return {
    ...state,
    player: { ...spendBuffHit(onHitDealt(stokeFlashFire(breakIllusion(state.player, events), hit.type, events), damage)), nextHitBuff: null },
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
        multiplier: charge.damageMultiplier * moveMultiplier(stats, move, action),
        hitstunMs: move.hitstunMs,
        knockback: move.knockback,
        from: origin,
        source: `m${action.startTick ?? state.tick}${action.hitWindow ? `w${action.hitWindow}` : ''}`,
        ...(move.bonus ? { bonus: move.bonus } : {}),
        moveId: move.id,
        ...(move.multiHit && move.multiHit > 1 && (action.hitWindow ?? 0) === move.multiHit - 1 ? { finisher: true } : {}),
      },
      events,
    );
  }
  return hitIds === action.hitIds ? current : withAction(current, { ...action, hitIds, landed: true });
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
    damageMultiplier: charge.damageMultiplier * moveMultiplier(stats, move, action),
    pos: add(state.player.pos, scale(action.aimDir, PLAYER.radius + radius)),
    vel: scale(action.aimDir, move.hitbox.speed * charge.speedMultiplier),
    radius,
    remainingMs: move.hitbox.lifetimeMs,
    hitstunMs: move.hitstunMs,
    knockback: move.knockback,
    hitIds: [],
    ...(move.bonus ? { bonus: move.bonus } : {}),
    ...(move.hitbox.boomerang ? { returnAtMs: move.hitbox.lifetimeMs / 2, pierce: true } : {}),
    moveId: move.id,
  };
  return { ...state, nextId: state.nextId + 1, projectiles: [...state.projectiles, projectile] };
}

const withAction = (state: WorldState, action: ActionState | null): WorldState => ({
  ...state,
  player: { ...state.player, action },
});

const confineToArena = (state: WorldState, pos: Vec2, radius: number, solid = true): Vec2 =>
  confineCircle(state.arena, pos, radius, solid);

/** Multi-hit moves: which part of the active window `action` is in; a new part may hit everyone again. */
function withHitWindow(move: MoveDef, action: ActionState, actionTime: number): ActionState {
  if (!move.multiHit || move.multiHit < 2) return action;
  const part = (move.activeMs * actionTime) / move.multiHit;
  const window = Math.min(move.multiHit - 1, Math.floor(action.phaseMs / part));
  return window === (action.hitWindow ?? 0) ? action : { ...action, hitWindow: window, hitIds: [] };
}

/** Runs the active-phase work of a move for `ms` of time inside the active window. */
function runActive(state: WorldState, move: MoveDef, active: ActionState, ms: number, events: GameEvent[]): WorldState {
  const action = withHitWindow(move, active, playerStats(state.player).actionTime);
  let current = action === active ? state : withAction(state, action);
  if (move.hitbox.kind === 'dash' && ms > 0) {
    const stepDistance = (move.hitbox.distance * ms) / (move.activeMs * playerStats(current.player).actionTime);
    const pos = confineToArena(current, add(current.player.pos, scale(action.aimDir, stepDistance)), PLAYER.radius);
    current = { ...current, player: { ...current.player, pos } };
  }
  return move.hitbox.kind === 'projectile' || move.hitbox.kind === 'self' ? current : resolveMelee(current, move, action, events);
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
        // A finished melee move that struck nothing feeds Stomping Tantrum.
        if (move.hitbox.kind !== 'projectile' && move.hitbox.kind !== 'self') current = { ...current, player: { ...current.player, lastMoveMissed: !action.landed } };
        action = null;
        break;
      }
      action = { ...action, phase: next, phaseMs: 0 };
      if (next === 'active') current = spawnPlayerProjectile(current, move, action);
      // A boost move takes hold as its active phase starts.
      if (next === 'active' && move.buff) current = { ...current, player: castBuff(current.player, move, events) };
    }
  }
  return withAction(current, action);
}

function updatePlayerAction(state: WorldState, input: PlayerInput, dtMs: number, events: GameEvent[]): WorldState {
  const wasIdle = !state.player.action;
  // Cooldowns and boost buffs run on the player's clock (no slow-mo).
  const ticked = tickBoosts(state.player, dtMs);
  let current = tryStartAction(ticked === state.player ? state : { ...state, player: ticked }, input, events);
  // A move started this tick begins counting from the next tick.
  if (!(wasIdle && current.player.action)) current = advanceAction(current, input, dtMs, events);
  const slotsHeld = current.player.loadout.map((_, i) => Boolean(input.slots[i]));
  return { ...current, player: { ...current.player, slotsHeld } };
}

/** Inside the map and, on tiled floors, not in a wall: projectiles die on walls (and on `cover` blocks, the arena pillars). */
const insideArena = (state: WorldState, pos: Vec2) =>
  pos.x >= 0 &&
  pos.y >= 0 &&
  pos.x <= state.arena.width &&
  pos.y <= state.arena.height &&
  !(state.arena.tiles && wallAt(state.arena.tiles, pos)) &&
  !(state.arena.obstacles ?? []).some((o) => o.cover === true && insideRect(pos, o));

/** An enemy shot that bends (Duskull's wisp) turns its velocity towards the nearest present player, at most `degPerSec`. */
function steerShot(state: WorldState, p: ProjectileState, ms: number): ProjectileState {
  if (!p.steer || p.owner !== 'enemy') return p;
  const left = p.steer.ms - ms;
  const target = presentPlayers(state).reduce<Vec2 | null>((best, c) => (best === null || distance(c.pos, p.pos) < distance(best, p.pos) ? c.pos : best), null);
  const { steer: _done, ...straight } = p;
  if (!target) return left > 0 ? { ...p, steer: { ...p.steer, ms: left } } : straight;
  const speed = length(p.vel);
  const dir = rotateToward(normalize(p.vel), sub(target, p.pos), (p.steer.degPerSec * Math.PI * ms) / 180000);
  const vel = scale(dir, speed);
  return left > 0 ? { ...p, vel, steer: { ...p.steer, ms: left } } : { ...straight, vel };
}

/** Moves projectiles (enemy ones at the slow-mo time scale), resolves hits and expiry. */
function updateProjectiles(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  let current = state;
  const survivors: ProjectileState[] = [];
  for (const projectile of state.projectiles) {
    const ms = dtMs * (projectile.owner === 'enemy' ? enemyTimeScale(state) : 1);
    const steered = steerShot(current, projectile, ms);
    let moved: ProjectileState | null = {
      ...steered,
      pos: add(projectile.pos, scale(steered.vel, ms / 1000)),
      remainingMs: projectile.remainingMs - ms,
    };
    if (moved.remainingMs <= 0 || !insideArena(current, moved.pos)) continue;
    if (moved.returnAtMs !== undefined && moved.remainingMs <= moved.returnAtMs) {
      // A boomerang turns back and may hit everything again on the way home.
      const { returnAtMs: _turned, ...rest } = moved;
      moved = { ...rest, vel: scale(moved.vel, -1), hitIds: [] };
    }
    const returning = Boolean(moved.pierce) && moved.returnAtMs === undefined;
    if (returning && moved.owner === 'player') {
      // On the way home a boomerang steers to where the player is now, and is caught on reaching them.
      const home = sub(current.player.pos, moved.pos);
      if (length(home) <= PLAYER.radius + moved.radius) continue;
      moved = { ...moved, vel: scale(normalize(home), length(moved.vel)) };
    }

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
            source: returning ? `${moved.id}r` : moved.id,
            ...(moved.bonus ? { bonus: moved.bonus } : {}),
            ...(moved.moveId ? { moveId: moved.moveId } : {}),
          },
          events,
        );
        moved = moved.pierce ? { ...moved, hitIds: [...moved.hitIds, target.id] } : null;
      }
    } else if (!moved.hitIds.includes(PLAYER_ID) && distance(current.player.pos, moved.pos) <= PLAYER.radius + moved.radius) {
      const { damage } = computeDamage({
        power: moved.power,
        moveType: moved.type,
        attackerTypes: moved.attackerTypes,
        defenderTypes: current.player.types,
        multiplier: moved.damageMultiplier,
      });
      const from = sub(moved.pos, scale(normalize(moved.vel), moved.radius + PLAYER.radius));
      const landed = landHitOnPlayer(current, { damage, type: moved.type, from, ...(moved.pierceRoll ? { pierceRoll: true } : {}) }, events);
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
