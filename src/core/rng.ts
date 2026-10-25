/**
 * Seeded PRNG (mulberry32). The state is a plain number stored in the world
 * state, so a simulation step stays a pure function of (state, inputs).
 */
export interface RngResult {
  value: number;
  state: number;
}

/** Returns a float in [0, 1) and the next RNG state. */
export function nextRandom(state: number): RngResult {
  const next = (state + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, state: next };
}

export const seedRng = (seed: number): number => seed | 0;

/** Mixes a seed with a salt (floor index, depth...) into an independent seed, deterministically. */
export function deriveSeed(seed: number, salt: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be59b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) | 0;
}
