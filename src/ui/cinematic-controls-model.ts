import type { LastDevice } from '../adapters/last-device';

/**
 * The cinematic controls' rules (.agents/DESIGN.md §4 Cinematic controls), pure:
 * how long the Skip button is held, how its ring fills, when the controls
 * rest and which key glyph the device gets. The DOM is cinematic-controls.ts.
 */
export const CONTROLS = {
  /** The Skip button is held this long (a click would skip a scene by accident; the keys keep `SKIP.holdMs`). */
  buttonHoldMs: 600,
  /** After this long without any input the controls fall back to their quiet state. */
  idleMs: 2000,
  /** Reduced motion shows the ring filling in this many whole steps. */
  ringSteps: 8,
  /** Opacity of the controls at rest (60-70%: seen, never loud over the picture). */
  restOpacity: 0.65,
} as const;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/** Progress (0..1) of the Skip button held since `pressedAtMs` (null when not held); 1 skips. */
export function buttonHoldProgress(pressedAtMs: number | null, nowMs: number): number {
  if (pressedAtMs === null) return 0;
  return clamp01((nowMs - pressedAtMs) / CONTROLS.buttonHoldMs);
}

/** How much of the ring is drawn: the exact progress, or (reduced motion) the next whole step up. */
export function ringFill(progress: number, reduced: boolean): number {
  const p = clamp01(progress);
  return reduced ? Math.max(0, Math.ceil(p * CONTROLS.ringSteps - 1e-9)) / CONTROLS.ringSteps : p;
}

export interface Wake {
  /** Any input: the controls show in full. */
  wake(nowMs: number): void;
  awake(nowMs: number): boolean;
}

export function createWake(): Wake {
  let last = Number.NEGATIVE_INFINITY;
  return {
    wake: (nowMs) => void (last = nowMs),
    awake: (nowMs) => nowMs - last < CONTROLS.idleMs,
  };
}

/** What the Skip button shows next to its label: Esc, the pad's B, or "hold" on touch. */
export const skipKeyGlyph = (device: LastDevice): 'esc' | 'pad' | 'hold' => (device === 'gamepad' ? 'pad' : device === 'touch' ? 'hold' : 'esc');
