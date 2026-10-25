import { describe, expect, it } from 'vitest';
import type { EnemyState, PlayerInput } from '../../src/core/state';
import { TUNING } from '../../src/data/tuning';
import { toPlayerInput } from '../../src/adapters/input';
import {
  AUTO_AIM,
  autoAimTarget,
  IDLE_TOUCH,
  joystickVector,
  LOCK_PROBE,
  mergeInputs,
  swipeSteps,
  touchToPlayerInput,
  type TouchAimContext,
  type TouchFrame,
} from '../../src/adapters/touch';

const enemy = (id: string, x: number, y: number, alive = true) => ({ id, pos: { x, y }, alive, radius: 10 }) as unknown as EnemyState;
const view = { x: 0, y: 0, width: 512, height: 320 };

function ctx(overrides: Partial<TouchAimContext> = {}): TouchAimContext {
  return { view, pixelScale: 2, playerPos: { x: 100, y: 100 }, facing: { x: 1, y: 0 }, enemies: [], lockType: 'toggle', locked: false, autoAim: false, ...overrides };
}
const frame = (overrides: Partial<TouchFrame> = {}): TouchFrame => ({ ...IDLE_TOUCH, ...overrides });

describe('joystick', () => {
  it('is zero inside the dead zone', () => {
    expect(joystickVector({ x: 0, y: 0 }, { x: 5, y: 0 }, 50, 0.2)).toEqual({ x: 0, y: 0 });
  });

  it('rescales past the dead zone so the edge of it is 0 and the rim is 1', () => {
    const just = joystickVector({ x: 0, y: 0 }, { x: 11, y: 0 }, 50, 0.2);
    expect(just.x).toBeCloseTo(0.025);
    const half = joystickVector({ x: 0, y: 0 }, { x: 0, y: -30 }, 50, 0.2);
    expect(half.y).toBeCloseTo(-0.5);
    expect(half.x).toBeCloseTo(0);
  });

  it('clamps to length 1 beyond the rim and keeps the direction', () => {
    const v = joystickVector({ x: 10, y: 10 }, { x: 110, y: 110 }, 50, 0.2);
    expect(Math.hypot(v.x, v.y)).toBeCloseTo(1);
    expect(v.x).toBeCloseTo(v.y);
  });
});

describe('lock swipe', () => {
  it('counts whole steps either way', () => {
    expect(swipeSteps(10, 32)).toBe(0);
    expect(swipeSteps(40, 32)).toBe(1);
    expect(swipeSteps(-70, 32)).toBe(-2);
  });

  it('turns into wheel deltas that switch target once per step (right = clockwise = wheel up)', () => {
    expect(touchToPlayerInput(frame({ swipe: 1 }), ctx()).wheel).toBe(-TUNING.lockOn.wheelThreshold);
    expect(touchToPlayerInput(frame({ swipe: -2 }), ctx()).wheel).toBe(2 * TUNING.lockOn.wheelThreshold);
  });
});

describe('auto-aim cone', () => {
  it('picks the nearest living enemy inside the cone in front', () => {
    const enemies = [enemy('far', 250, 100), enemy('near', 160, 110), enemy('behind', 60, 100), enemy('dead', 130, 100, false)];
    expect(autoAimTarget({ x: 100, y: 100 }, { x: 1, y: 0 }, enemies)?.id).toBe('near');
  });

  it('ignores enemies outside the angle or the range', () => {
    const side = enemy('side', 100, 160);
    const far = enemy('far', 100 + AUTO_AIM.range + 1, 100);
    expect(autoAimTarget({ x: 100, y: 100 }, { x: 1, y: 0 }, [side, far])).toBeNull();
  });

  it('aims a move at the cone target only when auto-aim is on and nothing is locked', () => {
    const enemies = [enemy('a', 180, 120)];
    const on = touchToPlayerInput(frame({ fast: true }), ctx({ enemies, autoAim: true }));
    expect(on.aim).toEqual({ x: 180, y: 120 });
    expect(on.slotMouse).toEqual([true, false, false, false]);
    const off = touchToPlayerInput(frame({ fast: true }), ctx({ enemies, autoAim: false }));
    expect(off.slotMouse).toEqual([false, false, false, false]);
    const locked = touchToPlayerInput(frame({ heavy: true }), ctx({ enemies, autoAim: true, locked: true }));
    expect(locked.slotMouse).toEqual([false, false, false, false]);
  });
});

