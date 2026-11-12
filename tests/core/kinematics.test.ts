import { describe, expect, it } from 'vitest';
import { bounceOff, driveShot, kinAtSpawn, kinFor } from '../../src/core/kinematics';
import { length, vec, type Vec2 } from '../../src/core/vec';
import { spawnShot } from '../../src/core/brain';
import type { ProjectileState } from '../../src/core/state';
import { spawnEnemy } from '../../src/core/world';
import { IDLE, run as runWorld, ticksFor, world } from './helpers';

/** Steps a velocity `n` times by `ms` (the fixed timestep), the way combat.ts does. */
function run(vel: Vec2, kin: NonNullable<ReturnType<typeof kinAtSpawn>>, ms: number, n: number) {
  let v = vel;
  let k = kin;
  let travelled = vec(0, 0);
  for (let i = 0; i < n; i++) {
    const out = driveShot(v, k, ms);
    v = out.vel;
    k = out.kin;
    travelled = vec(travelled.x + (v.x * ms) / 1000, travelled.y + (v.y * ms) / 1000);
  }
  return { vel: v, kin: k, travelled };
}

describe('shot kinematics (E2/E4, docs/research/boss-patterns.md)', () => {
  it('a shot without kinematics keeps none', () => {
    expect(kinAtSpawn(undefined, vec(1, 0))).toBeUndefined();
    expect(kinAtSpawn({}, vec(1, 0))).toBeUndefined();
  });

  it('accel speeds a shot up along its launch heading, never past maxSpeed', () => {
    const kin = kinAtSpawn({ accel: 200, maxSpeed: 180 }, vec(1, 0))!;
    const out = run(vec(60, 0), kin, 1000 / 60, 120);
    expect(out.vel.y).toBeCloseTo(0, 6);
    expect(length(out.vel)).toBeCloseTo(180, 6);
  });

  it('negative accel slows a shot, turns it round and brings it back (backflow)', () => {
    const kin = kinAtSpawn({ accel: -100 }, vec(0, 1))!;
    const out = run(vec(0, 100), kin, 1000 / 60, 60);
    // After 1 s: speed 0 at the far point (50 px out).
    expect(out.vel.y).toBeCloseTo(0, 6);
    expect(out.travelled.y).toBeGreaterThan(48);
    const back = run(out.vel, out.kin, 1000 / 60, 60);
    expect(back.vel.y).toBeLessThan(-99);
  });

  it('stop: a decelerating shot halts and hangs instead of coming back', () => {
    const kin = kinAtSpawn({ accel: -100, stop: true }, vec(1, 0))!;
    const out = run(vec(100, 0), kin, 1000 / 60, 90);
    expect(length(out.vel)).toBe(0);
    const later = run(out.vel, out.kin, 1000 / 60, 60);
    expect(length(later.vel)).toBe(0);
  });

  it('curve turns the velocity at a constant rate, keeping its speed', () => {
    const kin = kinAtSpawn({ curveDegPerSec: 90 }, vec(1, 0))!;
    const out = run(vec(120, 0), kin, 1000 / 60, 60);
    expect(length(out.vel)).toBeCloseTo(120, 6);
    expect(out.vel.x).toBeCloseTo(0, 6);
    expect(out.vel.y).toBeCloseTo(120, 6);
  });

  it('gravity is a world vector, whatever the heading (an arc)', () => {
    const kin = kinAtSpawn({ gravity: vec(0, -120) }, vec(1, 0))!;
    const out = run(vec(100, 0), kin, 1000 / 60, 60);
    expect(out.vel.x).toBeCloseTo(100, 6);
    expect(out.vel.y).toBeCloseTo(-120, 6);
  });

  it('kinFor flips the curve of every other part when curveAlternate is set', () => {
    const def = { curveDegPerSec: 30, curveAlternate: true as const };
    expect(kinFor(def, 0)?.curveDegPerSec).toBe(30);
    expect(kinFor(def, 1)?.curveDegPerSec).toBe(-30);
    expect(kinFor(def, 2)?.curveDegPerSec).toBe(30);
    expect(kinFor({ curveDegPerSec: 30 }, 1)?.curveDegPerSec).toBe(30);
  });

  it('is deterministic: the same inputs give the same outputs bit for bit', () => {
    const kin = kinAtSpawn({ accel: 37, curveDegPerSec: -23, gravity: vec(3, 7), maxSpeed: 210 }, vec(0.6, 0.8))!;
    const a = run(vec(60, 80), kin, 1000 / 60, 200);
    const b = run(vec(60, 80), kin, 1000 / 60, 200);
    expect(a).toEqual(b);
  });
});

