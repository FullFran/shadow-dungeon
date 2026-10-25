import { TUNING } from '../data/tuning';

/** Duration of one simulation step. */
export const FIXED_DT_MS = 1000 / TUNING.ticksPerSecond;

export interface Clock {
  steps: number;
  accumulatorMs: number;
}

/**
 * Classic fixed-timestep accumulator: converts elapsed frame time into a
 * whole number of simulation steps. Long frames (tab in background, debugger)
 * are capped and their backlog dropped instead of fast-forwarding.
 */
export function advanceClock(accumulatorMs: number, frameMs: number): Clock {
  const total = accumulatorMs + Math.max(0, frameMs);
  const steps = Math.floor(total / FIXED_DT_MS);
  if (steps > TUNING.maxStepsPerFrame) return { steps: TUNING.maxStepsPerFrame, accumulatorMs: 0 };
  return { steps, accumulatorMs: total - steps * FIXED_DT_MS };
}
