import { describe, expect, it } from 'vitest';
import type { CinematicPanel } from '../../src/data/prologue';
import { cameraAt, holdProgress, panelAlpha, panelAt, revealedChars, SKIP, skipAvailable, smoothstep, startOf, totalMs } from '../../src/ui/cinematic';

const panel = (id: string, durationMs: number, extra: Partial<CinematicPanel> = {}): CinematicPanel => ({
  id,
  scene: id,
  durationMs,
  fadeInMs: 1000,
  fadeOutMs: 500,
  lines: ['a', 'b'],
  textStartMs: 1000,
  charsPerSecond: 10,
  lineGapMs: 500,
  camera: { from: { x: 0.5, y: 0.5, zoom: 1 }, to: { x: 0.6, y: 0.4, zoom: 1.2 } },
  ...extra,
});

const PANELS = [panel('one', 4000), panel('two', 6000), panel('three', 2000)];

describe('cinematic timeline', () => {
  it('sums the panel lengths and knows where each starts', () => {
    expect(totalMs(PANELS)).toBe(12000);
    expect(startOf(PANELS, 0)).toBe(0);
    expect(startOf(PANELS, 2)).toBe(10000);
  });

  it('finds the panel and the local time at a moment', () => {
    expect(panelAt(PANELS, 0)).toMatchObject({ index: 0, localMs: 0 });
    expect(panelAt(PANELS, 3999)).toMatchObject({ index: 0, localMs: 3999 });
    expect(panelAt(PANELS, 4000)).toMatchObject({ index: 1, localMs: 0 });
    expect(panelAt(PANELS, 11500)?.panel.id).toBe('three');
    expect(panelAt(PANELS, -50)).toMatchObject({ index: 0, localMs: 0 });
  });

  it('is over (null) once the last panel ends', () => {
    expect(panelAt(PANELS, 12000)).toBeNull();
    expect(panelAt([], 0)).toBeNull();
  });
});

describe('alpha curves', () => {
  const p = PANELS[0]!;

  it('fades in from black, holds, then fades out to black', () => {
    expect(panelAlpha(p, 0)).toBe(0);
    expect(panelAlpha(p, 500)).toBeCloseTo(0.5);
    expect(panelAlpha(p, 1000)).toBe(1);
    expect(panelAlpha(p, 3000)).toBe(1);
    expect(panelAlpha(p, 3750)).toBeCloseTo(0.5);
    expect(panelAlpha(p, 4000)).toBe(0);
  });

  it('rises slowly at first (eased, not linear)', () => {
    expect(panelAlpha(p, 200)).toBeLessThan(0.2);
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(2)).toBe(1);
  });

  it('treats a zero-length fade as a cut', () => {
    const cut = panel('cut', 1000, { fadeInMs: 0, fadeOutMs: 0 });
    expect(panelAlpha(cut, 0)).toBe(1);
    expect(panelAlpha(cut, 999)).toBe(1);
  });
});

describe('text reveal', () => {
  const p = PANELS[1]!;

  it('reveals nothing before the text starts, then a line at a time', () => {
    expect(revealedChars(p, 999, [20, 10])).toEqual([0, 0]);
    expect(revealedChars(p, 1500, [20, 10])).toEqual([5, 0]);
    // Line 1 takes 2 s, then a 0.5 s gap before line 2.
    expect(revealedChars(p, 3000, [20, 10])).toEqual([20, 0]);
    expect(revealedChars(p, 3500, [20, 10])).toEqual([20, 0]);
    expect(revealedChars(p, 4000, [20, 10])).toEqual([20, 5]);
    expect(revealedChars(p, 9000, [20, 10])).toEqual([20, 10]);
  });
});

describe('camera', () => {
  const p = PANELS[0]!;

  it('eases from the first shot to the last over the panel', () => {
    expect(cameraAt(p, 0)).toEqual({ x: 0.5, y: 0.5, zoom: 1 });
    const mid = cameraAt(p, 2000);
    expect(mid.x).toBeCloseTo(0.55);
    expect(mid.zoom).toBeCloseTo(1.1);
    expect(cameraAt(p, 4000)).toEqual({ x: 0.6, y: 0.4, zoom: 1.2 });
  });
});

describe('skip', () => {
  it('is offered only after the first second', () => {
    expect(skipAvailable(0)).toBe(false);
    expect(skipAvailable(SKIP.availableAfterMs - 1)).toBe(false);
    expect(skipAvailable(SKIP.availableAfterMs)).toBe(true);
  });

  it('needs the key held for the whole hold time', () => {
    expect(holdProgress(null, 5000)).toBe(0);
    expect(holdProgress(5000, 5000)).toBe(0);
    expect(holdProgress(5000, 5000 + SKIP.holdMs / 2)).toBeCloseTo(0.5);
    expect(holdProgress(5000, 5000 + SKIP.holdMs)).toBe(1);
    expect(holdProgress(5000, 5000 + SKIP.holdMs * 3)).toBe(1);
  });
});
