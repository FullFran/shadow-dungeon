import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hiddenSteps, MAX_HIDDEN_STEPS, stepsWhileHidden } from '../../src/app/hidden-host';
import { FIXED_DT_MS } from '../../src/core/timestep';

// Issue #50 item 4: "A fainted host that hides the tab freezes the run for everyone (the loop runs on requestAnimationFrame)."
describe('who keeps stepping with the tab hidden', () => {
  it('the host of a shared run keeps stepping (its world is everyone\'s)', () => {
    expect(stepsWhileHidden({ role: 'host', ended: false })).toBe(true);
  });

  it('a solo run still pauses when hidden', () => {
    expect(stepsWhileHidden({ role: null, ended: false })).toBe(false);
  });

  it('a guest does not: it only follows the host', () => {
    expect(stepsWhileHidden({ role: 'guest', ended: false })).toBe(false);
  });

  it('an ended run has nothing to step', () => {
    expect(stepsWhileHidden({ role: 'host', ended: true })).toBe(false);
  });
});

describe('fixed steps for a gap between hidden-tab timer ticks', () => {
  it('a throttled 1 s tick runs a whole second of fixed steps, keeping the remainder', () => {
    const r = hiddenSteps(0, 1000 + FIXED_DT_MS / 2);
    expect(r.steps).toBe(Math.floor((1000 + FIXED_DT_MS / 2) / FIXED_DT_MS));
    expect(r.accumulatorMs).toBeCloseTo(1000 + FIXED_DT_MS / 2 - r.steps * FIXED_DT_MS);
    expect(r.droppedMs).toBe(0);
  });

  it('the remainder carries over to the next tick', () => {
    const r = hiddenSteps(FIXED_DT_MS * 0.75, FIXED_DT_MS * 0.5);
    expect(r.steps).toBe(1);
    expect(r.accumulatorMs).toBeCloseTo(FIXED_DT_MS * 0.25);
  });

  it('a long gap (intensive throttling, a suspended laptop) is capped and its backlog dropped', () => {
    const r = hiddenSteps(0, 60_000);
    expect(r.steps).toBe(MAX_HIDDEN_STEPS);
    expect(r.accumulatorMs).toBe(0);
    expect(r.droppedMs).toBeCloseTo(60_000 - MAX_HIDDEN_STEPS * FIXED_DT_MS);
  });

  it('the cap covers a jittery 1 Hz tick without losing time', () => {
    expect(MAX_HIDDEN_STEPS * FIXED_DT_MS).toBeGreaterThanOrEqual(1250);
  });

  it('a clock going backwards steps nothing', () => {
    expect(hiddenSteps(0, -50)).toEqual({ steps: 0, accumulatorMs: 0, droppedMs: 0 });
  });
});

describe('game loop wiring (src/app/game.ts)', () => {
  const GAME = readFileSync(join(__dirname, '../../src/app/game.ts'), 'utf8');

  it('hiding the tab starts the timer for a host that keeps stepping; showing it stops the timer', () => {
    expect(GAME).toMatch(/const onHidden = \(\) => \{[\s\S]*?stepsWhileHidden\(\{ role: net\?\.role \?\? null, ended \}\)\) startHiddenTicks\(\);[\s\S]*?\} else stopHiddenTicks\(\);/);
  });

  it('each tick runs hiddenSteps fixed steps through the normal simulation, and the frame loop does not step on top of it', () => {
    expect(GAME).toMatch(/function hiddenTick\(\)[\s\S]*?hiddenSteps\(hiddenAccumulator, elapsed\)[\s\S]*?simulate\(0, clock\.steps\)/);
    expect(GAME).toMatch(/function frame\(now: number\): void \{\s*\/\/[^\n]*\n\s*if \(hiddenTimer !== null\)/);
  });

  it('the timer is cleared when the run is torn down', () => {
    expect(GAME).toMatch(/cancelAnimationFrame\(raf\);\s*stopHiddenTicks\(\);/);
  });
});
