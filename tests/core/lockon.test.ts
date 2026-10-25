import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { clickLockActive, configureLock, cycleTarget, enemyUnderCursor, lockCandidates, nearestToCursor, updateLock, type LockContext } from '../../src/core/lockon';
import type { EnemyState, GameEvent, LockState, LockType, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { initialAi } from '../../src/core/enemies';
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
    ai: initialAi(true),
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

const unlocked = (clickToLock = true, lockType: LockType = 'toggle'): LockState => ({ lockType, clickToLock, targetId: null, wheelAccum: 0, keyHeld: false, clickHeld: false });
const lockedOn = (targetId: string, clickToLock = true, lockType: LockType = 'toggle'): LockState => ({ lockType, clickToLock, targetId, wheelAccum: 0, keyHeld: false, clickHeld: false });

/** Runs updateLock over a sequence of inputs, collecting events. */
function drive(lock: LockState, inputs: { held?: boolean; click?: boolean; wheel?: number }[], context = ctx()) {
  const events: GameEvent[] = [];
  let current = lock;
  for (const { held = false, click = false, wheel = 0 } of inputs) current = updateLock(current, { held, click, wheel }, context, events);
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

describe('lock toggle', () => {
  it('a press locks the enemy nearest the cursor and the next press releases it', () => {
    const on = drive(unlocked(), [{ held: true }, { held: true }, { held: false }]);
    expect(on.lock.targetId).toBe('east');
    expect(on.events).toEqual([{ type: 'lockAcquired', targetId: 'east' }]);

    const off = drive(on.lock, [{ held: true }]);
    expect(off.lock.targetId).toBeNull();
    expect(off.events).toContainEqual({ type: 'lockReleased', reason: 'key' });
  });

  it('keeps the lock after the key is let go, and never switches when the cursor moves', () => {
    const on = drive(unlocked(), [{ held: true }, { held: false }]);
    const cursorOnWest = drive(on.lock, [{ held: false }, { held: false }], ctx({ cursor: vec(300, 300) }));
    expect(cursorOnWest.lock.targetId).toBe('east');
    expect(cursorOnWest.events).toEqual([]);
  });

  it('re-locks on a new target by releasing and pressing again while pointing', () => {
    const relocked = drive(lockedOn('east'), [{ held: true }, { held: false }, { held: true }], ctx({ cursor: vec(300, 310) }));
    expect(relocked.lock.targetId).toBe('west');
  });
});

describe('click to lock', () => {
  const onWest = ctx({ cursor: vec(305, 302) });

  it('finds the enemy whose body the cursor is over, within the margin', () => {
    const edge = TUNING.lockOn.clickMargin + WEST.radius;
    expect(enemyUnderCursor(ctx({ cursor: vec(300 + edge - 0.5, 300) }))?.id).toBe('west');
    expect(enemyUnderCursor(ctx({ cursor: vec(300 + edge + 0.5, 300) }))).toBeNull();
    const deadWest = enemy('west', vec(300, 300), { alive: false });
    expect(enemyUnderCursor(ctx({ enemies: [deadWest], cursor: vec(300, 300) }))).toBeNull();
  });

  it('a click on an enemy acquires it when nothing is locked', () => {
    const { lock, events } = drive(unlocked(), [{ click: true }], onWest);
    expect(lock.targetId).toBe('west');
    expect(events).toEqual([{ type: 'lockAcquired', targetId: 'west' }]);
  });

  it('a click on another enemy switches the lock to it', () => {
    const { lock, events } = drive(lockedOn('east'), [{ click: true }], onWest);
    expect(lock.targetId).toBe('west');
    expect(events).toEqual([{ type: 'lockSwitched', targetId: 'west' }]);
  });

  it('a click on the locked enemy or on empty ground keeps the lock', () => {
    const same = drive(lockedOn('east'), [{ click: true }], ctx({ cursor: vec(500, 300) }));
    expect(same.lock.targetId).toBe('east');
    expect(same.events).toEqual([]);

    const ground = drive(lockedOn('east'), [{ click: true }], ctx({ cursor: vec(350, 250) }));
    expect(ground.lock.targetId).toBe('east');
    const groundUnlocked = drive(unlocked(), [{ click: true }], ctx({ cursor: vec(350, 250) }));
    expect(groundUnlocked.lock.targetId).toBeNull();
  });

  it('only the press edge counts: holding the button and moving onto an enemy does not switch', () => {
    const held = drive(lockedOn('east'), [{ click: true }], ctx({ cursor: vec(350, 250) }));
    const dragged = drive(held.lock, [{ click: true }, { click: true }], onWest);
    expect(dragged.lock.targetId).toBe('east');
  });

  it('moving the cursor over an enemy without clicking never switches', () => {
    const { lock } = drive(lockedOn('east'), [{}, {}, {}], onWest);
    expect(lock.targetId).toBe('east');
  });

  it('does nothing when the setting is off', () => {
    expect(drive(lockedOn('east', false), [{ click: true }], onWest).lock.targetId).toBe('east');
    expect(drive(unlocked(false), [{ click: true }], onWest).lock.targetId).toBeNull();
  });
});

describe('wheel switching', () => {
  it('wheel up goes clockwise, wheel down counter-clockwise', () => {
    expect(drive(lockedOn('east'), [{ wheel: -100 }]).lock.targetId).toBe('south');
    expect(drive(lockedOn('east'), [{ wheel: 100 }]).lock.targetId).toBe('north');
  });

  it('accumulates small touchpad deltas up to the threshold before switching once', () => {
    const small = -TUNING.lockOn.wheelThreshold / 6;
    const ticks = Array.from({ length: 8 }, () => ({ wheel: small }));
    const { lock, events } = drive(lockedOn('east'), ticks);
    expect(lock.targetId).toBe('south');
    expect(events.filter((e) => e.type === 'lockSwitched')).toHaveLength(1);

    const notEnough = drive(lockedOn('east'), ticks.slice(0, 4));
    expect(notEnough.lock.targetId).toBe('east');
  });

  it('drops the accumulated delta when the wheel changes direction', () => {
    const almost = -TUNING.lockOn.wheelThreshold * 0.8;
    const { lock } = drive(lockedOn('east'), [{ wheel: almost }, { wheel: 20 }, { wheel: almost * 0.5 }]);
    expect(lock.targetId).toBe('east');
  });
});

describe('lock types', () => {
  it('hold: a press locks the enemy nearest the cursor and letting go releases it', () => {
    const { lock, events } = drive(unlocked(true, 'hold'), [{ held: true }, { held: true }, { held: true }]);
    expect(lock.targetId).toBe('east');
    expect(events).toEqual([{ type: 'lockAcquired', targetId: 'east' }]);
    const released = drive(lock, [{ held: false }]);
    expect(released.lock.targetId).toBeNull();
    expect(released.events).toEqual([{ type: 'lockReleased', reason: 'key' }]);
  });

  it('hold: click-to-lock switches only while the lock input is held', () => {
    const atWest = ctx({ cursor: vec(305, 300) });
    const whileHeld = drive(lockedOn('east', true, 'hold'), [{ held: true }, { held: true, click: true }], atWest);
    expect(whileHeld.lock.targetId).toBe('west');
    const notHeld = drive(unlocked(true, 'hold'), [{ click: true }], atWest);
    expect(notHeld.lock.targetId).toBeNull();
    expect(notHeld.events).toEqual([]);
  });

  it('clickOnly: Shift and middle mouse do nothing', () => {
    const { lock, events } = drive(unlocked(false, 'clickOnly'), [{ held: true }, {}, { held: true }]);
    expect(lock.targetId).toBeNull();
    expect(events).toEqual([]);
    expect(drive(lockedOn('east', false, 'clickOnly'), [{ held: true }]).lock.targetId).toBe('east');
  });

  it('clickOnly: a click on an enemy locks or switches, a click on the ground releases', () => {
    // clickToLock off is ignored: click-only always locks on click.
    const acquired = drive(unlocked(false, 'clickOnly'), [{ click: true }], ctx({ cursor: vec(505, 300) }));
    expect(acquired.lock.targetId).toBe('east');
    expect(acquired.events).toEqual([{ type: 'lockAcquired', targetId: 'east' }]);
    const switched = drive(acquired.lock, [{}, { click: true }], ctx({ cursor: vec(305, 300) }));
    expect(switched.lock.targetId).toBe('west');
    expect(switched.events).toEqual([{ type: 'lockSwitched', targetId: 'west' }]);
    const same = drive(switched.lock, [{}, { click: true }], ctx({ cursor: vec(305, 300) }));
    expect(same.lock.targetId).toBe('west');
    const ground = drive(switched.lock, [{}, { click: true }], ctx({ cursor: vec(450, 450) }));
    expect(ground.lock.targetId).toBeNull();
    expect(ground.events).toEqual([{ type: 'lockReleased', reason: 'click' }]);
  });

  it('off: neither the lock input nor a click ever locks, and the wheel does nothing', () => {
    const { lock, events } = drive(unlocked(true, 'off'), [{ held: true }, {}, { click: true }, { held: true, click: true, wheel: -500 }], ctx({ cursor: vec(505, 300) }));
    expect(lock.targetId).toBeNull();
    expect(events).toEqual([]);
  });

  it('toggle keeps tap-to-lock, tap-to-release', () => {
    const { lock } = drive(unlocked(true, 'toggle'), [{ held: true }, {}, {}]);
    expect(lock.targetId).toBe('east');
    expect(drive(lock, [{ held: true }]).lock.targetId).toBeNull();
  });

  it('wheel switching works in every type that can lock', () => {
    for (const lockType of ['toggle', 'hold', 'clickOnly'] as const) {
      const held = lockType === 'hold';
      const { lock } = drive(lockedOn('east', true, lockType), [{ held }, { held, wheel: -TUNING.lockOn.wheelThreshold }]);
      expect(lock.targetId).toBe('south');
    }
  });

  it('click-to-lock (and its hover marker) is on with the setting, implied by click-only and never with off', () => {
    expect(clickLockActive(unlocked(true, 'toggle'))).toBe(true);
    expect(clickLockActive(unlocked(false, 'toggle'))).toBe(false);
    expect(clickLockActive(unlocked(true, 'hold'))).toBe(true);
    expect(clickLockActive(unlocked(false, 'clickOnly'))).toBe(true);
    expect(clickLockActive(unlocked(true, 'off'))).toBe(false);
  });

  it('changing the settings mid-run applies them; changing the type drops the current target', () => {
    const sameType = configureLock(lockedOn('east', true, 'toggle'), { lockType: 'toggle', clickToLock: false });
    expect(sameType).toMatchObject({ targetId: 'east', clickToLock: false });
    const toOff = configureLock(lockedOn('east', true, 'toggle'), { lockType: 'off', clickToLock: true });
    expect(toOff).toMatchObject({ targetId: null, lockType: 'off' });
  });
});

describe('automatic release', () => {
  it('jumps to the enemy nearest the cursor when the target dies', () => {
    const eastDead = [enemy('east', vec(500, 300), { alive: false }), SOUTH, WEST, NORTH];
    const { lock, events } = drive(lockedOn('east'), [{}], ctx({ enemies: eastDead, cursor: vec(310, 300) }));
    expect(lock.targetId).toBe('west');
    expect(events).toContainEqual({ type: 'lockSwitched', targetId: 'west' });

    const nobody = drive(lockedOn('east'), [{}], ctx({ enemies: [enemy('east', vec(500, 300), { alive: false })] }));
    expect(nobody.lock.targetId).toBeNull();
    expect(nobody.events).toContainEqual({ type: 'lockReleased', reason: 'noTarget' });
  });

  it('releases when the target leaves range or the screen, and does not re-acquire on its own', () => {
    const far = drive(lockedOn('east'), [{}, {}], ctx({ enemies: [enemy('east', vec(400 + TUNING.lockOn.range + 20, 300)), WEST] }));
    expect(far.lock.targetId).toBeNull();
    expect(far.events).toContainEqual({ type: 'lockReleased', reason: 'range' });

    const hidden = drive(lockedOn('east'), [{}], ctx({ view: { x: 0, y: 0, width: 450, height: 600 } }));
    expect(hidden.lock.targetId).toBeNull();
    expect(hidden.events).toContainEqual({ type: 'lockReleased', reason: 'offscreen' });
  });
});

describe('lock-on in the simulation', () => {
  function lockedWorld(): WorldState {
    let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER });
    state = spawnEnemy(state, 'gastly', vec(400, 275), { dormant: true }); // north, close enough to claw
    state = spawnEnemy(state, 'gastly', vec(600, 300), { dormant: true }); // east, far from the claw
    // Point at the north enemy and tap Shift.
    return step(state, { ...IDLE, aim: vec(400, 270), lock: true }, FIXED_DT_MS);
  }

  it('aims moves at the target even when the cursor is elsewhere', () => {
    let state = lockedWorld();
    expect(state.lock.targetId).toBe(state.enemies[0]!.id);
    const events: GameEvent[] = [];
    const cursorEast = { ...IDLE, aim: vec(700, 300) };
    state = step(state, { ...cursorEast, slots: [true, false] }, FIXED_DT_MS);
    for (let i = 0; i < 30; i++) {
      state = step(state, cursorEast, FIXED_DT_MS);
      events.push(...state.events);
    }
    expect(events.filter((e) => e.type === 'enemyHit').map((e) => e.type === 'enemyHit' && e.enemyId)).toEqual([state.enemies[0]!.id]);
  });

  it('still rolls along WASD while locked', () => {
    const state = lockedWorld();
    let rolled = step(state, { ...IDLE, aim: vec(400, 270), move: vec(1, 0), roll: true }, FIXED_DT_MS);
    for (let i = 0; i < 10; i++) rolled = step(rolled, { ...IDLE, move: vec(1, 0) }, FIXED_DT_MS);
    expect(rolled.player.pos.x).toBeGreaterThan(PLAYER.x + 40);
    expect(rolled.player.pos.y).toBeCloseTo(PLAYER.y);
    expect(rolled.lock.targetId).toBe(state.enemies[0]!.id);
  });

  it('a left click on an enemy locks it and still attacks; Q never click-locks', () => {
    let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER });
    state = spawnEnemy(state, 'gastly', vec(400, 275), { dormant: true });
    const clicked = step(state, { ...IDLE, aim: vec(400, 275), slots: [true, false], slotMouse: [true, false], click: true }, FIXED_DT_MS);
    expect(clicked.lock.targetId).toBe(clicked.enemies[0]!.id);
    expect(clicked.player.action?.moveId).toBe('shadow-claw');

    const withQ = step(state, { ...IDLE, aim: vec(400, 275), slots: [true, false] }, FIXED_DT_MS);
    expect(withQ.lock.targetId).toBeNull();

    const optedOut = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, clickToLock: false });
    const ignored = step(spawnEnemy(optedOut, 'gastly', vec(400, 275), { dormant: true }), { ...IDLE, aim: vec(400, 275), slots: [true, false], slotMouse: [true, false], click: true }, FIXED_DT_MS);
    expect(ignored.lock.targetId).toBeNull();
  });

  it('the lock type comes from the world options (click-only locks on click, off never locks)', () => {
    const clickInput = { ...IDLE, aim: vec(400, 275), slots: [true, false], slotMouse: [true, false], click: true };
    for (const [lockType, locked] of [['clickOnly', true], ['off', false]] as const) {
      const state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, lockType, clickToLock: false });
      const clicked = step(spawnEnemy(state, 'gastly', vec(400, 275), { dormant: true }), clickInput, FIXED_DT_MS);
      expect(clicked.lock.targetId !== null).toBe(locked);
      expect(clicked.player.action?.moveId).toBe('shadow-claw');
    }
    expect(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER }).lock.lockType).toBe('toggle');
  });
});
