import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { dailyMissions } from '../../src/core/missions';
import { MISSIONS } from '../../src/data/missions';
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

  it('migrate brings a v2 save to the current version with everything it held', () => {
    const v2 = { version: 2, coins: 50, upgrades: { vitality: 1 }, learned: { zorua: ['swift'] }, ranks: { mimikyu: { 'shadow-claw': 1 } } };
    expect(migrate(v2)).toEqual({ ...v2, version: SAVE_VERSION });
    expect(sanitize(migrate(v2))).toEqual({ ...v2, version: SAVE_VERSION });
  });

  it('migrate brings a v3 save to v4: no achievements or lifetime earnings yet', () => {
    const v3 = { version: 3, coins: 70, upgrades: {}, owned: ['abra'], materials: { abra: { normal: 2 } }, pity: 3 };
    expect(SAVE_VERSION).toBe(4);
    const save = sanitize(migrate(v3));
    expect(save).toEqual({ ...v3, version: 4 });
    expect(save.achievements).toBeUndefined();
    expect(save.earned).toBeUndefined();
  });

  it('round-trips unlocked achievements and lifetime earnings', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 5, achievements: { 'clear-misty-forest-easy': '2026-10-26' }, earned: 1234 });
    expect(loadSave(store)).toMatchObject({ achievements: { 'clear-misty-forest-easy': '2026-10-26' }, earned: 1234 });
  });

  it('round-trips accepted and claimed missions', () => {
    const store = memoryStore();
    const [a, b] = dailyMissions('2026-10-26');
    writeSave(store, { ...EMPTY_SAVE, missions: { accepted: [{ id: a!.id, progress: 0 }], claimed: [b!.id] } });
    expect(loadSave(store).missions).toEqual({ accepted: [{ id: a!.id, progress: 0 }], claimed: [b!.id] });
  });

  it('sanitize keeps only real missions, once each, with whole progress up to their target, at most the limit', () => {
    const board = dailyMissions('2026-10-26');
    const accepted = [...board, board[0]!].map((m) => ({ id: m.id, progress: 1e9 }));
    const save = sanitize({ coins: 0, upgrades: {}, missions: { accepted: [...accepted, { id: 'd:2026-10-26:99', progress: 1 }, 'x', { id: 7 }], claimed: ['nope', board[1]!.id, board[1]!.id, 3] } });
    expect(save.missions!.accepted).toEqual(board.slice(0, MISSIONS.maxAccepted).map((m) => ({ id: m.id, progress: m.target })));
    expect(save.missions!.claimed).toEqual([board[1]!.id]);
    expect(sanitize({ coins: 0, upgrades: {}, missions: { accepted: [{ id: board[0]!.id, progress: -2.5 }] } }).missions).toEqual({ accepted: [{ id: board[0]!.id, progress: 0 }], claimed: [] });
    expect(sanitize({ coins: 0, upgrades: {}, missions: { accepted: [], claimed: [] } }).missions).toBeUndefined();
    expect(sanitize({ coins: 0, upgrades: {}, missions: 'all' }).missions).toBeUndefined();
  });

  it('sanitize keeps only known achievement ids with a date, and a whole lifetime count', () => {
    const save = sanitize({ coins: 0, upgrades: {}, achievements: { 'clear-misty-forest-easy': '2026-10-26', bogus: '2026-10-26', 'coop-clear': 7, __proto__: 'x', 'gacha-first-pull': 'yesterday' }, earned: -4 });
    expect(save.achievements).toEqual({ 'clear-misty-forest-easy': '2026-10-26' });
    expect(save.earned).toBeUndefined();
    expect(sanitize({ coins: 0, upgrades: {}, achievements: [1, 2] }).achievements).toBeUndefined();
  });

  it('sanitize keeps only gacha species and evolved starters in the collection: no base starters, enemies, unknowns or repeats', () => {
    const save = sanitize({ coins: 0, upgrades: {}, owned: ['mimikyu', 'gastly', 'nope', 7], materials: { mimikyu: 3, gastly: 2, zoroark: 1 }, pity: 4.7 });
    expect(save.owned).toBeUndefined();
    // Mimikyu's line has materials (its awakening); an enemy's or an evolved form's key does not.
    expect(save.materials).toEqual({ mimikyu: { normal: 3 } });
    expect(save.pity).toBe(4);
    expect(sanitize({ coins: 0, upgrades: {}, pity: -3 }).pity).toBeUndefined();
    expect(sanitize({ coins: 0, upgrades: {}, pity: 'x' }).pity).toBeUndefined();
  });

  it('earnCoins adds to the stored balance and returns the new save', () => {
    const store = memoryStore();
    earnCoins(store, 40);
    const after = earnCoins(store, 25);
    expect(after.coins).toBe(65);
    expect(loadSave(store).coins).toBe(65);
    expect(earnCoins(store, -10).coins).toBe(65);
  });

  it('earnCoins also counts the lifetime Pokémonedas earned (spending never lowers it)', () => {
    const store = memoryStore();
    earnCoins(store, 40);
    writeSave(store, { ...loadSave(store), coins: 0 });
    expect(earnCoins(store, 25).earned).toBe(65);
  });
});
