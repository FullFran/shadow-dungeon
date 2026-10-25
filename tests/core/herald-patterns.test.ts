import { describe, expect, it } from 'vitest';
import { HERALD_ARENA, HERALD_FAIRNESS, type HeraldCard, type HeraldLayer, type HeraldShot } from '../../src/data/herald';
import { TUNING } from '../../src/data/tuning';
import { checkCard, type FairnessEnv } from '../../src/core/herald/fairness';
import { aimedThreat, asksChoice, cardAttackMs, emitBetween, emitPart, laneCentre, partTimes, ringSlots, scatterAngles, type EmitContext } from '../../src/core/herald/patterns';
import { vec } from '../../src/core/vec';

const SHOT: HeraldShot = { power: 16, type: 'dark', speed: 95, radius: 6, lifetimeMs: 7000 };
const ARENA = { width: HERALD_ARENA.width, height: HERALD_ARENA.height };
const ORIGIN = vec(320, 110);
const ENV: FairnessEnv = { arena: ARENA, origins: [ORIGIN], bossRadius: 16, tier: 'normal', maxShots: 120 };
const CTX: EmitContext = { origin: ORIGIN, bossRadius: 16, mark: vec(320, 320), arena: ARENA };
const card = (layers: HeraldLayer[], extra: Partial<HeraldCard> = {}) => ({ telegraphMs: 900, layers, density: 1, speed: 1, ...extra });

const ring = (over: Partial<Extract<HeraldLayer, { kind: 'ring' }>> = {}): HeraldLayer => ({ kind: 'ring', startMs: 0, aim: 'aimed', rings: 4, everyMs: 800, perRing: 20, gap: 4, gapTurnDeg: 20, offsetDeg: 0, shot: SHOT, ...over });

