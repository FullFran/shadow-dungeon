import { describe, expect, it } from 'vitest';
import { loadTestFloor, parseSpawnList, TEST_FLOOR } from '../../src/core/test-floor';
import { startRun } from '../../src/core/run';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance } from '../../src/core/vec';
import { IDLE } from './helpers';

describe('dev test floor (?spawn=)', () => {
  it('parses a comma list, keeping only species with a behaviour, capped', () => {
    expect(parseSpawnList(' Koffing, grimer,,nope,mimikyu,constructor ')).toEqual(['koffing', 'grimer']);
    expect(parseSpawnList(null)).toEqual([]);
    expect(parseSpawnList(Array(20).fill('zubat').join(','))).toHaveLength(TEST_FLOOR.maxEnemies);
  });

  it('replaces the floor with an open arena and the enemies awake on an arc in front of the player', () => {
    const { world } = startRun(7, {});
    const floor = loadTestFloor(world, ['koffing', 'grimer', 'croagunk', 'corphish']);
    expect(floor.arena).toEqual({ width: TEST_FLOOR.width, height: TEST_FLOOR.height });
    expect(floor.enemies.map((e) => e.species)).toEqual(['koffing', 'grimer', 'croagunk', 'corphish']);
    for (const enemy of floor.enemies) {
      expect(enemy.ai.mode).toBe('idle');
      expect(distance(enemy.pos, floor.player.pos)).toBeGreaterThan(200);
      expect(enemy.pos.x).toBeGreaterThan(0);
      expect(enemy.pos.y).toBeLessThan(TEST_FLOOR.height);
    }
    // They hunt: after a while someone is winding up.
    let state = floor;
    let telegraphed = false;
    for (let i = 0; i < 300 && !telegraphed; i++) {
      state = step(state, IDLE, FIXED_DT_MS);
      telegraphed = state.events.some((e) => e.type === 'enemyTelegraph');
    }
    expect(telegraphed).toBe(true);
  });
});