describe('touch -> PlayerInput', () => {
  it('maps an idle frame to nothing pressed', () => {
    const input = touchToPlayerInput(IDLE_TOUCH, ctx());
    expect(input).toMatchObject({ move: { x: 0, y: 0 }, roll: false, slots: [false, false, false, false], slotMouse: [false, false, false, false], lock: false, click: false, wheel: 0, view });
  });

  it('passes the analogue move, roll and the held slots', () => {
    const input = touchToPlayerInput(frame({ move: { x: 0.5, y: -0.25 }, roll: true, fast: true, heavy: true }), ctx());
    expect(input.move).toEqual({ x: 0.5, y: -0.25 });
    expect(input.roll).toBe(true);
    expect(input.slots).toEqual([true, true, false, false]);
  });

  it('without a cone target aims along the facing, so the lock picks the enemy in front', () => {
    const input = touchToPlayerInput(frame({ lockTap: true }), ctx({ facing: { x: 0, y: -1 } }));
    expect(input.aim).toEqual({ x: 100, y: 100 - LOCK_PROBE });
    expect(input.lock).toBe(true);
  });

  it('a lock tap is a press with toggle; with hold the button level is the lock', () => {
    expect(touchToPlayerInput(frame({ lockTap: true, lockHeld: false }), ctx()).lock).toBe(true);
    expect(touchToPlayerInput(frame({ lockHeld: true }), ctx()).lock).toBe(false);
    expect(touchToPlayerInput(frame({ lockHeld: true }), ctx({ lockType: 'hold' })).lock).toBe(true);
    expect(touchToPlayerInput(frame({ lockTap: true }), ctx({ lockType: 'hold' })).lock).toBe(false);
  });

  it('a tap is a click at that point in the world (click-to-lock), never an attack', () => {
    const input = touchToPlayerInput(frame({ tap: { x: 200, y: 100 } }), ctx({ view: { ...view, x: 30, y: 10 } }));
    expect(input.click).toBe(true);
    expect(input.aim).toEqual({ x: 130, y: 60 });
    expect(input.slots).toEqual([false, false, false, false]);
  });
});

describe('merging touch with keyboard and mouse', () => {
  const keyboard = (keys: string[] = [], buttons: number[] = []): PlayerInput =>
    toPlayerInput({ keys: new Set(keys), buttons: new Set(buttons), mouse: { x: 40, y: 40 }, rollPressed: false, wheel: 0 }, view, 2);

  it('an idle touch frame leaves the desktop input unchanged', () => {
    const k = keyboard(['KeyW', 'KeyQ'], [2]);
    expect(mergeInputs(k, touchToPlayerInput(IDLE_TOUCH, ctx()))).toEqual(k);
  });

  it('the joystick wins over keys, buttons combine, and a touch move takes the touch aim', () => {
    const t = touchToPlayerInput(frame({ move: { x: 1, y: 0 }, heavy: true }), ctx({ enemies: [enemy('a', 150, 100)], autoAim: true }));
    const merged = mergeInputs(keyboard(['KeyS', 'KeyQ']), t);
    expect(merged.move).toEqual({ x: 1, y: 0 });
    expect(merged.slots).toEqual([true, true, false, false]);
    expect(merged.slotMouse).toEqual([false, true, false, false]);
    expect(merged.aim).toEqual({ x: 150, y: 100 });
  });
});
