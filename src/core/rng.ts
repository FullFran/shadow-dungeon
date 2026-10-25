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
