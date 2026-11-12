import { describe, expect, it } from 'vitest';
import { familiarPoints, firePattern, laserFiring, patternAttackMs, patternParts, waveDirections } from '../../src/core/danmaku';
import type { WorldState } from '../../src/core/state';
import { angleOf, distance, dot, length, normalize, sub, vec, type Vec2 } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import type { DanmakuPattern, DanmakuShot } from '../../src/data/enemies';
import { world } from './helpers';

/**
 * The herald primitives ported to every card boss (docs/research/boss-patterns.md
 * E1: wave, closing, scatter, homing, laser) and the orbiting familiars (E3),
 * as `DanmakuPattern` kinds fired by core/danmaku.ts `firePattern`.
 */
const SHOT: DanmakuShot = { power: 10, type: 'ghost', speed: 100, radius: 5, lifetimeMs: 5000 };
const DEG = Math.PI / 180;

function bossAt(aim: Vec2, mark?: Vec2): WorldState {
  const state = spawnEnemy(world(vec(400, 500)), 'aegislash', vec(400, 200));
  const enemy = state.enemies[0]!;
  return { ...state, enemies: [{ ...enemy, ai: { ...enemy.ai, attackDir: aim, ...(mark ? { aimPoint: mark } : {}) } }] };
}

const fired = (state: WorldState, p: DanmakuPattern, index: number, target?: Vec2) => {
  const after = firePattern(state, state.enemies[0]!, 200, p, index, 1, target);
  return after.projectiles.slice(state.projectiles.length);
};

const deg = (v: Vec2): number => angleOf(v) / DEG;

describe('wave: arms that swing instead of turning (F21)', () => {
  const p: DanmakuPattern = { kind: 'wave', arms: 2, everyMs: 100, durationMs: 2000, amplitudeDeg: 30, periodMs: 1000, shot: SHOT };

  it('swings each arm on a sine around the aim', () => {
    expect(waveDirections(vec(1, 0), p, 0).map(deg)).toEqual([expect.closeTo(0, 6), expect.closeTo(180, 6)]);
    // A quarter period in (part 1 of a wave every 250 ms): the full swing.
    expect(deg(waveDirections(vec(1, 0), { ...p, everyMs: 250 }, 1)[0]!)).toBeCloseTo(30, 6);
  });

  it('mirror adds the opposite swing; parts span the duration', () => {
    expect(waveDirections(vec(1, 0), { ...p, mirror: true }, 1)).toHaveLength(4);
    expect(patternParts(p)).toEqual({ count: 20, every: 100 });
    expect(fired(bossAt(vec(0, 1)), p, 0)).toHaveLength(2);
  });
});

describe('closing: a ring that closes in on where the target stood (F17)', () => {
  const p: DanmakuPattern = { kind: 'closing', rings: 2, gapMs: 900, perRing: 16, gap: 4, radius: 150, gapTurnDeg: 30, shot: SHOT };
  const mark = vec(400, 400);

  it('spawns on a circle round the mark, every shot heading inwards, the gap on the side away from the boss', () => {
    const shots = fired(bossAt(vec(0, 1), mark), p, 0);
    expect(shots).toHaveLength(12);
    for (const s of shots) {
      expect(distance(s.pos, mark)).toBeCloseTo(150, 3);
      expect(dot(normalize(s.vel), normalize(sub(mark, s.pos)))).toBeCloseTo(1, 6);
    }
    // Nothing straight below the mark (away from the boss above it).
    expect(shots.some((s) => Math.abs(s.pos.x - 400) < 20 && s.pos.y > 400)).toBe(false);
    expect(patternAttackMs(p)).toBe(1800);
  });

  it('skips the slots outside the arena', () => {
    const shots = fired(bossAt(vec(0, 1), vec(400, 560)), p, 0);
    expect(shots.every((s) => s.pos.y <= 600)).toBe(true);
    expect(shots.length).toBeLessThan(12);
  });
});

describe('scatter: seeded spread inside a cone (F20)', () => {
  const p: DanmakuPattern = { kind: 'scatter', bursts: 3, gapMs: 400, count: 7, coneDeg: 60, salt: 11, aim: 'first', shot: SHOT };

  it('throws `count` shots inside the cone, the same on every peer', () => {
    const a = fired(bossAt(vec(1, 0)), p, 1);
    const b = fired(bossAt(vec(1, 0)), p, 1);
    expect(a).toHaveLength(7);
    expect(a.map((s) => s.vel)).toEqual(b.map((s) => s.vel));
    for (const s of a) expect(Math.abs(deg(s.vel))).toBeLessThanOrEqual(30);
    expect(fired(bossAt(vec(1, 0)), p, 2).map((s) => s.vel)).not.toEqual(a.map((s) => s.vel));
  });
});