describe('bounce off the arena edge (E4)', () => {
  const box = (p: Vec2) => p.x < 0 || p.y < 0 || p.x > 100 || p.y > 100;

  it('reflects the velocity component that hit the edge and stays inside', () => {
    const out = bounceOff(vec(98, 50), vec(102, 52), vec(240, 120), box)!;
    expect(out.vel).toEqual(vec(-240, 120));
    expect(box(out.pos)).toBe(false);
  });

  it('reflects both components in a corner', () => {
    const out = bounceOff(vec(99, 99), vec(101, 101), vec(60, 60), box)!;
    expect(out.vel).toEqual(vec(-60, -60));
  });

  it('cannot bounce out of a solid start (null: the shot dies)', () => {
    expect(bounceOff(vec(120, 50), vec(125, 50), vec(60, 0), box)).toBeNull();
  });
});

describe('kinematic shots in the world (core/combat.ts, core/brain.ts)', () => {
  const shotAt = (pos: Vec2, vel: Vec2, kin: NonNullable<ReturnType<typeof kinAtSpawn>>): ProjectileState => ({
    id: 'k1',
    owner: 'enemy',
    type: 'steel',
    attackerTypes: ['steel'],
    power: 10,
    damageMultiplier: 1,
    pos,
    vel,
    radius: 5,
    remainingMs: 5000,
    hitstunMs: 0,
    knockback: 0,
    hitIds: [],
    kin,
  });

  it('spawnShot carries a DanmakuShot kin into the projectile', () => {
    let state = spawnEnemy(world(vec(100, 100)), 'aegislash', vec(400, 300));
    const enemy = state.enemies[0]!;
    state = spawnShot(state, enemy, { power: 10, type: 'steel', speed: 100, radius: 5, lifetimeMs: 4000, kin: { curveDegPerSec: 45, bounces: 1 } }, vec(1, 0));
    const shot = state.projectiles.at(-1)!;
    expect(shot.kin).toEqual({ acc: vec(0, 0), curve: 45, max: 0, bounces: 1 });
  });

  it('a curving shot turns as the world steps', () => {
    const state = { ...world(vec(100, 500)), projectiles: [shotAt(vec(400, 100), vec(120, 0), kinAtSpawn({ curveDegPerSec: 90 }, vec(1, 0))!)] };
    const after = runWorld(state, IDLE, ticksFor(1000)).projectiles.find((p) => p.id === 'k1')!;
    expect(after.vel.x).toBeCloseTo(0, 3);
    expect(after.vel.y).toBeCloseTo(120, 3);
  });

  it('a bouncing shot reflects off the arena edge once, then dies there', () => {
    const state = { ...world(vec(100, 500)), projectiles: [shotAt(vec(790, 100), vec(300, 0), kinAtSpawn({ bounces: 1 }, vec(1, 0))!)] };
    const once = runWorld(state, IDLE, ticksFor(200)).projectiles.find((p) => p.id === 'k1')!;
    expect(once.vel.x).toBe(-300);
    expect(once.kin?.bounces).toBe(0);
    const back = { ...state, projectiles: [shotAt(vec(10, 100), vec(-300, 0), once.kin!)] };
    expect(runWorld(back, IDLE, ticksFor(200)).projectiles.some((p) => p.id === 'k1')).toBe(false);
  });

  it('cover still stops a bouncing shot', () => {
    const base = world(vec(100, 500));
    const state = { ...base, arena: { ...base.arena, obstacles: [{ x: 500, y: 80, width: 40, height: 40, cover: true }] }, projectiles: [shotAt(vec(480, 100), vec(300, 0), kinAtSpawn({ bounces: 1 }, vec(1, 0))!)] };
    expect(runWorld(state, IDLE, ticksFor(200)).projectiles.some((p) => p.id === 'k1')).toBe(false);
  });
});
