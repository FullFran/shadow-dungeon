import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { advanceClock, FIXED_DT_MS, frameTime, MAX_FRAME_MS } from '../../src/core/timestep';

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

  it('caps a long frame and ignores clocks going backwards', () => {
    expect(frameTime(0, 5000, false)).toEqual({ frameMs: MAX_FRAME_MS, lastFrameMs: 5000 });
    expect(frameTime(100, 50, false).frameMs).toBe(0);
  });
});

describe('pause', () => {
  it('gives no game time while paused, so the accumulator never advances', () => {
    let last = 0;
    let accumulator = 5;
    for (let now = 16; now <= 3000; now += 16) {
      const frame = frameTime(last, now, true);
      last = frame.lastFrameMs;
      expect(frame.frameMs).toBe(0);
      const clock = advanceClock(accumulator, frame.frameMs);
      expect(clock.steps).toBe(0);
      accumulator = clock.accumulatorMs;
    }
    expect(accumulator).toBe(5);
  });

  it('does not catch up the paused time on resume', () => {
    let last = 0;
    for (let now = 16; now <= 3000; now += 16) last = frameTime(last, now, true).lastFrameMs;
    const resumed = frameTime(last, last + 16, false);
    expect(resumed.frameMs).toBe(16);
    expect(advanceClock(0, resumed.frameMs).steps).toBe(0);
    expect(advanceClock(5, resumed.frameMs).steps).toBe(1);
  });
});