describe('homing: slow orbs that bend towards the player for a while (F13)', () => {
  it('fires `orbs` shots fanned at the target, each with its steering', () => {
    const steer = { degPerSec: 70, ms: 2000 };
    const p: DanmakuPattern = { kind: 'homing', volleys: 2, gapMs: 1200, orbs: 2, spreadDeg: 60, shot: { ...SHOT, steer } };
    const shots = fired(bossAt(vec(0, 1)), p, 0, vec(400, 500));
    expect(shots).toHaveLength(2);
    expect(shots.every((s) => s.steer?.degPerSec === 70)).toBe(true);
    expect(deg(shots[0]!.vel)).toBeCloseTo(60, 3);
    expect(deg(shots[1]!.vel)).toBeCloseTo(120, 3);
  });
});

describe('laser: warned lines of fast shots (F7, owner option 4a)', () => {
  const p: DanmakuPattern = { kind: 'laser', volleys: 2, everyMs: 1500, lines: 3, fanDeg: 40, turnDeg: 15, warnMs: 600, fireMs: 400, beamEveryMs: 50, shot: { ...SHOT, speed: 420, radius: 4 } };

  it('fires nothing during the warning, then a shot per line every beat of the fire window', () => {
    expect(laserFiring(p, 0)).toBeNull();
    expect(laserFiring(p, 11)).toBeNull();
    expect(laserFiring(p, 12)).toBe(0);
    expect(laserFiring(p, 19)).toBe(0);
    expect(laserFiring(p, 20)).toBeNull();
    expect(laserFiring(p, 42)).toBe(1);
    expect(fired(bossAt(vec(1, 0)), p, 5)).toHaveLength(0);
    expect(fired(bossAt(vec(1, 0)), p, 12)).toHaveLength(3);
    expect(patternAttackMs(p)).toBe(3000);
  });

  it('fans its lines round the aim and turns them each volley', () => {
    expect(fired(bossAt(vec(1, 0)), p, 12).map((s) => deg(s.vel))).toEqual([expect.closeTo(-20, 3), expect.closeTo(0, 3), expect.closeTo(20, 3)]);
    expect(fired(bossAt(vec(1, 0)), p, 42).map((s) => deg(s.vel))).toEqual([expect.closeTo(-5, 3), expect.closeTo(15, 3), expect.closeTo(35, 3)]);
  });
});

describe('familiars: emitters orbiting the boss or the arena (E3, F14)', () => {
  const p: DanmakuPattern = { kind: 'familiars', count: 2, radius: 90, degPerSec: 45, centre: 'boss', atOnce: 2, volleys: 4, gapMs: 1000, perVolley: 3, spreadDeg: 30, aim: 'out', shot: SHOT };

  it('places them evenly on their circle and turns them with time', () => {
    const at0 = familiarPoints(p, vec(400, 200), vec(1, 0), { width: 800, height: 600 }, 0);
    expect(at0.map((q) => [Math.round(q.x), Math.round(q.y)])).toEqual([[490, 200], [310, 200]]);
    const at2 = familiarPoints(p, vec(400, 200), vec(1, 0), { width: 800, height: 600 }, 2000);
    expect(at2[0]!.x).toBeCloseTo(400, 3);
    expect(at2[0]!.y).toBeCloseTo(290, 3);
  });

  it('`out` fires a static fan away from the centre; `target` aims at the target', () => {
    const out = fired(bossAt(vec(1, 0)), p, 0);
    expect(out).toHaveLength(6);
    expect(out.slice(0, 3).every((s) => s.vel.x > 0)).toBe(true);
    const aimed = fired(bossAt(vec(1, 0)), { ...p, aim: 'target', atOnce: 1, perVolley: 1, spreadDeg: 0 }, 0, vec(490, 500));
    expect(aimed).toHaveLength(1);
    expect(deg(aimed[0]!.vel)).toBeCloseTo(90, 1);
  });

  it('centre `arena` orbits the middle of the room', () => {
    const at0 = familiarPoints({ ...p, centre: 'arena' }, vec(100, 100), vec(0, 1), { width: 800, height: 600 }, 0);
    expect(at0[0]!.x).toBeCloseTo(400, 3);
    expect(at0[0]!.y).toBeCloseTo(390, 3);
  });
});

describe('kinematics per part (core/kinematics.ts)', () => {
  it('a curveAlternate shot turns the other way on odd parts', () => {
    const p: DanmakuPattern = { kind: 'fan', fans: 2, perFan: 1, spreadDeg: 0, gapMs: 300, aim: 'first', shot: { ...SHOT, kin: { curveDegPerSec: 25, curveAlternate: true } } };
    expect(fired(bossAt(vec(1, 0)), p, 0)[0]!.kin?.curve).toBe(25);
    expect(fired(bossAt(vec(1, 0)), p, 1)[0]!.kin?.curve).toBe(-25);
  });

  it('accel follows each shot’s own heading', () => {
    const p: DanmakuPattern = { kind: 'rings', rings: 1, perRing: 4, gap: 0, gapTurnDeg: 0, gapMs: 300, shot: { ...SHOT, kin: { accel: -50 } } };
    for (const s of fired(bossAt(vec(1, 0)), p, 0)) expect(dot(normalize(s.kin!.acc), normalize(s.vel))).toBeCloseTo(-1, 6);
    expect(length(fired(bossAt(vec(1, 0)), p, 0)[0]!.kin!.acc)).toBeCloseTo(50, 6);
  });
});
