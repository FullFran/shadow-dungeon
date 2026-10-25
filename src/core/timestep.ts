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

/** Longest frame fed to the simulation clock (a tab coming back from the background). */
export const MAX_FRAME_MS = 250;

/**
 * Game time one animation frame contributes: none while paused. The real clock
 * is tracked every frame, paused or not, so resuming never feeds the paused span
 * to the accumulator (no catch-up burst).
 */
export function frameTime(lastFrameMs: number, nowMs: number, paused: boolean): { frameMs: number; lastFrameMs: number } {
  const frameMs = paused ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, nowMs - lastFrameMs));
  return { frameMs, lastFrameMs: nowMs };
}
