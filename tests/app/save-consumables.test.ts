import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { decodeCloud } from '../../src/app/cloud-payload';
import { SAVE_FIELD_RULES } from '../../src/app/profile-merge';
import { buyConsumableAt, itemPullAt, loadSave, parseSave, sanitize, SAVE_VERSION, spendConsumableAt, writeSave } from '../../src/app/save';
import { BAG, CONSUMABLE_IDS, CONSUMABLES, ITEM_GACHA } from '../../src/data/consumables';

describe('save: the consumable stock (optional fields, version 4 kept)', () => {
  it('a save without the fields reads with none (no migration step needed)', () => {
    const save = parseSave(JSON.stringify({ version: 4, coins: 10, upgrades: {} }));
    expect(save.stock).toBeUndefined();
    expect(save.unlockedConsumables).toBeUndefined();
    expect(save.itemPity).toBeUndefined();
    expect(save.itemRarePity).toBeUndefined();
    expect(SAVE_VERSION).toBe(4);
  });

  it('keeps known kinds with whole counts clamped to the stock cap; drops the rest', () => {
    const save = sanitize({ version: 4, coins: 0, upgrades: {}, stock: { 'dew-tonic': 4.7, 'clear-salt': 99, 'ember-dust': -2, 'potion-of-ruin': 3, 'exit-cord': 'x' } });
    expect(save.stock).toEqual({ 'dew-tonic': 4, 'clear-salt': BAG.stockCap });
  });

  it('keeps unlocked kinds that exist and are not commons, once each', () => {
    const save = sanitize({ version: 4, coins: 0, upgrades: {}, unlockedConsumables: ['hush-lantern', 'hush-lantern', 'dew-tonic', 'nope', 3, 'spore-bomb'] });
    expect(save.unlockedConsumables).toEqual(['hush-lantern', 'spore-bomb']);
  });

  it('keeps the pity counters below their sure pull', () => {
    const save = sanitize({ version: 4, coins: 0, upgrades: {}, itemPity: 99, itemRarePity: 7.5 });
    expect(save.itemPity).toBe(ITEM_GACHA.uncommonPity - 1);
    expect(save.itemRarePity).toBe(7);
  });

  it('round-trips through the store and the cloud payload', () => {
    const store = memoryStore();
    const today = { version: 4 as const, coins: 5, upgrades: {}, stock: { 'dew-tonic': 3, 'spore-bomb': 1 }, unlockedConsumables: ['spore-bomb' as const], itemPity: 2, itemRarePity: 11 };
    writeSave(store, today);
    expect(loadSave(store)).toEqual(today);
    expect(decodeCloud(JSON.parse(JSON.stringify(loadSave(store)))).profile.save).toEqual(today);
  });

  it('the stock, the unlocks and the pity are economy: a profile merge keeps one side whole', () => {
    expect(SAVE_FIELD_RULES.stock).toBe('economy');
    expect(SAVE_FIELD_RULES.unlockedConsumables).toBe('economy');
    expect(SAVE_FIELD_RULES.itemPity).toBe('economy');
    expect(SAVE_FIELD_RULES.itemRarePity).toBe('economy');
  });
});

describe('save: buying, pulling and spending on the stored save', () => {
  it('buys a unit at its price and writes it; refuses (nothing written) otherwise', () => {
    const store = memoryStore();
    writeSave(store, { version: 4, coins: 30, upgrades: {} });
    expect(buyConsumableAt(store, 'dew-tonic')?.stock).toEqual({ 'dew-tonic': 1 });
    expect(loadSave(store).coins).toBe(30 - CONSUMABLES['dew-tonic'].price);
    expect(buyConsumableAt(store, 'dew-tonic')).toBeNull();
    expect(loadSave(store).stock).toEqual({ 'dew-tonic': 1 });
  });

  it('pulls and writes the result', () => {
    const store = memoryStore();
    writeSave(store, { version: 4, coins: ITEM_GACHA.cost, upgrades: {} });
    const out = itemPullAt(store, 1)!;
    expect(CONSUMABLE_IDS).toContain(out.result.id);
    expect(loadSave(store).stock?.[out.result.id]).toBeGreaterThan(0);
    expect(itemPullAt(store, 2)).toBeNull();
  });

  it('a used unit leaves the stored stock at once (a crash later cannot give it back)', () => {
    const store = memoryStore();
    writeSave(store, { version: 4, coins: 0, upgrades: {}, stock: { 'dew-tonic': 2 } });
    spendConsumableAt(store, 'dew-tonic');
    expect(loadSave(store).stock).toEqual({ 'dew-tonic': 1 });
    spendConsumableAt(store, 'dew-tonic');
    expect(loadSave(store).stock).toBeUndefined();
  });
});
