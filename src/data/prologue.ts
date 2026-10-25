/**
 * The prologue as data: still tableaux that fade in from black, each with up
 * to two lines of narration (i18n keys) revealed slowly, and a slow camera
 * move. `src/ui/cinematic.ts` holds the timing maths, the scenes are drawn in
 * `src/adapters/prologue-scenes.ts`. The final boss is never shown here.
 */
export interface Shot {
  /** Camera centre as a fraction of the stage (0..1). */
  x: number;
  y: number;
  /** 1 shows the whole stage; larger zooms in. */
  zoom: number;
}

export interface CinematicPanel<S extends string = string> {
  id: string;
  scene: S;
  durationMs: number;
  /** Fade from black at the start and to black at the end (0 is a cut). */
  fadeInMs: number;
  fadeOutMs: number;
  /** Narration, as i18n keys, revealed one line after the other. */
  lines: readonly string[];
  textStartMs: number;
  charsPerSecond: number;
  /** Pause between the end of one line and the start of the next. */
  lineGapMs: number;
  camera: { from: Shot; to: Shot };
}

export type PrologueScene = 'light' | 'hunger' | 'dimming' | 'eclipse' | 'dungeons' | 'shadows' | 'king' | 'voice';

/** Into the eclipse panel: black, then the ring appears with a timpani hit. */
export const ECLIPSE_REVEAL_MS = 1400;

const WIDE: Shot = { x: 0.5, y: 0.5, zoom: 1 };
const TEXT = { textStartMs: 1200, charsPerSecond: 28, lineGapMs: 700 } as const;
const FADE = { fadeInMs: 1800, fadeOutMs: 1400 } as const;

const lines = (scene: PrologueScene, count: number): string[] => Array.from({ length: count }, (_, i) => `prologue.${scene}.${i + 1}`);

export const PROLOGUE: readonly CinematicPanel<PrologueScene>[] = [
  { id: 'light', scene: 'light', durationMs: 8500, ...FADE, fadeInMs: 2600, lines: lines('light', 2), ...TEXT, textStartMs: 1600, camera: { from: { x: 0.5, y: 0.42, zoom: 1.12 }, to: { x: 0.5, y: 0.5, zoom: 1.02 } } },
  { id: 'hunger', scene: 'hunger', durationMs: 8500, ...FADE, lines: lines('hunger', 2), ...TEXT, camera: { from: { x: 0.5, y: 0.4, zoom: 1.05 }, to: { x: 0.5, y: 0.6, zoom: 1.2 } } },
  { id: 'dimming', scene: 'dimming', durationMs: 9500, ...FADE, lines: lines('dimming', 2), ...TEXT, camera: { from: WIDE, to: { x: 0.5, y: 0.4, zoom: 1.1 } } },
  {
    id: 'eclipse',
    scene: 'eclipse',
    durationMs: 10500,
    fadeInMs: 0,
    fadeOutMs: 1600,
    lines: lines('eclipse', 2),
    ...TEXT,
    textStartMs: ECLIPSE_REVEAL_MS + 2000,
    camera: { from: { x: 0.5, y: 0.36, zoom: 1.25 }, to: { x: 0.5, y: 0.42, zoom: 1.08 } },
  },
  { id: 'dungeons', scene: 'dungeons', durationMs: 8500, ...FADE, lines: lines('dungeons', 2), ...TEXT, camera: { from: { x: 0.42, y: 0.55, zoom: 1.1 }, to: { x: 0.58, y: 0.55, zoom: 1.1 } } },
  { id: 'shadows', scene: 'shadows', durationMs: 9000, ...FADE, lines: lines('shadows', 2), ...TEXT, camera: { from: WIDE, to: { x: 0.5, y: 0.52, zoom: 1.15 } } },
  { id: 'king', scene: 'king', durationMs: 13000, ...FADE, fadeOutMs: 2000, lines: lines('king', 2), ...TEXT, camera: { from: { x: 0.5, y: 0.45, zoom: 1.0 }, to: { x: 0.5, y: 0.5, zoom: 1.22 } } },
  { id: 'voice', scene: 'voice', durationMs: 6500, fadeInMs: 0, fadeOutMs: 1400, lines: lines('voice', 1), textStartMs: 1500, charsPerSecond: 14, lineGapMs: 0, camera: { from: WIDE, to: WIDE } },
];

/** Milliseconds from the start of the prologue to the eclipse reveal (the music hits there). */
export function eclipseRevealAtMs(panels: readonly CinematicPanel<PrologueScene>[] = PROLOGUE): number {
  let at = 0;
  for (const p of panels) {
    if (p.scene === 'eclipse') return at + ECLIPSE_REVEAL_MS;
    at += p.durationMs;
  }
  return at;
}