describe('pattern grammar: every primitive', () => {
  it('fires its parts at startMs + k * everyMs (lasers after their warning)', () => {
    expect(partTimes(ring({ startMs: 100 }))).toEqual([100, 900, 1700, 2500]);
    const laser: HeraldLayer = { kind: 'laser', startMs: 0, aim: 'aimed', volleys: 2, everyMs: 1500, lines: 3, fanDeg: 60, turnDeg: 20, offsetDeg: 0, warnMs: 600, fireMs: 200, beamEveryMs: 50, shot: { ...SHOT, speed: 480 } };
    expect(partTimes(laser)).toEqual([600, 650, 700, 750, 2100, 2150, 2200, 2250]);
    expect(emitPart(laser, 0, 600, CTX)).toHaveLength(3);
    expect(cardAttackMs({ layers: [laser] })).toBe(2350);
  });

  it('rings leave their gap facing the mark; aimed rings turn with it', () => {
    const shots = emitPart(ring(), 0, 0, CTX);
    expect(shots).toHaveLength(16);
    // No shot within the gap half-width of the aim (straight down).
    const gapHalf = (4 / 2) * (360 / 20);
    for (const s of shots) expect(Math.abs((Math.atan2(s.dir.y, s.dir.x) * 180) / Math.PI - 90)).toBeGreaterThan(gapHalf - 1e-6);
    expect(ringSlots(0, 12, 0)).toHaveLength(12);
  });

  it('spirals (1-4 arms, mirrored), waves, scatter (seeded, stratified), homing, closing rings and lanes', () => {
    for (const arms of [1, 2, 3, 4]) {
      const spiral: HeraldLayer = { kind: 'spiral', startMs: 0, arms, emissions: 10, everyMs: 120, turnDeg: 11, mirror: false, offsetDeg: 0, shot: SHOT };
      expect(emitPart(spiral, 3, 360, CTX)).toHaveLength(arms);
      expect(emitPart({ ...spiral, mirror: true }, 3, 360, CTX)).toHaveLength(arms * 2);
    }
    const wave: HeraldLayer = { kind: 'wave', startMs: 0, aim: 'static', arms: 3, emissions: 20, everyMs: 100, amplitudeDeg: 30, periodMs: 1200, mirror: true, offsetDeg: 0, shot: SHOT };
    expect(emitPart(wave, 0, 0, CTX)).toHaveLength(6);
    const a = scatterAngles(42, 1, 8, 90);
    expect(a).toEqual(scatterAngles(42, 1, 8, 90));
    expect(a).not.toEqual(scatterAngles(42, 2, 8, 90));
    for (const x of a) expect(Math.abs(x)).toBeLessThanOrEqual(45);
    const homing: HeraldLayer = { kind: 'homing', startMs: 0, orbs: 3, everyMs: 1000, volleys: 1, shot: { ...SHOT, speed: 60, steer: { degPerSec: 60, ms: 2500 } } };
    expect(emitPart(homing, 0, 0, CTX)).toHaveLength(3);
    const closing: HeraldLayer = { kind: 'closing', startMs: 0, rings: 2, everyMs: 1000, perRing: 24, gap: 5, radius: 180, gapTurnDeg: 0, shot: SHOT };
    const ringShots = emitPart(closing, 0, 0, CTX);
    expect(ringShots).toHaveLength(19);
    // They move inwards.
    for (const s of ringShots) expect((s.at.x - 320) * s.dir.x + (s.at.y - 200) * s.dir.y).toBeLessThan(0);
    const lanes: HeraldLayer = { kind: 'lanes', startMs: 0, waves: 3, everyMs: 1000, spacing: 30, gapWidth: 90, shiftPx: 100, flip: false, shot: SHOT };
    const wall = emitPart(lanes, 0, 0, CTX);
    // The mark is in the lower half: the wall comes down from the top, its lane around x = 320.
    for (const s of wall) {
      expect(s.dir).toEqual(vec(0, 1));
      expect(Math.abs(s.at.x - 320)).toBeGreaterThan(45);
    }
    expect(laneCentre(640, 320, 90, 100, 1)).toBe(220);
    const flipped = emitPart({ ...lanes, flip: true }, 0, 0, { ...CTX, mark: vec(500, 200) });
    for (const s of flipped) expect(s.dir).toEqual(vec(1, 0));
  });

  it('emitBetween throws each part once over consecutive steps', () => {
    const layer = ring();
    let n = 0;
    for (let t = 0; t < 4000; t += 1000 / 60) n += emitBetween(layer, t - 1000 / 60, t, CTX).length;
    // Part 0 at t = 0 is fired by the wind-up's end (t in (-dt, 0]).
    expect(n).toBe(4 * 16);
  });

  it('classifies aimed threats and choice cards', () => {
    expect(aimedThreat(ring())).toBe(true);
    expect(aimedThreat(ring({ aim: 'static' }))).toBe(false);
    expect(asksChoice(ring())).toBe(true);
    expect(asksChoice({ kind: 'spiral', startMs: 0, arms: 2, emissions: 10, everyMs: 100, turnDeg: 10, mirror: false, offsetDeg: 0, shot: SHOT })).toBe(false);
  });
});

