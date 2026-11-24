import { createRing, rank, type Ring } from './perf-probe';

/**
 * The production performance sampler for player reports (issue #71). The run
 * and the town loops hand it each frame's timestamp, simulation and render
 * time and enemy and bullet counts; it keeps them in fixed rings in memory
 * (nothing is stored, nothing is sent) and, only when a report asks, sums up
 * the last 10 seconds: frame intervals (p50/p95/max, the share of frames
 * under ~28 FPS and of frames that missed the display), simulation and render
 * time where measured, enemies and bullets, and frame intervals by enemy
 * count. The summary goes out only inside a ticket whose technical
 * attachment the player turned on (src/app/report-screen.ts).
 *
 * Honest by construction: a hidden tab, a pause or a stall of a second or more
 * is a break, never a slow frame; the first second after a scene starts or
 * after a break is not kept (loading, decoding sprites); a short window says
 * so (`lowSamples`) instead of giving percentiles; a measure that was not
 * taken is absent, never zero. `performance.now()` only times the CPU side of
 * drawing: what the GPU does after the canvas calls shows in the frame
 * interval, not in `renderMs`.
 */

/** The window a report sums up. */
export const PERF_WINDOW_MS = 10_000;
/** Frames kept at most: a 150 Hz display's window. Faster displays keep a shorter window. */
export const PERF_CAPACITY = 1_500;
/** Not kept after a scene starts or after a break. */
export const WARMUP_MS = 1_000;
/** An interval this long or longer is a break (hidden or throttled tab, a stall), not a frame. */
export const GAP_MS = 1_000;
/** Fewer frames than this in the window: no percentiles. */
export const MIN_SAMPLES = 60;
/** Slower than this is a low-FPS frame (under ~28 FPS), the same on every refresh rate. */
export const LOW_FPS_FRAME_MS = 35;
/** An enemy bucket with fewer frames than this gives its frame count but no percentiles. */
export const MIN_BUCKET_FRAMES = 10;
/** Enemy-count buckets for frame intervals by density. */
export const ENEMY_BUCKETS = [
  { name: '0-4', min: 0, max: 4 },
  { name: '5-9', min: 5, max: 9 },
  { name: '10-19', min: 10, max: 19 },
  { name: '20+', min: 20, max: Number.POSITIVE_INFINITY },
] as const;
/** Common display refresh rates; the estimate snaps to the nearest one (a coarse class, not a device signature). */
const REFRESH_HZ = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240] as const;

export type PerfScene = 'run' | 'town';
export type EnemyBucket = (typeof ENEMY_BUCKETS)[number]['name'];

export interface PerformanceSnapshot {
  schema: 1;
  scene: PerfScene;
  /** Frames kept in the window. */
  frameSamples: number;
  /** Too few frames for percentiles: the timings are left out. */
  lowSamples?: true;
  /** Time between the first and the last kept frame. */
  windowMs?: number;
  /** Time since the last kept frame (a report opened from a pause, or after the run). */
  ageMs?: number;
  /** Estimated display refresh rate, snapped to a common value. */
  refreshHz?: number;
  /** Interval between frames: the primary signal. */
  frameMs?: { p50: number; p95: number; max: number };
  /** Share of frames slower than LOW_FPS_FRAME_MS. */
  lowFpsRatio?: number;
  /** Share of frames longer than 1.5 display refreshes (missed the display). */
  missedRatio?: number;
  /** CPU time of the simulation step (run only). */
  simMs?: { p50: number; p95: number };
  /** CPU time of the canvas drawing (not GPU time). */
  renderMs?: { p50: number; p95: number };
  /** Active enemies in the world. */
  enemies?: { mean: number; peak: number };
  /** Enemies inside the camera's view. */
  visibleEnemies?: { mean: number; peak: number };
  bullets?: { mean: number; peak: number };
  /** Frame intervals by active-enemy count. */
  byEnemies?: Array<{ enemies: EnemyBucket; frames: number; p50?: number; p95?: number }>;
  /** Game canvas backing size (rounded to 100 px) and device pixel ratio (to 0.25). */
  canvas?: { width: number; height: number; dpr: number };
}

