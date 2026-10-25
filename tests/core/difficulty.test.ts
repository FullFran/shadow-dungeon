import { describe, expect, it } from 'vitest';
import { atLeast, DEFAULT_DIFFICULTY, DIFFICULTIES, isDifficulty } from '../../src/data/difficulty';
import { worldDifficulty } from '../../src/core/difficulty';
import { createWorld } from '../../src/core/world';

const world = () => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: { x: 100, y: 100 } });

describe('difficulty tiers', () => {
  it('orders the tiers from easy to nightmare', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'normal', 'hard', 'nightmare']);
    expect(atLeast('hard', 'normal')).toBe(true);
    expect(atLeast('normal', 'hard')).toBe(false);
    expect(atLeast('easy', 'easy')).toBe(true);
  });

  it('validates stored values', () => {
    expect(isDifficulty('nightmare')).toBe(true);
    expect(isDifficulty('legendary')).toBe(false);
  });

  it('treats a world without a tier as the default', () => {
    expect(worldDifficulty(world())).toBe(DEFAULT_DIFFICULTY);
    expect(worldDifficulty({ ...world(), difficulty: 'hard' })).toBe('hard');
  });
});
