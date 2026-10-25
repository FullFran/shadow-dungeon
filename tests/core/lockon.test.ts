import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { cycleTarget, lockCandidates, nearestToCursor, updateLock, type LockContext } from '../../src/core/lockon';
import type { EnemyState, GameEvent, LockState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { vec, type Vec2 } from '../../src/core/vec';
import { IDLE } from './helpers';

const PLAYER = vec(400, 300);
const VIEW = { x: 0, y: 0, width: 800, height: 600 };

function enemy(id: string, pos: Vec2, overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id,
    species: 'poochyena',
    types: ['dark'],
    pos,
    facing: vec(0, 1),
    hp: 10,
    maxHp: 10,
    radius: 10,
    alive: true,
    hitstunMs: 0,
    knockback: vec(0, 0),
    ...overrides,
  };
}

// Compass around the player. Screen y grows down, so clockwise is east -> south -> west -> north.
const EAST = enemy('east', vec(500, 300));
const SOUTH = enemy('south', vec(400, 400));
const WEST = enemy('west', vec(300, 300));
const NORTH = enemy('north', vec(400, 200));
const COMPASS = [EAST, SOUTH, WEST, NORTH];

const ctx = (overrides: Partial<LockContext> = {}): LockContext => ({
  playerPos: PLAYER,
  cursor: vec(520, 300),
  view: VIEW,
  enemies: COMPASS,
  ...overrides,
});

const unlocked = (mode: LockState['mode'] = 'hold'): LockState => ({ mode, targetId: null, wheelAccum: 0, keyHeld: false });
const lockedOn = (targetId: string, mode: LockState['mode'] = 'hold'): LockState => ({ mode, targetId, wheelAccum: 0, keyHeld: true });

/** Runs updateLock over a sequence of inputs, collecting events. */
function drive(lock: LockState, inputs: { held: boolean; wheel?: number }[], context = ctx()) {
  const events: GameEvent[] = [];
  let current = lock;
  for (const { held, wheel = 0 } of inputs) current = updateLock(current, { held, wheel }, context, events);
  return { lock: current, events };
}

describe('candidates and initial target', () => {
  it('only considers living enemies in range and on screen', () => {
    const far = enemy('far', vec(400 + TUNING.lockOn.range + 50, 300));
    const offscreen = enemy('offscreen', vec(400, -20)); // in range, above the view
    const dead = enemy('dead', vec(420, 300), { alive: false });
    const ids = lockCandidates(ctx({ enemies: [EAST, far, offscreen, dead], view: { x: 0, y: 0, width: 2000, height: 600 } })).map((e) => e.id);
    expect(ids).toEqual(['east']);
  });

  it('picks the enemy nearest the cursor, not the one nearest the player', () => {
    const close = enemy('close', vec(430, 300));
    const pointed = enemy('pointed', vec(250, 350));
    expect(nearestToCursor(ctx({ enemies: [close, pointed], cursor: vec(260, 340) }))?.id).toBe('pointed');
    expect(nearestToCursor(ctx({ enemies: [] }))).toBeNull();
  });
});

describe('cycling order', () => {
  it('goes clockwise and counter-clockwise by angle around the player', () => {
    expect(cycleTarget('east', COMPASS, PLAYER, 'clockwise')).toBe('south');
    expect(cycleTarget('south', COMPASS, PLAYER, 'clockwise')).toBe('west');
    expect(cycleTarget('north', COMPASS, PLAYER, 'clockwise')).toBe('east');
    expect(cycleTarget('east', COMPASS, PLAYER, 'counterClockwise')).toBe('north');
    expect(cycleTarget('east', [EAST], PLAYER, 'clockwise')).toBe('east');
  });
});

describe('hold mode', () => {
  it('locks on press, never switches when the cursor moves, and releases with the key', () => {
    const pressed = drive(unlocked(), [{ held: true }]);
    expect(pressed.lock.targetId).toBe('east');
    expect(pressed.events).toContainEqual({ type: 'lockAcquired', targetId: 'east' });

    const cursorOnWest = drive(pressed.lock, [{ held: true }, { held: true }], ctx({ cursor: vec(300, 300) }));
    expect(cursorOnWest.lock.targetId).toBe('east');

    const released = drive(cursorOnWest.lock, [{ held: false }]);
    expect(released.lock.targetId).toBeNull();
    expect(released.events).toContainEqual({ type: 'lockReleased', reason: 'key' });
  });

  it('re-locks on a new target by releasing and pointing', () => {
    const relocked = drive(lockedOn('east'), [{ held: false }, { held: true }], ctx({ cursor: vec(300, 310) }));
    expect(relocked.lock.targetId).toBe('west');
  });
});

