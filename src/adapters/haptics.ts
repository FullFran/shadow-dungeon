import type { GameEvent } from '../core/state';

/** Vibration lengths: short pulses only (docs/gdd.md, touch controls). */
export const HAPTICS = { hurtMs: 40, perfectDodgeMs: 15 } as const;

const HURT = new Set<GameEvent['type']>(['playerHurt', 'disguiseBroken', 'collapseHurt']);

/** The pulse for one step's events: a hit taken wins over a perfect dodge; null for none. */
export function hapticPulse(events: readonly GameEvent[]): number | null {
  if (events.some((e) => HURT.has(e.type))) return HAPTICS.hurtMs;
  if (events.some((e) => e.type === 'perfectDodge')) return HAPTICS.perfectDodgeMs;
  return null;
}

/** `navigator.vibrate`, guarded (missing on iOS and desktop, may throw when blocked). */
export function vibrate(ms: number): void {
  try {
    (globalThis.navigator as { vibrate?: (pattern: number) => boolean } | undefined)?.vibrate?.(ms);
  } catch {
    // No vibration: nothing to do.
  }
}
