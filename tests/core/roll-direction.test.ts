import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { loadRoom } from '../../src/core/rooms';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { normalize, vec, type Vec2 } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import { input, run, ticksFor, world } from './helpers';

/**
 * Playtest 2026-10-26: "al esquivar solo vas hacia la derecha... estaba
 * apuntando". Which way a roll goes: the held direction; with none held, the
 * locked target, else the mouse cursor (`aimPointer`), else the facing; and a
 * direction pressed in the first ~100 ms of a neutral roll still redirects it.
 */
const { roll } = TUNING;
const START = vec(400, 300);

/** Steps through `inputs` (one per tick), then idles until the roll is over. */
function play(state: WorldState, inputs: Partial<PlayerInput>[]): WorldState {
  let current = state;
  for (const overrides of inputs) current = step(current, input(overrides), FIXED_DT_MS);
  return run(current, input(), ticksFor(roll.durationMs) + 2);
}

const shift = (after: WorldState, from: Vec2 = START): Vec2 => ({ x: after.player.pos.x - from.x, y: after.player.pos.y - from.y });
/** Unit direction of the displacement. */
const heading = (after: WorldState, from: Vec2 = START): Vec2 => normalize(shift(after, from));

describe('roll direction with a direction held', () => {
  const DIRS: [string, Vec2][] = [
    ['right', vec(1, 0)],
    ['left', vec(-1, 0)],
    ['up', vec(0, -1)],
    ['down', vec(0, 1)],
    ['up-left', vec(-1, -1)],
    ['up-right', vec(1, -1)],
    ['down-left', vec(-1, 1)],
    ['down-right', vec(1, 1)],
  ];
  for (const [name, dir] of DIRS) {
    it(`goes ${name} when that direction is held as roll is pressed`, () => {
      const started = step(world(), input({ move: dir, roll: true }), FIXED_DT_MS);
      expect(started.player.roll?.dir.x).toBeCloseTo(normalize(dir).x, 5);
      expect(started.player.roll?.dir.y).toBeCloseTo(normalize(dir).y, 5);
    });
  }

  it('the held direction beats the cursor and the lock', () => {
    const locked = lockOn(world(), vec(400, 150));
    const started = step(locked, input({ move: vec(-1, 0), roll: true, aim: vec(400, 500), aimPointer: true }), FIXED_DT_MS);
    expect(started.player.roll?.dir).toEqual(vec(-1, 0));
  });
});

describe('a near-simultaneous press: roll a step or two before the direction', () => {
  it('Space one step before A still rolls left (the direction buffer)', () => {
    const after = play(world(), [{ roll: true }, { move: vec(-1, 0) }]);
    expect(heading(after).x).toBeLessThan(-0.99);
    // The whole roll goes left: no part of it is spent going right first.
    expect(shift(after).x).toBeLessThan(-roll.distance + 2);
  });

  it('Space two steps before A still rolls left', () => {
    const after = play(world(), [{ roll: true }, {}, { move: vec(-1, 0) }]);
    expect(shift(after).x).toBeLessThan(-roll.distance + 2);
  });

  it('Space before W+A rolls up-left', () => {
    const after = play(world(), [{ roll: true }, { move: vec(-1, -1) }]);
    const h = heading(after);
    expect(h.x).toBeCloseTo(-Math.SQRT1_2, 2);
    expect(h.y).toBeCloseTo(-Math.SQRT1_2, 2);
  });

  it('the buffer only redirects once and only in its window (a late key does not steer the roll)', () => {
    const late = Math.ceil(150 / FIXED_DT_MS);
    const after = play(world(), [{ roll: true }, ...Array.from({ length: late }, () => ({})), { move: vec(-1, 0) }, { move: vec(-1, 0) }]);
    // Facing (0,1) from createWorld: the roll went down, the late A did not turn it.
    expect(shift(after).y).toBeGreaterThan(roll.distance - 2);
  });

  it('a roll started with a direction is never redirected', () => {
    const after = play(world(), [{ move: vec(1, 0), roll: true }, { move: vec(-1, 0) }]);
    expect(shift(after).x).toBeGreaterThan(0);
  });
});

describe('roll direction with no direction held', () => {
  it('entering a room and rolling without having moved goes right (the room facing)', () => {
    const room = loadRoom(world(), 'sandbox');
    const from = room.player.pos;
    const after = play(room, [{ roll: true }]);
    expect(heading(after, from).x).toBeGreaterThan(0.99);
  });

  it('goes towards the mouse cursor when the aim is a live pointer', () => {
    const after = play(world(), [{ roll: true, aim: vec(250, 300), aimPointer: true }]);
    expect(heading(after).x).toBeLessThan(-0.99);
  });

  it('a room entered facing right still rolls at the cursor (the playtest case)', () => {
    const room = loadRoom(world(), 'sandbox');
    const from = room.player.pos;
    const aim = vec(from.x, from.y - 100);
    const after = play(room, [{ roll: true, aim, aimPointer: true }]);
    expect(heading(after, from).y).toBeLessThan(-0.99);
  });

  it('goes towards the locked target when there is one', () => {
    const locked = lockOn(world(), vec(400, 150));
    const after = play(locked, [{ roll: true, aim: vec(600, 300), aimPointer: true }]);
    expect(heading(after).y).toBeLessThan(-0.99);
  });

  it('falls back to the facing without a pointer (touch, keys only)', () => {
    const facingLeft = run(world(), input({ move: vec(-1, 0) }), 1);
    const from = facingLeft.player.pos;
    const after = play(facingLeft, [{ roll: true, aim: vec(400, 500) }]);
    expect(heading(after, from).x).toBeLessThan(-0.99);
  });

  it('falls back to the facing when the cursor sits on the player', () => {
    const after = play(world(), [{ roll: true, aim: START, aimPointer: true }]);
    expect(heading(after).y).toBeGreaterThan(0.99);
  });

  it('the roll turns the facing its way', () => {
    const started = step(world(), input({ roll: true, aim: vec(250, 300), aimPointer: true }), FIXED_DT_MS);
    expect(started.player.facing).toEqual(vec(-1, 0));
  });
});

describe('roll during a move', () => {
  it('a roll pressed during an attack recovery is dropped (no buffer, no stamina spent)', () => {
    let current = step(world(), input({ slots: [true, false, false, false] }), FIXED_DT_MS);
    current = step(current, input({ slots: [false, false, false, false] }), FIXED_DT_MS);
    for (let i = 0; i < 200 && current.player.action?.phase !== 'recovery'; i++) current = step(current, input(), FIXED_DT_MS);
    expect(current.player.action?.phase).toBe('recovery');
    const stamina = current.player.stamina;
    const pressed = step(current, input({ move: vec(-1, 0), roll: true }), FIXED_DT_MS);
    expect(pressed.player.roll).toBeNull();
    expect(pressed.events).not.toContainEqual({ type: 'rollStarted' });
    expect(pressed.player.stamina).toBeGreaterThanOrEqual(stamina);
  });
});

/** A dormant enemy at `pos`, locked on. */
function lockOn(state: WorldState, pos: Vec2): WorldState {
  const spawned = spawnEnemy(state, 'poochyena', pos, { dormant: true });
  const id = spawned.enemies[spawned.enemies.length - 1]!.id;
  return { ...spawned, lock: { ...spawned.lock, targetId: id } };
}
