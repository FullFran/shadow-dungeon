import type { CinematicPanel, Shot } from '../data/prologue';

/**
 * Timing maths of a cinematic (the prologue): which panel is on screen at a
 * moment, how dark it is (fades from and to black), how much of each line of
 * narration is revealed, where the camera is, and the skip rules. Pure
 * functions of time, so the player only feeds it the clock.
 */
export const SKIP = {
  /** The skip button shows, and holding Esc or Enter counts, only after this. */
  availableAfterMs: 1000,
  /** How long Esc or Enter must be held to skip. */
  holdMs: 800,
} as const;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

export function smoothstep(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

export const totalMs = (panels: readonly CinematicPanel[]): number => panels.reduce((sum, p) => sum + p.durationMs, 0);

export function startOf(panels: readonly CinematicPanel[], index: number): number {
  return totalMs(panels.slice(0, index));
}

export interface PanelMoment<P extends CinematicPanel = CinematicPanel> {
  index: number;
  panel: P;
  localMs: number;
}

/** The panel on screen at `ms` from the start, or null once the last one has ended. */
export function panelAt<P extends CinematicPanel>(panels: readonly P[], ms: number): PanelMoment<P> | null {
  let start = 0;
  const at = Math.max(0, ms);
  for (let index = 0; index < panels.length; index++) {
    const panel = panels[index]!;
    if (at < start + panel.durationMs) return { index, panel, localMs: at - start };
    start += panel.durationMs;
  }
  return null;
}

/** How visible the panel is (0 black, 1 fully lit): an eased fade in, a hold, an eased fade out. */
export function panelAlpha(panel: CinematicPanel, localMs: number): number {
  const fadeIn = panel.fadeInMs > 0 ? smoothstep(localMs / panel.fadeInMs) : 1;
  const left = panel.durationMs - localMs;
  const fadeOut = panel.fadeOutMs > 0 ? smoothstep(left / panel.fadeOutMs) : 1;
  return Math.min(fadeIn, fadeOut);
}

/** Characters of each line shown at `localMs`, given the line lengths: lines are typed out one after the other. */
export function revealedChars(panel: CinematicPanel, localMs: number, lengths: readonly number[]): number[] {
  let start = panel.textStartMs;
  return lengths.map((length) => {
    const typed = Math.floor(((localMs - start) * panel.charsPerSecond) / 1000);
    start += (length * 1000) / panel.charsPerSecond + panel.lineGapMs;
    return Math.min(length, Math.max(0, typed));
  });
}

/** Camera shot at `localMs`: an ease in and out from the first shot to the last over the whole panel. */
export function cameraAt(panel: CinematicPanel, localMs: number): Shot {
  const k = smoothstep(localMs / panel.durationMs);
  const { from, to } = panel.camera;
  const mix = (a: number, b: number) => (k === 1 ? b : a + (b - a) * k);
  return { x: mix(from.x, to.x), y: mix(from.y, to.y), zoom: mix(from.zoom, to.zoom) };
}

export const skipAvailable = (elapsedMs: number): boolean => elapsedMs >= SKIP.availableAfterMs;

/** Progress (0..1) of a skip key held since `pressedAtMs` (null when not held); 1 skips. */
export function holdProgress(pressedAtMs: number | null, nowMs: number): number {
  if (pressedAtMs === null) return 0;
  return clamp01((nowMs - pressedAtMs) / SKIP.holdMs);
}

/**
 * The scale of a `stageW` x `stageH` cinematic stage in a `viewW` x `viewH`
 * viewport: the largest whole number from 2x up (every source pixel the same
 * size), and below that the exact fit, fractional, so a portrait phone gets
 * the whole width instead of a tiny 1x (the canvas keeps
 * `image-rendering: pixelated`, so it stays crisp). Never larger than the
 * viewport.
 */
export function stageScale(viewW: number, viewH: number, stageW: number, stageH: number): number {
  const fit = Math.min(viewW / stageW, viewH / stageH);
  return fit >= 2 ? Math.floor(fit) : Math.max(0.01, fit);
}
