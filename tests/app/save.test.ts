import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { EMPTY_SAVE, earnCoins, loadSave, migrate, sanitize, SAVE_KEY, SAVE_VERSION, writeSave } from '../../src/app/save';

const throwing: KeyValueStore = {
  get: () => {
    throw new Error('blocked');
  },
  set: () => {
    throw new Error('quota');
  },
};

describe('save facade', () => {
  it('reads an empty save from a missing key', () => {
    expect(loadSave(memoryStore())).toEqual(EMPTY_SAVE);
    expect(EMPTY_SAVE.version).toBe(SAVE_VERSION);
  });

  it('round-trips under the game namespace', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 120, upgrades: { vitality: 2 } });
    expect(SAVE_KEY.startsWith('mazmorra-sombria.')).toBe(true);
    expect(loadSave(store)).toEqual({ version: SAVE_VERSION, coins: 120, upgrades: { vitality: 2 } });
  });

  it('never throws on corrupted or hostile data', () => {
    for (const raw of ['{', 'null', '[]', '42', '"x"', '{"version":1,"coins":"lots"}', '{"version":1,"coins":-5,"upgrades":[1]}', '{"__proto__":{"coins":9}}', '{"version":1,"coins":1e400}']) {
      const store = memoryStore();
      store.set(SAVE_KEY, raw);
      const save = loadSave(store);
      expect(save.coins).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(save.coins)).toBe(true);
    }
  });

  it('never throws when the store fails', () => {
    expect(loadSave(throwing)).toEqual(EMPTY_SAVE);
    expect(() => writeSave(throwing, EMPTY_SAVE)).not.toThrow();
    expect(earnCoins(throwing, 10).coins).toBe(10);
  });

  it('sanitize drops unknown upgrades, clamps levels to their table and keeps whole coins', () => {
    const save = sanitize({ version: 1, coins: 12.9, upgrades: { vitality: 99, bogus: 1, insight: -1, reflexes: 1.5, stamina: 2 } });
    expect(save.coins).toBe(12);
    expect(save.upgrades).toEqual({ vitality: 5, stamina: 2 });
  });

  it('migrate brings an unversioned save to the current version', () => {
    expect(migrate({ coins: 30 })).toEqual({ version: SAVE_VERSION, coins: 30 });
    expect(sanitize(migrate({ coins: 30 }))).toEqual({ version: SAVE_VERSION, coins: 30, upgrades: {} });
  });

  it('earnCoins adds to the stored balance and returns the new save', () => {
    const store = memoryStore();
    earnCoins(store, 40);
    const after = earnCoins(store, 25);
    expect(after.coins).toBe(65);
    expect(loadSave(store).coins).toBe(65);
    expect(earnCoins(store, -10).coins).toBe(65);
  });
});
