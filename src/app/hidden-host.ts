import { FIXED_DT_MS } from '../core/timestep';

/**
 * Issue #50 item 4: the host is authoritative, and its loop runs on
 * requestAnimationFrame, which browsers stop in a hidden tab. A host that hid
 * the tab (typically fainted, watching something else) froze the run for
 * everyone. While hidden, the host keeps stepping from a timer, without
 * rendering. Solo runs still pause (app/pause-on-leave.ts), and a guest does
 * not need to: the host's world is the one that counts.
 */
export function stepsWhileHidden(peer: { role: 'host' | 'guest' | null; ended: boolean }): boolean {
  return peer.role === 'host' && !peer.ended;
}

/**
 * Most fixed steps one hidden-tab timer tick runs: 1.5 s of game time. Browsers
 * throttle timers in a hidden tab to about once per second (Chrome, Firefox,
 * Safari), so a tick covers about 60 steps and the cap leaves room for jitter.
 * Longer gaps (Chrome's intensive throttling after 5 minutes hidden, about once
 * per minute; a suspended machine) drop their backlog instead of fast-forwarding
 * a minute of combat in one go: the run goes slower for everyone, and guests
 * see it stutter, but it does not freeze.
 */
export const MAX_HIDDEN_STEPS = Math.ceil(1500 / FIXED_DT_MS);

/** Whole fixed steps for the time since the last hidden tick; the remainder carries over, a backlog past the cap is dropped. */
export function hiddenSteps(accumulatorMs: number, elapsedMs: number): { steps: number; accumulatorMs: number; droppedMs: number } {
  const total = Math.max(0, accumulatorMs) + Math.max(0, elapsedMs);
  const steps = Math.floor(total / FIXED_DT_MS);
  if (steps > MAX_HIDDEN_STEPS) return { steps: MAX_HIDDEN_STEPS, accumulatorMs: 0, droppedMs: total - MAX_HIDDEN_STEPS * FIXED_DT_MS };
  return { steps, accumulatorMs: total - steps * FIXED_DT_MS, droppedMs: 0 };
}
