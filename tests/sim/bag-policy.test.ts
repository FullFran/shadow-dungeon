import { describe, expect, it } from 'vitest';
import { botBagChoice } from '../../src/sim/bag-policy';
import { runDungeon, type Scenario } from '../../src/sim/runner';
import { spawnEnemy } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { world } from '../core/helpers';

const BAG = [{ id: 'dew-tonic' as const, count: 2 }, { id: 'spore-bomb' as const, count: 1 }, { id: 'clear-salt' as const, count: 1 }];

describe('the balance bots and the bag (docs/research/items-and-prep.md §4)', () => {
  it('a tonic under 40 % HP, never at full', () => {
    const low = { ...world(), player: { ...world().player, hp: world().player.maxHp * 0.3 } };
    expect(botBagChoice(low, BAG)).toBe('dew-tonic');
    expect(botBagChoice(world(), BAG)).toBeNull();
  });

  it('the salt when poisoned, the spore bomb with two enemies close', () => {
    const poisoned = { ...world(), player: { ...world().player, poison: { remainingMs: 2000, tickMs: 500 } } };
    expect(botBagChoice(poisoned, BAG)).toBe('clear-salt');
    let crowd = spawnEnemy(world(vec(400, 300)), 'poochyena', vec(420, 300), { dormant: true });
    crowd = spawnEnemy(crowd, 'poochyena', vec(380, 300), { dormant: true });
    expect(botBagChoice(crowd, BAG)).toBe('spore-bomb');
  });

  it('a run with a bag is still deterministic, and a run without one is unchanged by the option', () => {
    const s: Scenario = { dungeon: 'crypt-of-the-sword-king', tier: 'normal', bot: 'average', party: 1, seed: 2 };
    expect(runDungeon(s, { maxFloors: 2, bag: BAG })).toEqual(runDungeon(s, { maxFloors: 2, bag: BAG }));
    expect(runDungeon(s, { maxFloors: 2 })).toEqual(runDungeon(s, { maxFloors: 2, bag: [] }));
  });
});
