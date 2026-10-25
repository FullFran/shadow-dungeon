import type { Vec2 } from '../core/vec';

/**
 * Interpolation buffer for remote state (docs/gdd.md §12): remote entities
 * are drawn a little in the past (the render delay), between the two
 * received samples around that moment, so packets arriving unevenly still
 * give smooth motion. Past the newest sample it extrapolates briefly, then
 * holds. An epoch (the floor index) separates teleports: a sample of a new
 * epoch drops the old ones, so nothing slides across a floor change. Pure.
 */
export interface Sample<T> {
  /** Local time the sample stands for (ms). */
  at: number;
  epoch: number;
  value: T;
}

export interface InterpBuffer<T> {
  samples: readonly Sample<T>[];
  capacity: number;
}

export interface SampleOptions {
  /** How far past the newest sample to extrapolate before holding still. */
  maxExtrapolateMs: number;
}

export const createBuffer = <T>(capacity = 32): InterpBuffer<T> => ({ samples: [], capacity });

/** Adds a sample in time order; a newer epoch clears the buffer, an older one is ignored. */
export function pushSample<T>(buffer: InterpBuffer<T>, sample: Sample<T>): InterpBuffer<T> {
  const newest = buffer.samples.at(-1);
  if (newest && sample.epoch < newest.epoch) return buffer;
  const kept = newest && sample.epoch > newest.epoch ? [] : buffer.samples.filter((s) => s.at !== sample.at);
  const index = kept.findIndex((s) => s.at > sample.at);
  const samples = index < 0 ? [...kept, sample] : [...kept.slice(0, index), sample, ...kept.slice(index)];
  return { ...buffer, samples: samples.slice(-buffer.capacity) };
}

/**
 * The value at `renderAt`: `mix(a, b, t)` between the samples around it
 * (t in [0, 1]), t > 1 up to the extrapolation limit past the newest, the
 * oldest sample before the buffer starts, null when empty.
 */
export function sampleAt<T>(buffer: InterpBuffer<T>, renderAt: number, mix: (a: T, b: T, t: number) => T, options: SampleOptions): T | null {
  const { samples } = buffer;
  if (samples.length === 0) return null;
  const first = samples[0]!;
  if (renderAt <= first.at || samples.length === 1) return first.value;
  for (let i = 1; i < samples.length; i++) {
    const b = samples[i]!;
    if (renderAt <= b.at) {
      const a = samples[i - 1]!;
      return mix(a.value, b.value, (renderAt - a.at) / (b.at - a.at));
    }
  }
  const a = samples.at(-2)!;
  const b = samples.at(-1)!;
  const ahead = Math.min(renderAt - b.at, options.maxExtrapolateMs);
  return mix(a.value, b.value, 1 + ahead / (b.at - a.at));
}

/** Linear position mix that snaps when the two samples are a teleport apart. */
export function lerpPos(a: Vec2, b: Vec2, t: number, snapDistance: number): Vec2 {
  if (Math.hypot(b.x - a.x, b.y - a.y) > snapDistance) return b;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
