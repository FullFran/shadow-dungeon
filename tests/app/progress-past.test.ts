import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { pastProgress, recordPast } from '../../src/app/progress';
import { loadSave } from '../../src/app/save';
import { readBoard } from '../../src/town/leaderboard';
import { EMPTY_RECORDS, readRecords } from '../../src/town/records';
import v2Storage from './fixtures/storage-v2-b90c45a.json';
import v3Storage from './fixtures/storage-v3-245f309.json';

/** Retroactive achievements on load (odd/tasks/progress-continuity.md T2), from the deployed builds' real storage. */
const deviceWith = (contents: Record<string, string>): KeyValueStore => {
  const store = memoryStore();
  for (const [key, value] of Object.entries(contents)) store.set(key, value);
  return store;
};

const NOW = Date.UTC(2026, 9, 26, 20);

describe('the history the records and the Sima leaderboard prove', () => {
  it('reads the highest tier won per dungeon (a record from before tiers as easy) and the deepest Sima floor of both stores', () => {
    const store = deviceWith(v2Storage);
    expect(pastProgress(readRecords(store), readBoard(store))).toEqual({
      cleared: { 'crypt-of-the-sword-king': 'hard', 'misty-forest': 'nightmare', 'toxic-swamp': 'easy' },
      // The records saw floor 23; the leaderboard keeps a deeper run (34).
      deepest: { 'eclipse-chasm': 34 },
    });
  });

  it('an empty device proves nothing', () => {
    expect(pastProgress(EMPTY_RECORDS, [])).toEqual({ cleared: {}, deepest: {} });
  });
});

describe('the retroactive pass on load', () => {
  it('unlocks a v2 player’s clears, Sima depth and lifetime Pokémonedas, and pays each reward once', () => {
    const store = deviceWith(v2Storage);
    const before = loadSave(store);
    const { unlocked } = recordPast(store, NOW);
    const ids = unlocked.map((d) => d.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'clear-crypt-of-the-sword-king-easy',
        'clear-crypt-of-the-sword-king-normal',
        'clear-crypt-of-the-sword-king-hard',
        'clear-misty-forest-easy',
        'clear-misty-forest-nightmare',
        'clear-toxic-swamp-easy',
        'depth-eclipse-chasm-11',
        'depth-eclipse-chasm-21',
        'depth-eclipse-chasm-31',
        'earned-1000',
      ]),
    );
    for (const id of ['clear-crypt-of-the-sword-king-nightmare', 'clear-toxic-swamp-normal', 'clear-flooded-caves-easy', 'depth-eclipse-chasm-41', 'gacha-first-pull', 'earned-100000', 'coop-clear', 'secret-stumble']) expect(ids, id).not.toContain(id);
    const after = loadSave(store);
    const paid = unlocked.reduce((sum, d) => sum + d.reward, 0);
    expect(after.coins).toBe(before.coins + paid);
    expect(Object.keys(after.achievements ?? {}).sort()).toEqual([...ids].sort());
    // Everything else the player had is untouched.
    expect({ ...after, coins: before.coins, achievements: undefined, earned: undefined }).toEqual({ ...before, achievements: undefined, earned: undefined });
    // Idempotent: a second load unlocks and pays nothing.
    expect(recordPast(store, NOW + 86_400_000).unlocked).toEqual([]);
    expect(loadSave(store)).toEqual(after);
  });

  it('credits a v3 player’s evolved gacha forms and first pull too', () => {
    const store = deviceWith(v3Storage);
    const ids = recordPast(store, NOW).unlocked.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['evolve-kadabra', 'evolve-luxio', 'gacha-first-pull', 'clear-misty-forest-nightmare', 'depth-eclipse-chasm-31']));
    expect(ids).not.toContain('evolve-alakazam');
    expect(recordPast(store, NOW).unlocked).toEqual([]);
  });

  it('writes nothing for a new player', () => {
    const store = memoryStore();
    expect(recordPast(store, NOW).unlocked).toEqual([]);
    expect(store.get('mazmorra-sombria.save')).toBeNull();
  });
});
