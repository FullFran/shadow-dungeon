import { describe, expect, it } from 'vitest';
import { createRing } from '../../src/adapters/perf-probe';
import { createPerfSampler, ENEMY_BUCKETS, GAP_MS, LOW_FPS_FRAME_MS, MIN_SAMPLES, PERF_CAPACITY, PERF_WINDOW_MS, WARMUP_MS, type PerfSampler } from '../../src/adapters/perf-sampler';

/** Feeds `count` frames `intervalMs` apart from `start`, every frame with the same measures. */
function feed(sampler: PerfSampler, start: number, count: number, intervalMs: number, m: { sim?: number; render?: number; enemies?: number; visible?: number; bullets?: number } = {}): number {
  let at = start;
  for (let i = 0; i < count; i++) {
    sampler.frame(at, m.sim ?? Number.NaN, m.render ?? Number.NaN, m.enemies ?? Number.NaN, m.visible ?? Number.NaN, m.bullets ?? Number.NaN);
    at += intervalMs;
  }
  return at - intervalMs;
}

/** A sampler past its warmup: `begin`, then frames 10 ms apart up to WARMUP_MS (none kept); the next frame's interval starts at WARMUP_MS and counts. */
function warm(_intervalMs: number, scene: 'run' | 'town' = 'run'): { sampler: PerfSampler; at: number } {
  const sampler = createPerfSampler();
  sampler.begin(scene);
  for (let at = 0; at <= WARMUP_MS; at += 10) sampler.frame(at, Number.NaN, Number.NaN, Number.NaN, Number.NaN, Number.NaN);
  return { sampler, at: WARMUP_MS };
}

describe('ring buffer', () => {
  it('keeps the newest values up to its capacity, oldest first', () => {
    const ring = createRing(3);
    for (const v of [1, 2, 3, 4, 5]) ring.push(v);
    expect(ring.size).toBe(3);
    expect(ring.values()).toEqual([3, 4, 5]);
    ring.clear();
    expect(ring.values()).toEqual([]);
  });
});

