import { SPECIES } from '../data/species';
import { TUNING } from '../data/tuning';
import type { Arena, GameEvent, IncomingHit, PlayerInput, PlayerState } from './state';
import { confineCircle } from './geometry';
import { playerStats } from './items';
import { add, length, normalize, scale, type Vec2 } from './vec';

const { roll: ROLL, stamina: STAMINA, player: PLAYER, combat: COMBAT } = TUNING;
const ROLL_SPEED = ROLL.distance / ROLL.durationMs; // px per ms

export function isInvulnerable(player: PlayerState): boolean {
  const elapsed = player.roll?.elapsedMs;
  return elapsed !== undefined && elapsed >= ROLL.iframesStartMs && elapsed < (player.rollTier?.iframesEndMs ?? ROLL.iframesEndMs);
}

/** Spends stamina and restarts the regen delay. Callers check affordability first. */
export function spendStamina(player: PlayerState, cost: number): PlayerState {
  return { ...player, stamina: player.stamina - cost, staminaRegenDelayMs: STAMINA.regenDelayMs };
}

function regenStamina(player: PlayerState, dtMs: number): PlayerState {
  if (player.staminaRegenDelayMs > 0) {
    return { ...player, staminaRegenDelayMs: Math.max(0, player.staminaRegenDelayMs - dtMs) };
  }
  const stamina = Math.min(STAMINA.max, player.stamina + (STAMINA.regenPerSecond * playerStats(player).staminaRegen * dtMs) / 1000);
  return stamina === player.stamina ? player : { ...player, stamina };
}

const confine = (pos: Vec2, arena: Arena): Vec2 => confineCircle(arena, pos, PLAYER.radius);

function tryStartRoll(player: PlayerState, moveDir: Vec2, events: GameEvent[]): PlayerState {
  if (player.roll || player.action) return player;
  const cost = ROLL.staminaCost * playerStats(player).staminaCost * (player.rollTier?.staminaCost ?? 1);
  if (player.stamina < cost) {
    events.push({ type: 'rollDenied' });
    return player;
  }
  events.push({ type: 'rollStarted' });
  const dir = length(moveDir) > 0 ? moveDir : player.facing;
  return { ...spendStamina(player, cost), roll: { elapsedMs: 0, dir }, facing: dir };
}

function tickBuff(player: PlayerState, dtMs: number): PlayerState {
  const buff = player.nextHitBuff;
  if (!buff) return player;
  const remainingMs = buff.remainingMs - dtMs;
  return { ...player, nextHitBuff: remainingMs > 0 ? { ...buff, remainingMs } : null };
}

/** Walking speed factor: slowed while charging a heavy move, rooted during other move phases. */
function walkFactor(player: PlayerState): number {
  if (!player.action) return 1;
  return player.action.phase === 'charging' ? COMBAT.chargingMoveFactor : 0;
}

/**
 * Advances the player one step: roll start (edge input), roll motion with a
 * committed direction, otherwise walking along WASD; then stamina regen.
 * Move actions (combat.ts) run after this and may move the player too (dashes).
 */
export function updatePlayer(
  player: PlayerState,
  input: PlayerInput,
  dtMs: number,
  arena: Arena,
  events: GameEvent[],
  /** Walking speed factor from the ground (shallow water, the flood); rolls are never slowed. */
  wade = 1,
): PlayerState {
  const moveDir = normalize(input.move);
  let next = tickBuff(player, dtMs);
  if (input.roll) next = tryStartRoll(next, moveDir, events);

  if (next.roll) {
    const elapsedMs = next.roll.elapsedMs + dtMs;
    // Only the part of this step that is still inside the roll moves at roll speed.
    const rollMs = Math.min(dtMs, ROLL.durationMs - next.roll.elapsedMs);
    const pos = confine(add(next.pos, scale(next.roll.dir, ROLL_SPEED * rollMs)), arena);
    next = { ...next, pos, roll: elapsedMs >= ROLL.durationMs ? null : { ...next.roll, elapsedMs } };
  } else if (length(moveDir) > 0 && walkFactor(next) > 0) {
    const speed = PLAYER.moveSpeed * (SPECIES[next.species].speedScale ?? 1) * walkFactor(next) * wade;
    const pos = confine(add(next.pos, scale(moveDir, (speed * dtMs) / 1000)), arena);
    next = { ...next, pos, facing: moveDir };
  }

  return regenStamina(next, dtMs);
}

export type HitOutcome = 'hurt' | 'dodged' | 'perfectDodge';

/** Decides what a hit landing now does to the player. Damage itself is applied by the caller. */
export function classifyHit(player: PlayerState, hit: IncomingHit): HitOutcome {
  // A positional attack (`pierceRoll`) goes through the i-frames: only being out of its area avoids it.
  if (hit.pierceRoll || !isInvulnerable(player)) return 'hurt';
  const sinceIframes = (player.roll?.elapsedMs ?? 0) - ROLL.iframesStartMs;
  return sinceIframes <= playerStats(player).perfectWindowMs ? 'perfectDodge' : 'dodged';
}
