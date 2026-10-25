import { TUNING } from '../data/tuning';
import type { EnemyState, GameEvent, LockState, Rect } from './state';
import { angleOf, distance, sub, type Vec2 } from './vec';

/**
 * Lock-on rules (docs/gdd.md §4 "Apuntar y fijar"). The target only changes
 * through explicit gestures: pressing the lock key (nearest enemy to the
 * cursor), the wheel (next enemy by angle around the player), or the target
 * dying. Moving the mouse while locked never switches target.
 */
const { lockOn: LOCK } = TUNING;
const TAU = Math.PI * 2;

export interface LockContext {
  playerPos: Vec2;
  cursor: Vec2;
  view: Rect;
  enemies: readonly EnemyState[];
}

export interface LockInput {
  held: boolean;
  /** Wheel deltaY since the last tick; negative = wheel up. */
  wheel: number;
}

const inView = (pos: Vec2, view: Rect) =>
  pos.x >= view.x && pos.x <= view.x + view.width && pos.y >= view.y && pos.y <= view.y + view.height;

/** Enemies that can be locked: alive, within range of the player and on screen. */
export function lockCandidates(ctx: LockContext): EnemyState[] {
  return ctx.enemies.filter((e) => e.alive && distance(e.pos, ctx.playerPos) <= LOCK.range && inView(e.pos, ctx.view));
}

export function nearestToCursor(ctx: LockContext): EnemyState | null {
  let best: EnemyState | null = null;
  for (const enemy of lockCandidates(ctx)) {
    if (!best || distance(enemy.pos, ctx.cursor) < distance(best.pos, ctx.cursor)) best = enemy;
  }
  return best;
}

/**
 * Next candidate by angle around the player, starting from the current target.
 * Screen y grows downwards, so increasing atan2 angle is clockwise on screen.
 */
export function cycleTarget(
  currentId: string,
  candidates: readonly EnemyState[],
  playerPos: Vec2,
  direction: 'clockwise' | 'counterClockwise',
): string {
  const current = candidates.find((e) => e.id === currentId);
  if (!current) return currentId;
  const base = angleOf(sub(current.pos, playerPos));
  let bestId = currentId;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const enemy of candidates) {
    if (enemy.id === currentId) continue;
    const raw = angleOf(sub(enemy.pos, playerPos)) - base;
    const signed = direction === 'clockwise' ? raw : -raw;
    const delta = ((signed % TAU) + TAU) % TAU || TAU; // same angle counts as a full turn
    if (delta < bestDelta) {
      bestDelta = delta;
      bestId = enemy.id;
    }
  }
  return bestId;
}

function acquire(lock: LockState, ctx: LockContext, events: GameEvent[]): LockState {
  const target = nearestToCursor(ctx);
  if (target) events.push({ type: 'lockAcquired', targetId: target.id });
  return { ...lock, targetId: target?.id ?? null, wheelAccum: 0 };
}

function release(lock: LockState, reason: 'key' | 'range' | 'offscreen' | 'noTarget', events: GameEvent[]): LockState {
  events.push({ type: 'lockReleased', reason });
  return { ...lock, targetId: null, wheelAccum: 0 };
}

/** Keeps the lock valid: a dead target hands over to the nearest-to-cursor enemy; range/screen exits release. */
function validate(lock: LockState, ctx: LockContext, events: GameEvent[]): LockState {
  const target = ctx.enemies.find((e) => e.id === lock.targetId);
  if (!target || !target.alive) {
    const next = nearestToCursor(ctx);
    if (!next) return release(lock, 'noTarget', events);
    events.push({ type: 'lockSwitched', targetId: next.id });
    return { ...lock, targetId: next.id, wheelAccum: 0 };
  }
  if (distance(target.pos, ctx.playerPos) > LOCK.range) return release(lock, 'range', events);
  if (!inView(target.pos, ctx.view)) return release(lock, 'offscreen', events);
  return lock;
}

/** Accumulates wheel deltas (reset on direction change) and switches once per threshold crossed. */
function applyWheel(lock: LockState, wheel: number, ctx: LockContext, events: GameEvent[]): LockState {
  if (wheel === 0 || lock.targetId === null) return lock;
  const sameDirection = Math.sign(wheel) === Math.sign(lock.wheelAccum);
  let accum = sameDirection ? lock.wheelAccum + wheel : wheel;
  let targetId = lock.targetId;
  const candidates = lockCandidates(ctx);
  while (Math.abs(accum) >= LOCK.wheelThreshold) {
    const direction = accum < 0 ? 'clockwise' : 'counterClockwise';
    accum -= Math.sign(accum) * LOCK.wheelThreshold;
    const next = cycleTarget(targetId, candidates, ctx.playerPos, direction);
    if (next !== targetId) {
      targetId = next;
      events.push({ type: 'lockSwitched', targetId });
    }
  }
  return { ...lock, targetId, wheelAccum: accum };
}

/** One tick of lock-on: key handling per mode, target validity, then wheel switching. */
export function updateLock(lock: LockState, input: LockInput, ctx: LockContext, events: GameEvent[]): LockState {
  const pressed = input.held && !lock.keyHeld;
  let next: LockState = { ...lock, keyHeld: input.held };

  if (next.mode === 'hold') {
    if (!input.held) return next.targetId === null ? next : release(next, 'key', events);
    if (pressed) next = acquire(next, ctx, events);
  } else if (pressed) {
    next = next.targetId === null ? acquire(next, ctx, events) : release(next, 'key', events);
  }

  if (next.targetId === null) return next;
  next = validate(next, ctx, events);
  return applyWheel(next, input.wheel, ctx, events);
}
