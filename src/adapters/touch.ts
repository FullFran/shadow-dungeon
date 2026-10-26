import type { EnemyState, LockType, PlayerInput, Rect } from '../core/state';
import { TUNING } from '../data/tuning';
import { add, distance, dot, length, normalize, scale, sub, type Vec2 } from '../core/vec';
import { screenToWorld } from './view';

/**
 * Touch controls -> PlayerInput (pure). The DOM side (src/ui/touch-controls.ts)
 * records a `TouchFrame` per simulation step; this maps it onto the same
 * PlayerInput the keyboard and mouse produce, so the core never knows about
 * touch. Rules:
 * - the floating joystick is the analogue move vector (the core normalizes it);
 * - Fast / Heavy / Boost / Area are the slot buttons (held = charge, release = fire);
 * - without a lock the moves go along the facing, as with Q/E; with auto-aim
 *   on (default for touch) a move aims at the nearest enemy in a cone in front;
 * - the Lock button acquires the enemy in front (aim = that enemy, else a point
 *   ahead along the facing, so the core's nearest-to-cursor picks the one in
 *   front); a tap toggles with `toggle`, holding it is the lock with `hold`;
 *   a horizontal swipe on it switches target like the wheel;
 * - a free tap on the screen is a left click at that point (click-to-lock),
 *   never an attack.
 */
export interface TouchFrame {
  /** Joystick vector, dead zone applied, length <= 1. */
  move: Vec2;
  /** Edge: Roll pressed since the last step. */
  roll: boolean;
  /** Level: Fast / Heavy / Boost / Area buttons held. */
  fast: boolean;
  heavy: boolean;
  boost: boolean;
  area: boolean;
  /** Level: Lock button held. */
  lockHeld: boolean;
  /** Edge: Lock button released without a swipe. */
  lockTap: boolean;
  /** Swipe steps on the Lock button since the last step (+ right, - left). */
  swipe: number;
  /** Edge: a free tap, in canvas pixels. */
  tap: Vec2 | null;
}

export const IDLE_TOUCH: TouchFrame = { move: { x: 0, y: 0 }, roll: false, fast: false, heavy: false, boost: false, area: false, lockHeld: false, lockTap: false, swipe: 0, tap: null };

/** Auto-aim cone in front of the player (world pixels, radians). */
export const AUTO_AIM = { range: 220, halfAngle: (50 * Math.PI) / 180 } as const;
/** How far ahead along the facing the touch aim sits when there is no enemy in front. */
export const LOCK_PROBE = 64;

/** Joystick: offset from where the thumb landed, zero inside the dead zone, rescaled to 0..1 past it, clamped at the rim. */
export function joystickVector(origin: Vec2, point: Vec2, radius: number, deadZone: number): Vec2 {
  const offset = sub(point, origin);
  const reach = length(offset) / radius;
  if (reach <= deadZone) return { x: 0, y: 0 };
  const magnitude = Math.min(1, (reach - deadZone) / (1 - deadZone));
  return scale(normalize(offset), magnitude);
}

/** Whole swipe steps in a horizontal drag (towards zero). */
export function swipeSteps(dx: number, stepPx: number): number {
  return Math.trunc(dx / stepPx);
}

/** Nearest living enemy inside the cone in front of the player, or null. */
export function autoAimTarget(playerPos: Vec2, facing: Vec2, enemies: readonly EnemyState[], cone: { range: number; halfAngle: number } = AUTO_AIM): EnemyState | null {
  const ahead = normalize(facing);
  if (length(ahead) === 0) return null;
  const minCos = Math.cos(cone.halfAngle);
  let best: EnemyState | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const d = distance(enemy.pos, playerPos);
    if (d > cone.range || d === 0) continue;
    if (dot(normalize(sub(enemy.pos, playerPos)), ahead) < minCos) continue;
    if (d < bestDist) {
      best = enemy;
      bestDist = d;
    }
  }
  return best;
}

export interface TouchAimContext {
  view: Rect;
  pixelScale: number;
  playerPos: Vec2;
  facing: Vec2;
  enemies: readonly EnemyState[];
  lockType: LockType;
  /** A target is locked now (then moves go at it and auto-aim stays out). */
  locked: boolean;
  autoAim: boolean;
}

export function touchToPlayerInput(frame: TouchFrame, ctx: TouchAimContext): PlayerInput {
  const front = autoAimTarget(ctx.playerPos, ctx.facing, ctx.enemies);
  const ahead = add(ctx.playerPos, scale(normalize(ctx.facing), LOCK_PROBE));
  const aim = frame.tap ? screenToWorld(frame.tap, ctx.view, ctx.pixelScale) : (front?.pos ?? ahead);
  const autoAimed = ctx.autoAim && !ctx.locked && front !== null && frame.tap === null;
  return {
    move: frame.move,
    aim,
    // The touch aim is a stand-in (ahead, the enemy in front, a tap): a neutral roll keeps the facing.
    aimPointer: false,
    roll: frame.roll,
    slots: [frame.fast, frame.heavy, frame.boost, frame.area],
    slotMouse: [autoAimed && frame.fast, autoAimed && frame.heavy, autoAimed && frame.boost, autoAimed && frame.area],
    lock: ctx.lockType === 'hold' ? frame.lockHeld : frame.lockTap,
    click: frame.tap !== null,
    wheel: frame.swipe === 0 ? 0 : -frame.swipe * TUNING.lockOn.wheelThreshold,
    view: ctx.view,
  };
}

/**
 * Keyboard/mouse input combined with touch input: the joystick wins over the
 * keys when pushed, buttons combine, and the touch aim is used while touch
 * drives a move, the lock or a tap. An idle touch frame leaves `keyboard` as is.
 */
const slotRange = (a: PlayerInput, b: PlayerInput): number[] => Array.from({ length: Math.max(a.slots.length, b.slots.length) }, (_, i) => i);

export function mergeInputs(keyboard: PlayerInput, touch: PlayerInput): PlayerInput {
  const touchAims = touch.click || touch.lock || touch.slots.some(Boolean);
  return {
    move: length(touch.move) > 0 ? touch.move : keyboard.move,
    aim: touchAims ? touch.aim : keyboard.aim,
    aimPointer: touchAims ? false : Boolean(keyboard.aimPointer),
    roll: keyboard.roll || touch.roll,
    // As long as the longer of the two (an older input with fewer slots counts as not held there).
    slots: slotRange(keyboard, touch).map((i) => Boolean(keyboard.slots[i]) || Boolean(touch.slots[i])),
    slotMouse: slotRange(keyboard, touch).map((i) => (touch.slots[i] ? Boolean(touch.slotMouse[i]) : Boolean(keyboard.slotMouse[i]))),
    lock: keyboard.lock || touch.lock,
    click: keyboard.click || touch.click,
    wheel: keyboard.wheel + touch.wheel,
    view: keyboard.view,
  };
}
