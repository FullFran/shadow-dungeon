/**
 * A dialog or pick that opens while the player is still fighting (a Senda boss's
 * last lines, the item pick right after it falls) must not be answered by the
 * click or key that was already in progress: the text would be dismissed unread
 * (GitHub issue #53). A press counts only once the grace window since the
 * dialog opened is over and only if it follows a quiet gap since the previous
 * press, so a run of attack clicks never confirms but one deliberate press
 * does. Pure: the caller passes the clock.
 */
export const PRESS_GRACE_MS = 900;
export const PRESS_GAP_MS = 350;
/** Later lines of a dialog the player already answered on purpose wait less. */
export const PRESS_NEXT_GRACE_MS = 250;

export interface PressGuard {
  /** A dialog (or its next line) opened at `nowMs`; presses count after `graceMs`. */
  arm(nowMs: number, graceMs?: number): void;
  /** A press at `nowMs`: true when it is a deliberate confirm. Every press, counted or not, restarts the quiet gap. */
  accept(nowMs: number): boolean;
}

export function pressGuard(gapMs: number = PRESS_GAP_MS, defaultGraceMs: number = PRESS_GRACE_MS): PressGuard {
  let readyAt = 0;
  let lastPressAt = Number.NEGATIVE_INFINITY;
  return {
    arm(nowMs, graceMs = defaultGraceMs) {
      readyAt = nowMs + graceMs;
    },
    accept(nowMs) {
      const counted = nowMs >= readyAt && nowMs - lastPressAt >= gapMs;
      lastPressAt = nowMs;
      return counted;
    },
  };
}