describe('toggle mode', () => {
  it('locks on one press and releases on the next', () => {
    const on = drive(unlocked('toggle'), [{ held: true }, { held: false }, { held: false }]);
    expect(on.lock.targetId).toBe('east');
    const off = drive(on.lock, [{ held: true }]);
    expect(off.lock.targetId).toBeNull();
  });
});

describe('wheel switching', () => {
  it('wheel up goes clockwise, wheel down counter-clockwise', () => {
    expect(drive(lockedOn('east'), [{ held: true, wheel: -100 }]).lock.targetId).toBe('south');
    expect(drive(lockedOn('east'), [{ held: true, wheel: 100 }]).lock.targetId).toBe('north');
  });

  it('accumulates small touchpad deltas up to the threshold before switching once', () => {
    const small = -TUNING.lockOn.wheelThreshold / 6;
    const ticks = Array.from({ length: 8 }, () => ({ held: true, wheel: small }));
    const { lock, events } = drive(lockedOn('east'), ticks);
    expect(lock.targetId).toBe('south');
    expect(events.filter((e) => e.type === 'lockSwitched')).toHaveLength(1);

    const notEnough = drive(lockedOn('east'), ticks.slice(0, 4));
    expect(notEnough.lock.targetId).toBe('east');
  });

  it('drops the accumulated delta when the wheel changes direction', () => {
    const almost = -TUNING.lockOn.wheelThreshold * 0.8;
    const { lock } = drive(lockedOn('east'), [{ held: true, wheel: almost }, { held: true, wheel: 20 }, { held: true, wheel: almost * 0.5 }]);
    expect(lock.targetId).toBe('east');
  });
});

describe('automatic release', () => {
  it('jumps to the enemy nearest the cursor when the target dies', () => {
    const eastDead = [enemy('east', vec(500, 300), { alive: false }), SOUTH, WEST, NORTH];
    const { lock, events } = drive(lockedOn('east'), [{ held: true }], ctx({ enemies: eastDead, cursor: vec(310, 300) }));
    expect(lock.targetId).toBe('west');
    expect(events).toContainEqual({ type: 'lockSwitched', targetId: 'west' });

    const nobody = drive(lockedOn('east'), [{ held: true }], ctx({ enemies: [enemy('east', vec(500, 300), { alive: false })] }));
    expect(nobody.lock.targetId).toBeNull();
    expect(nobody.events).toContainEqual({ type: 'lockReleased', reason: 'noTarget' });
  });

  it('releases when the target leaves range or the screen, and does not re-acquire while held', () => {
    const far = drive(lockedOn('east'), [{ held: true }, { held: true }], ctx({ enemies: [enemy('east', vec(400 + TUNING.lockOn.range + 20, 300)), WEST] }));
    expect(far.lock.targetId).toBeNull();
    expect(far.events).toContainEqual({ type: 'lockReleased', reason: 'range' });

    const hidden = drive(lockedOn('east'), [{ held: true }], ctx({ view: { x: 0, y: 0, width: 450, height: 600 } }));
    expect(hidden.lock.targetId).toBeNull();
    expect(hidden.events).toContainEqual({ type: 'lockReleased', reason: 'offscreen' });
  });
});

describe('lock-on in the simulation', () => {
  function lockedWorld(): WorldState {
    let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER });
    state = spawnEnemy(state, 'gastly', vec(400, 275)); // north, close enough to claw
    state = spawnEnemy(state, 'gastly', vec(600, 300)); // east, far from the claw
    // Point at the north enemy and press Shift.
    return step(state, { ...IDLE, aim: vec(400, 270), lock: true }, FIXED_DT_MS);
  }

  it('aims moves at the target even when the cursor is elsewhere', () => {
    let state = lockedWorld();
    expect(state.lock.targetId).toBe(state.enemies[0]!.id);
    const events: GameEvent[] = [];
    const cursorEast = { ...IDLE, aim: vec(700, 300), lock: true };
    state = step(state, { ...cursorEast, slots: [true, false] }, FIXED_DT_MS);
    for (let i = 0; i < 30; i++) {
      state = step(state, cursorEast, FIXED_DT_MS);
      events.push(...state.events);
    }
    expect(events.filter((e) => e.type === 'enemyHit').map((e) => e.type === 'enemyHit' && e.enemyId)).toEqual([state.enemies[0]!.id]);
  });

  it('still rolls along WASD while locked', () => {
    const state = lockedWorld();
    let rolled = step(state, { ...IDLE, aim: vec(400, 270), lock: true, move: vec(1, 0), roll: true }, FIXED_DT_MS);
    for (let i = 0; i < 10; i++) rolled = step(rolled, { ...IDLE, lock: true, move: vec(1, 0) }, FIXED_DT_MS);
    expect(rolled.player.pos.x).toBeGreaterThan(PLAYER.x + 40);
    expect(rolled.player.pos.y).toBeCloseTo(PLAYER.y);
    expect(rolled.lock.targetId).toBe(state.enemies[0]!.id);
  });
});
