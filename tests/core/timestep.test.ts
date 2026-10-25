import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { advanceClock, FIXED_DT_MS } from '../../src/core/timestep';

describe('fixed timestep clock', () => {
  it('runs at 60 Hz', () => {
    expect(FIXED_DT_MS).toBeCloseTo(1000 / 60);
  });

  it('turns frame time into whole steps and keeps the remainder', () => {
    const clock = advanceClock(0, 40);
    expect(clock.steps).toBe(2);
    expect(clock.accumulatorMs).toBeCloseTo(40 - 2 * FIXED_DT_MS);
    expect(advanceClock(clock.accumulatorMs, 12).steps).toBe(1);
  });

  it('caps the steps of a long frame and drops the backlog', () => {
    const clock = advanceClock(0, 2000);
    expect(clock.steps).toBe(TUNING.maxStepsPerFrame);
    expect(clock.accumulatorMs).toBe(0);
  });
});