export interface PerfSampler {
  /** A new scene (a run, the town): forgets the previous one. */
  begin(scene: PerfScene): void;
  /** A drawn frame at `at` (the rAF timestamp, ms). A measure not taken is NaN. */
  frame(at: number, simMs: number, renderMs: number, enemies: number, visibleEnemies: number, bullets: number): void;
  /** A break (paused, hidden tab): the next frame starts a new interval after a warmup. */
  pause(): void;
  /** The summary of the last window, or null when this scene drew no frame. */
  snapshot(now: number, canvas?: { width: number; height: number; dpr: number }): PerformanceSnapshot | null;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const valid = (v: number) => Number.isFinite(v) && v >= 0;

function snapHz(hz: number): number {
  let best: number = REFRESH_HZ[0];
  for (const candidate of REFRESH_HZ) if (Math.abs(candidate - hz) < Math.abs(best - hz)) best = candidate;
  return best;
}

const sorted = (values: number[]) => values.sort((a, b) => a - b);
const spread = (values: number[]) => {
  const s = sorted(values);
  return { p50: r1(rank(s, 0.5)), p95: r1(rank(s, 0.95)) };
};
const count = (values: number[]) => ({ mean: r1(values.reduce((sum, v) => sum + v, 0) / values.length), peak: Math.max(...values) });

export function createPerfSampler(capacity = PERF_CAPACITY): PerfSampler {
  const at = createRing(capacity);
  const interval = createRing(capacity);
  const sim = createRing(capacity);
  const render = createRing(capacity);
  const enemies = createRing(capacity);
  const visible = createRing(capacity);
  const bullets = createRing(capacity);
  const rings: Ring[] = [at, interval, sim, render, enemies, visible, bullets];
  let scene: PerfScene | null = null;
  let seen = false;
  let lastAt: number | null = null;
  let warmUntil = 0;

  return {
    begin(next) {
      for (const ring of rings) ring.clear();
      scene = next;
      seen = false;
      lastAt = null;
    },
    frame(now, simMs, renderMs, enemyCount, visibleCount, bulletCount) {
      if (scene === null || !Number.isFinite(now)) return;
      seen = true;
      if (lastAt === null) {
        lastAt = now;
        warmUntil = now + WARMUP_MS;
        return;
      }
      const from = lastAt;
      const ms = now - from;
      lastAt = now;
      if (!(ms > 0) || ms >= GAP_MS) {
        warmUntil = now + WARMUP_MS;
        return;
      }
      if (from < warmUntil) return;
      at.push(now);
      interval.push(ms);
      sim.push(simMs);
      render.push(renderMs);
      enemies.push(enemyCount);
      visible.push(visibleCount);
      bullets.push(bulletCount);
    },
    pause() {
      lastAt = null;
    },
    snapshot(now, canvas) {
      if (scene === null || !seen) return null;
      const out: PerformanceSnapshot = { schema: 1, scene, frameSamples: 0 };
      const n = at.size;
      if (n > 0) {
        const latest = at.at(n - 1);
        let first = n - 1;
        while (first > 0 && at.at(first - 1) >= latest - PERF_WINDOW_MS) first--;
        const pick = (ring: Ring) => {
          const values: number[] = [];
          for (let i = first; i < n; i++) values.push(ring.at(i));
          return values;
        };
        const frames = pick(interval);
        const enemyCounts = pick(enemies);
        out.frameSamples = frames.length;
        out.windowMs = Math.round(latest - at.at(first));
        out.ageMs = Math.round(Math.max(0, now - latest));
        const full = frames.length >= MIN_SAMPLES;
        if (full) {
          const s = sorted([...frames]);
          const refreshHz = snapHz(1000 / rank(s, 0.1));
          out.refreshHz = refreshHz;
          out.frameMs = { p50: r1(rank(s, 0.5)), p95: r1(rank(s, 0.95)), max: r1(s[s.length - 1]!) };
          out.lowFpsRatio = r3(frames.filter((v) => v > LOW_FPS_FRAME_MS).length / frames.length);
          out.missedRatio = r3(frames.filter((v) => v > (1.5 * 1000) / refreshHz).length / frames.length);
          const simMs = pick(sim).filter(valid);
          if (simMs.length > 0) out.simMs = spread(simMs);
          const renderMs = pick(render).filter(valid);
          if (renderMs.length > 0) out.renderMs = spread(renderMs);
        } else out.lowSamples = true;
        const enemyValues = enemyCounts.filter(valid);
        if (enemyValues.length > 0) out.enemies = count(enemyValues);
        const visibleValues = pick(visible).filter(valid);
        if (visibleValues.length > 0) out.visibleEnemies = count(visibleValues);
        const bulletValues = pick(bullets).filter(valid);
        if (bulletValues.length > 0) out.bullets = count(bulletValues);
        if (full && enemyValues.length > 0) {
          const byEnemies: NonNullable<PerformanceSnapshot['byEnemies']> = [];
          for (const bucket of ENEMY_BUCKETS) {
            const inBucket = frames.filter((_, i) => valid(enemyCounts[i]!) && enemyCounts[i]! >= bucket.min && enemyCounts[i]! <= bucket.max);
            if (inBucket.length === 0) continue;
            byEnemies.push({ enemies: bucket.name, frames: inBucket.length, ...(inBucket.length >= MIN_BUCKET_FRAMES ? spread(inBucket) : {}) });
          }
          out.byEnemies = byEnemies;
        }
      } else out.lowSamples = true;
      if (canvas && valid(canvas.width) && valid(canvas.height) && Number.isFinite(canvas.dpr) && canvas.dpr > 0) {
        out.canvas = { width: Math.round(canvas.width / 100) * 100, height: Math.round(canvas.height / 100) * 100, dpr: Math.round(canvas.dpr * 4) / 4 };
      }
      return out;
    },
  };
}

let shared: PerfSampler | null | undefined;

/**
 * The game's sampler, always on in production (local memory only). The
 * development server turns it off with `?perfsampler=0`, for the before/after
 * benchmark (tools/mobile/bench.mjs `--sampler=off`).
 */
export function perfSampler(): PerfSampler | null {
  if (shared !== undefined) return shared;
  const off = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perfsampler') === '0';
  shared = off ? null : createPerfSampler();
  return shared;
}
