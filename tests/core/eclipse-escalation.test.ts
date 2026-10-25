import { describe, expect, it } from 'vitest';
import { echoEncounter, echoKnobs, echoTitle, escalatedEcho, romanNumeral, ECHO_ESCALATION } from '../../src/core/eclipse-escalation';
import { laneXs, maxGapDegrees, ringDirections, spiralDirections } from '../../src/core/eclipse-echo';
import { startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { ECLIPSE_ECHO } from '../../src/data/enemies';
import { HERALD_FAIRNESS } from '../../src/data/herald';
import { TUNING } from '../../src/data/tuning';
import { IDLE } from './helpers';

const DEF = ECLIPSE_ECHO;
const needed = 2 * (TUNING.player.radius + DEF.shot.radius) + 10;
const arcAt = (degrees: number, radius: number) => (degrees * Math.PI * radius) / 180;

/** When the Echo announces its first `n` cards on `floor` (ms of play). */
function announces(floor: number, n: number): number[] {
  let w: WorldState = startRun(7, {}, floor, 'eclipse-chasm').world;
  const at: number[] = [];
  for (let t = 0; t < 60_000 && at.length < n; t += FIXED_DT_MS) {
    w = { ...step(w, IDLE, FIXED_DT_MS), player: { ...w.player, hp: 1e9, maxHp: 1e9 } };
    w = { ...w, player: { ...w.player, pos: vec(40, w.arena.height - 40) } };
    if (w.events.some((e: GameEvent) => e.type === 'bossStance')) at.push(t);
  }
  return at;
}

describe('Eclipse Echo: stronger every encounter', () => {
  it('counts encounters (10, 20, 30...) and titles them «Eco del Eclipse · III»', () => {
    expect([10, 19, 20, 30, 60].map(echoEncounter)).toEqual([1, 1, 2, 3, 6]);
    expect(echoTitle('Eco del Eclipse', 10)).toBe('Eco del Eclipse');
    expect(echoTitle('Eco del Eclipse', 30)).toBe('Eco del Eclipse · III');
    expect(echoTitle('Eclipse Echo', 90)).toBe('Eclipse Echo · IX');
    expect([1, 4, 9, 14, 40].map(romanNumeral)).toEqual(['I', 'IV', 'IX', 'XIV', 'XL']);
  });

  it('the first encounter is the Echo as written; later ones are denser (capped at x1.3) and rest less (floored)', () => {
    expect(escalatedEcho(DEF, 10)).toBe(DEF);
    const second = escalatedEcho(DEF, 20);
    expect(second.ring.count).toBeGreaterThan(DEF.ring.count);
    expect(second.restMs).toBeLessThan(DEF.restMs);
    const deep = escalatedEcho(DEF, 300);
    expect(echoKnobs(50).density).toBe(ECHO_ESCALATION.maxDensity);
    expect(ECHO_ESCALATION.maxDensity).toBeLessThanOrEqual(HERALD_FAIRNESS.knobLimit);
    expect(deep.ring.count).toBeLessThanOrEqual(Math.round(DEF.ring.count * HERALD_FAIRNESS.knobLimit));
    expect(deep.restMs).toBe(Math.round(DEF.restMs * ECHO_ESCALATION.minRest));
    expect(deep.recoverMs).toBe(Math.round(DEF.recoverMs * ECHO_ESCALATION.minRecover));
    // Speed and the cap never change; the positional cards keep their shape.
    expect(deep.shot).toEqual(DEF.shot);
    expect(deep.lanes.speed).toBe(DEF.lanes.speed);
    expect(deep.maxShots).toBe(DEF.maxShots);
    expect(deep.corona).toEqual(DEF.corona);
    expect(deep.noose).toEqual(DEF.noose);
  });

  it('every escalated volley still leaves its way through (same checks as the base Echo)', () => {
    for (const floor of [20, 40, 60, 300]) {
      const e = escalatedEcho(DEF, floor);
      for (let wave = 0; wave < e.ring.waves; wave++) expect(arcAt(maxGapDegrees(ringDirections(e.ring, vec(0, 1), wave)), 90)).toBeGreaterThan(needed);
      expect((e.ring.turn * 360) / e.ring.count).toBeLessThanOrEqual(45);
      for (let k = 0; k < e.spiral.emissions; k++) expect(maxGapDegrees(spiralDirections(e.spiral, vec(0, 1), k))).toBeGreaterThanOrEqual(60);
      expect(e.lanes.gapWidth).toBe(DEF.lanes.gapWidth);
      expect(e.lanes.spacing).toBeGreaterThanOrEqual(ECHO_ESCALATION.minLaneSpacing);
      const xs = laneXs(e.lanes, 640, 320);
      expect(xs.filter((x) => Math.abs(x - 320) < e.lanes.gapWidth / 2)).toEqual([]);
    }
  });

  it('in the fight its cards follow each other faster on a later encounter', { timeout: 60_000 }, () => {
    const first = announces(10, 2);
    const third = announces(30, 2);
    expect(first).toHaveLength(2);
    expect(third).toHaveLength(2);
    expect(third[1]! - third[0]!).toBeLessThan(first[1]! - first[0]!);
  });
});