describe('fairness checks (each one able to fail)', () => {
  it('a gapped ring card passes; the same ring with no gap and no room between shots fails the path check', () => {
    const fair = checkCard(card([ring()]), ENV);
    expect(fair.failures).toEqual([]);
    expect(fair.ok).toBe(true);
    expect(fair.peakShots).toBeGreaterThan(0);
    expect(fair.clearMs).toBeGreaterThan(0);
    // A wall of bullets: 90 per ring, no gap, every 150 ms.
    const wall = checkCard(card([ring({ perRing: 90, gap: 0, rings: 12, everyMs: 150, shot: { ...SHOT, radius: 7 } })]), { ...ENV, maxShots: 160 });
    expect(wall.ok).toBe(false);
    expect(wall.failures.join()).toMatch(/no safe path|peak shots/);
  });

  it('lanes need their lane: a lane narrower than the player is rejected', () => {
    const lanes = (gapWidth: number): HeraldLayer => ({ kind: 'lanes', startMs: 0, waves: 3, everyMs: 900, spacing: 22, gapWidth, shiftPx: 60, flip: false, shot: { ...SHOT, speed: 140 } });
    expect(checkCard(card([lanes(96)]), ENV).ok).toBe(true);
    const narrow = checkCard(card([lanes(12)]), ENV);
    expect(narrow.ok).toBe(false);
    expect(narrow.failures.join()).toMatch(/no safe path/);
  });

  it('pockets must be reachable before they burn', () => {
    const pockets = (warnMs: number): HeraldLayer => ({ kind: 'pockets', startMs: 0, pockets: [vec(120, 300), vec(320, 230), vec(520, 300)], radius: 52, warnMs, flashMs: 300, attack: { power: 30, type: 'dark', pierceRoll: true } });
    expect(checkCard(card([pockets(1600)]), ENV).ok).toBe(true);
    expect(checkCard(card([pockets(0)], { telegraphMs: 450 }), ENV).ok).toBe(false);
  });

  it('wind-up floors after the tier: 400 ms for choice cards, 280 ms otherwise', () => {
    expect(checkCard(card([ring()], { telegraphMs: 390 }), { ...ENV, tier: 'easy' }).failures.join()).toMatch(/telegraph/);
    const spiral: HeraldLayer = { kind: 'spiral', startMs: 0, arms: 2, emissions: 20, everyMs: 140, turnDeg: 13, mirror: false, offsetDeg: 0, shot: SHOT };
    expect(checkCard(card([spiral], { telegraphMs: 300 }), { ...ENV, tier: 'easy' }).ok).toBe(true);
    expect(checkCard(card([spiral], { telegraphMs: 270 }), { ...ENV, tier: 'easy' }).failures.join()).toMatch(/telegraph/);
    // Nightmare shortens wind-ups: a 450 ms base drops under 400 there.
    const short = checkCard(card([ring()], { telegraphMs: 450 }), { ...ENV, tier: 'nightmare' });
    expect(short.ok).toBe(false);
  });

  it('caps aimed threats, layers, knobs, homing orbs, tracking streams and the shot cap', () => {
    const aimedStream: HeraldLayer = { kind: 'stream', startMs: 0, aim: 'aimed', bursts: 3, everyMs: 500, perBurst: 3, spreadDeg: 30, shot: SHOT };
    expect(checkCard(card([aimedStream, aimedStream, ring()]), ENV).failures.join()).toMatch(/aimed threats 3/);
    expect(checkCard(card([ring({ aim: 'static' }), ring({ aim: 'static' }), ring({ aim: 'static' }), ring({ aim: 'static' })]), ENV).failures.join()).toMatch(/layers 4/);
    expect(checkCard(card([ring()], { density: 1.31, speed: 1.31 }), ENV).failures.join()).toMatch(/both above/);
    expect(checkCard(card([ring()], { density: 1.7, speed: 1.2 }), ENV).failures.join()).toMatch(/density x speed/);
    expect(HERALD_FAIRNESS.knobLimit).toBe(1.3);
    const fast: HeraldLayer = { kind: 'homing', startMs: 0, orbs: 3, everyMs: 1000, volleys: 1, shot: { ...SHOT, speed: TUNING.player.moveSpeed * 0.7, steer: { degPerSec: 60, ms: 2000 } } };
    expect(checkCard(card([fast]), ENV).failures.join()).toMatch(/too fast/);
    const tracking: HeraldLayer = { kind: 'stream', startMs: 0, aim: 'tracking', bursts: 6, everyMs: 400, perBurst: 3, spreadDeg: 80, shot: { ...SHOT, speed: 260 } };
    expect(checkCard(card([tracking]), ENV).failures.join()).toMatch(/sidestep/);
    const dense = checkCard(card([ring({ aim: 'static', perRing: 40, gap: 8, rings: 6, everyMs: 500, shot: { ...SHOT, speed: 60 } })]), { ...ENV, maxShots: 60 });
    expect(dense.failures.join()).toMatch(/peak shots|no safe path/);
  });
});
