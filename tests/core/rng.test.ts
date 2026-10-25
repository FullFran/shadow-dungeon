import { describe, expect, it } from 'vitest';
import { nextRandom, seedRng } from '../../src/core/rng';

describe('seeded rng', () => {
  it('repeats the same sequence for the same seed and stays in [0, 1)', () => {
    const sequence = (seed: number) => {
      let state = seedRng(seed);
      return Array.from({ length: 50 }, () => {
        const result = nextRandom(state);
        state = result.state;
        return result.value;
      });
    };
    expect(sequence(42)).toEqual(sequence(42));
    expect(sequence(42)).not.toEqual(sequence(43));
    expect(sequence(42).every((v) => v >= 0 && v < 1)).toBe(true);
  });
});