describe('performance sampler', () => {
  it('reports nothing before any frame of a scene', () => {
    const sampler = createPerfSampler();
    expect(sampler.snapshot(0)).toBeNull();
    sampler.begin('run');
    expect(sampler.snapshot(0)).toBeNull();
  });

  it('summarizes frame intervals, simulation and render times at 60 Hz', () => {
    const { sampler, at } = warm(1000 / 60);
    const last = feed(sampler, at + 1000 / 60, 300, 1000 / 60, { sim: 2, render: 4, enemies: 6, visible: 3, bullets: 40 });
    const s = sampler.snapshot(last + 500)!;
    expect(s.schema).toBe(1);
    expect(s.scene).toBe('run');
    expect(s.frameSamples).toBe(300);
    expect(s.frameMs).toEqual({ p50: 16.7, p95: 16.7, max: 16.7 });
    expect(s.refreshHz).toBe(60);
    expect(s.lowFpsRatio).toBe(0);
    expect(s.missedRatio).toBe(0);
    expect(s.simMs).toEqual({ p50: 2, p95: 2 });
    expect(s.renderMs).toEqual({ p50: 4, p95: 4 });
    expect(s.enemies).toEqual({ mean: 6, peak: 6 });
    expect(s.visibleEnemies).toEqual({ mean: 3, peak: 3 });
    expect(s.bullets).toEqual({ mean: 40, peak: 40 });
    expect(s.ageMs).toBe(500);
    expect(s.windowMs).toBeCloseTo(299 * (1000 / 60), -1);
  });

  it('does not take a fast display running smoothly for missed frames (90 and 120 Hz)', () => {
    for (const hz of [90, 120]) {
      const { sampler, at } = warm(1000 / hz);
      const last = feed(sampler, at + 1000 / hz, 600, 1000 / hz);
      const s = sampler.snapshot(last)!;
      expect(s.refreshHz).toBe(hz);
      expect(s.lowFpsRatio).toBe(0);
      expect(s.missedRatio).toBe(0);
    }
  });

  it('counts frames under 30 FPS whatever the refresh rate, and frames that missed the display', () => {
    const { sampler, at } = warm(1000 / 120);
    // 120 Hz: 150 smooth frames, 30 at 60 FPS (missed vsync, still fluid), 20 at 20 FPS (low FPS).
    let last = feed(sampler, at + 1000 / 120, 150, 1000 / 120);
    last = feed(sampler, last + 1000 / 60, 30, 1000 / 60);
    last = feed(sampler, last + 50, 20, 50);
    const s = sampler.snapshot(last)!;
    expect(s.frameSamples).toBe(200);
    expect(s.refreshHz).toBe(120);
    expect(s.lowFpsRatio).toBe(0.1);
    expect(s.missedRatio).toBe(0.25);
    expect(s.frameMs!.max).toBe(50);
    expect(LOW_FPS_FRAME_MS).toBeGreaterThan(1000 / 30);
  });

  it('keeps only the last window of frames (sliding window)', () => {
    const { sampler, at } = warm(1000 / 60);
    // 10 s of slow frames, then a full window of fast ones: the slow ones fall out.
    let last = feed(sampler, at + 50, 200, 50, { enemies: 30 });
    last = feed(sampler, last + 1000 / 60, Math.ceil(PERF_WINDOW_MS / (1000 / 60)) + 10, 1000 / 60, { enemies: 2 });
    const s = sampler.snapshot(last)!;
    expect(s.frameMs!.max).toBe(16.7);
    expect(s.enemies!.peak).toBe(2);
    expect(s.windowMs).toBeLessThanOrEqual(PERF_WINDOW_MS);
  });

  it('holds bounded memory: at most PERF_CAPACITY frames however fast the display', () => {
    const { sampler, at } = warm(1);
    const last = feed(sampler, at + 1, PERF_CAPACITY * 3, 1);
    expect(sampler.snapshot(last)!.frameSamples).toBe(PERF_CAPACITY);
  });

  it('skips the warmup after begin and after a break (first-load transients)', () => {
    const sampler = createPerfSampler();
    sampler.begin('run');
    // Loading hitches inside the warmup are not kept.
    let last = feed(sampler, 0, 5, 200);
    last = feed(sampler, last + 1000 / 60, MIN_SAMPLES + 30, 1000 / 60);
    const s = sampler.snapshot(last)!;
    expect(s.frameMs!.max).toBe(16.7);
    // The frames inside the first second (from 0 ms) are not kept either.
    expect(s.frameSamples).toBeLessThan(MIN_SAMPLES + 30);
  });

  it('never counts a hidden tab or a long gap as a slow frame', () => {
    const { sampler, at } = warm(1000 / 60);
    let last = feed(sampler, at + 1000 / 60, 120, 1000 / 60);
    // Tab hidden: rAF stops for 30 s; then throttled 1 s frames.
    sampler.pause();
    last = feed(sampler, last + 30_000, 3, GAP_MS + 10);
    last = feed(sampler, last + 1000 / 60, 200, 1000 / 60);
    const s = sampler.snapshot(last)!;
    expect(s.frameMs!.max).toBe(16.7);
    expect(s.lowFpsRatio).toBe(0);
  });

  it('marks a short window as too few samples and leaves the timings out rather than guess', () => {
    const { sampler, at } = warm(1000 / 60);
    const last = feed(sampler, at + 1000 / 60, MIN_SAMPLES - 1, 1000 / 60, { enemies: 4 });
    const s = sampler.snapshot(last)!;
    expect(s.frameSamples).toBe(MIN_SAMPLES - 1);
    expect(s.lowSamples).toBe(true);
    expect(s.frameMs).toBeUndefined();
    expect(s.lowFpsRatio).toBeUndefined();
    expect(s.byEnemies).toBeUndefined();
  });

  it('leaves out what was not measured instead of reporting zero (the town has no simulation, enemies or bullets)', () => {
    const { sampler, at } = warm(1000 / 60, 'town');
    const last = feed(sampler, at + 1000 / 60, 200, 1000 / 60, { render: 3 });
    const s = sampler.snapshot(last)!;
    expect(s.scene).toBe('town');
    expect(s.renderMs).toEqual({ p50: 3, p95: 3 });
    expect(s).not.toHaveProperty('simMs');
    expect(s).not.toHaveProperty('enemies');
    expect(s).not.toHaveProperty('visibleEnemies');
    expect(s).not.toHaveProperty('bullets');
    expect(s).not.toHaveProperty('byEnemies');
  });

  it('ignores non-finite and negative measures', () => {
    const { sampler, at } = warm(1000 / 60);
    let last = feed(sampler, at + 1000 / 60, 100, 1000 / 60, { sim: Number.POSITIVE_INFINITY, render: -1, enemies: Number.NaN });
    last = feed(sampler, last + 1000 / 60, 100, 1000 / 60, { sim: 1 });
    const s = sampler.snapshot(last)!;
    expect(s.simMs).toEqual({ p50: 1, p95: 1 });
    expect(s).not.toHaveProperty('renderMs');
    expect(s).not.toHaveProperty('enemies');
  });

  it('splits frame intervals by enemy count, so slowdowns can be read against density', () => {
    const { sampler, at } = warm(1000 / 60);
    let last = feed(sampler, at + 1000 / 60, 100, 1000 / 60, { enemies: 2 });
    last = feed(sampler, last + 1000 / 60, 100, 1000 / 60, { enemies: 12 });
    last = feed(sampler, last + 40, 100, 40, { enemies: 25 });
    const s = sampler.snapshot(last)!;
    expect(s.byEnemies).toEqual([
      { enemies: '0-4', frames: 100, p50: 16.7, p95: 16.7 },
      { enemies: '10-19', frames: 100, p50: 16.7, p95: 16.7 },
      { enemies: '20+', frames: 100, p50: 40, p95: 40 },
    ]);
    expect(ENEMY_BUCKETS.map((b) => b.name)).toEqual(['0-4', '5-9', '10-19', '20+']);
  });

  it('bands the canvas resolution and DPR coarsely', () => {
    const { sampler, at } = warm(1000 / 60);
    const last = feed(sampler, at + 1000 / 60, 100, 1000 / 60);
    expect(sampler.snapshot(last, { width: 2532, height: 1170, dpr: 3 })!.canvas).toEqual({ width: 2500, height: 1200, dpr: 3 });
    expect(sampler.snapshot(last, { width: 1337, height: 641, dpr: 2.625 })!.canvas).toEqual({ width: 1300, height: 600, dpr: 2.75 });
    expect(sampler.snapshot(last)).not.toHaveProperty('canvas');
  });

  it('begins a new scene empty', () => {
    const { sampler, at } = warm(1000 / 60);
    feed(sampler, at + 1000 / 60, 200, 1000 / 60, { enemies: 9 });
    sampler.begin('town');
    expect(sampler.snapshot(at)).toBeNull();
  });

  it('carries no identifiers or raw traces: only the allowlisted keys, numbers and enums', () => {
    const { sampler, at } = warm(1000 / 60);
    const last = feed(sampler, at + 1000 / 60, 400, 1000 / 60, { sim: 1, render: 2, enemies: 7, visible: 5, bullets: 30 });
    const s = sampler.snapshot(last)!;
    expect(Object.keys(s).sort()).toEqual(
      ['ageMs', 'bullets', 'byEnemies', 'enemies', 'frameMs', 'frameSamples', 'lowFpsRatio', 'missedRatio', 'refreshHz', 'renderMs', 'scene', 'schema', 'simMs', 'visibleEnemies', 'windowMs'].sort(),
    );
    const json = JSON.stringify(s);
    // A summary, not a trace: bounded size however many frames went in.
    expect(json.length).toBeLessThan(700);
    expect(json).not.toMatch(/\[\s*\d/);
  });
});
