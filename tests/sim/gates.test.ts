import { describe, expect, it } from 'vitest';
import { startRun } from '../../src/core/run';
import { CRYPT } from '../../src/data/dungeons';
import { runFloor } from '../../src/sim/runner';

/**
 * The bots know a floor's gate the way a player does (odd/tasks/integrate-encounters.md):
 * the marked enemy is on the minimap and a dropped key lies on the floor.
 * Without that the harness timed floors out instead of measuring them.
 */
describe('balance bots and floor gates', () => {
  const scenario = { dungeon: CRYPT.id, tier: 'easy' as const, bot: 'perfect' as const, party: 1 };

  it('hunts the marked enemy of a sealed stairs and goes down', () => {
    expect(startRun(225, {}, 2, CRYPT.id).world.gate?.kind).toBe('seal');
    expect(runFloor({ ...scenario, seed: 225 }, 2).outcome).toBe('cleared');
  });

  it('fells the key bearer, picks the key up and goes down through the opened door', () => {
    expect(startRun(688, {}, 4, CRYPT.id).world.gate?.kind).toBe('key');
    expect(runFloor({ ...scenario, seed: 688 }, 4).outcome).toBe('cleared');
  });
});
