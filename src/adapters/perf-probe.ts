/**
 * Frame-time probe for the mobile benchmark (tools/mobile/bench.mjs). The
 * game and the town record per-frame timings into named channels (frame
 * interval, simulation, render) only when it is enabled: development server
 * with `?perf=1`. Disabled, `devPerfProbe()` returns null. The live probe is
 * exposed as `globalThis.__mzPerf`. The ring and the percentile math here are
 * shared with the production sampler for player reports (perf-sampler.ts).
 */

export interface PerfSummary {
  count: number;
  mean: number;
  p50: number;
  p95: number;
  max: number;
}

export interface PerfProbe {
  record(channel: string, ms: number): void;
  reset(): void;
  report(): Record<string, PerfSummary>;
}

/** Nearest-rank percentile of sorted samples (at least one). */
export function rank(sorted: ArrayLike<number>, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))]!;
}

/** A fixed-size circular buffer of numbers: pushing past `capacity` overwrites the oldest, in constant time, with no allocation. */
export interface Ring {
  readonly size: number;
  push(value: number): void;
  /** The value `i` places after the oldest kept one (0 = oldest). */
  at(i: number): number;
  /** The kept values, oldest first (a copy). */
  values(): number[];
  clear(): void;
}

export function createRing(capacity: number): Ring {
  const data = new Float64Array(Math.max(1, capacity));
  let start = 0;
  let size = 0;
  const at = (i: number) => data[(start + i) % data.length]!;
  return {
    get size() {
      return size;
    },
    push(value) {
      if (size < data.length) data[(start + size++) % data.length] = value;
      else {
        data[start] = value;
        start = (start + 1) % data.length;
      }
    },
    at,
    values: () => Array.from({ length: size }, (_, i) => at(i)),
    clear() {
      start = 0;
      size = 0;
    },
  };
}

export function summarize(samples: readonly number[]): PerfSummary {
  if (samples.length === 0) return { count: 0, mean: 0, p50: 0, p95: 0, max: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return { count: sorted.length, mean, p50: rank(sorted, 0.5), p95: rank(sorted, 0.95), max: sorted[sorted.length - 1]! };
}

/** A probe holding at most `capacity` newest samples per channel. */
export function createPerfProbe(capacity = 4096): PerfProbe {
  const channels = new Map<string, Ring>();
  return {
    record(channel, ms) {
      let samples = channels.get(channel);
      if (!samples) channels.set(channel, (samples = createRing(capacity)));
      samples.push(ms);
    },
    reset() {
      channels.clear();
    },
    report() {
      const out: Record<string, PerfSummary> = {};
      for (const [name, samples] of channels) out[name] = summarize(samples.values());
      return out;
    },
  };
}

let shared: PerfProbe | null | undefined;

/** The development probe (`?perf=1` on the dev server), or null. */
export function devPerfProbe(): PerfProbe | null {
  if (shared !== undefined) return shared;
  const enabled = import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('perf') === '1';
  shared = enabled ? createPerfProbe() : null;
  if (shared) (globalThis as { __mzPerf?: PerfProbe }).__mzPerf = shared;
  return shared;
}
