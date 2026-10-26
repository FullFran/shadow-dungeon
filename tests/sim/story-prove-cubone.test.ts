import { describe, expect, it } from 'vitest';
import { STORY_BOSSES } from '../../src/data/story/bosses';
import { proveShadows, SHADOWS } from './story-prove';

describe('every new shadow stands on a road, once', () => {
  it('the shadows of every Senda file are on its roads', () => {
    const shadows = STORY_BOSSES.filter((b) => !b.wound).map((b) => b.id);
    expect(SHADOWS.map((s) => s.species).sort()).toEqual([...shadows].sort());
  });
});

/** Shard: Cubone's shadows (tests/sim/story-prove.ts). */
proveShadows('cubone');
