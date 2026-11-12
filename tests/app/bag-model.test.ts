import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { bagLeftOk, bagRows, firstFilled, nextSlot, spendFromBag, toggleBag, type BagPick } from '../../src/app/bag-model';
import { defaultSettings, loadSettings, saveSettings } from '../../src/app/settings';
import { BAG, CONSUMABLE_IDS, CONSUMABLES } from '../../src/data/consumables';
import { DIFFICULTIES } from '../../src/data/difficulty';

const EMPTY: BagPick = [null, null, null];

describe('the bag step: packing', () => {
  it('a confirm packs a kind in the first empty slot, a second one takes it out', () => {
    const one = toggleBag(EMPTY, 'dew-tonic');
    expect(one).toEqual(['dew-tonic', null, null]);
    expect(toggleBag(toggleBag(one, 'clear-salt'), 'dew-tonic')).toEqual([null, 'clear-salt', null]);
  });

  it('never more than BAG.slots kinds: a full bag refuses another', () => {
    const full = toggleBag(toggleBag(toggleBag(EMPTY, 'dew-tonic'), 'clear-salt'), 'wind-feather');
    expect(toggleBag(full, 'ember-dust')).toEqual(full);
    expect(full.filter(Boolean)).toHaveLength(BAG.slots);
  });
});

describe('the bag step: the rows', () => {
  it('lists every unlocked kind with its stock; locked kinds are not listed', () => {
    const rows = bagRows({ stock: { 'dew-tonic': 3 }, unlockedConsumables: ['hush-lantern'] }, EMPTY, 'normal');
    const ids = rows.map((r) => r.id);
    for (const id of CONSUMABLE_IDS) expect(ids.includes(id), id).toBe(CONSUMABLES[id].rarity === 'common' || id === 'hush-lantern');
    expect(rows.find((r) => r.id === 'dew-tonic')).toMatchObject({ stock: 3, packed: false, usable: true });
    expect(rows.find((r) => r.id === 'clear-salt')).toMatchObject({ stock: 0, usable: false });
  });

  it('the revive is listed but cannot go in on Nightmare (owner option 3b), every other tier it can', () => {
    for (const tier of DIFFICULTIES) {
      const row = bagRows({ stock: { 'second-sprout': 1 }, unlockedConsumables: ['second-sprout'] }, EMPTY, tier).find((r) => r.id === 'second-sprout')!;
      expect(row.usable, tier).toBe(tier !== 'nightmare');
    }
  });
});

describe('the bag step: remembered in the settings (the last bag packed)', () => {
  it('defaults to an empty bag and keeps known kinds only, once each, BAG.slots long', () => {
    expect(defaultSettings('es').bag).toEqual(EMPTY);
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings('es'), bag: ['dew-tonic', 'nope' as never, 'dew-tonic'] });
    expect(loadSettings(store, defaultSettings('es')).bag).toEqual(['dew-tonic', null, null]);
    store.set('mazmorra-sombria.settings', JSON.stringify({ bag: 'x' }));
    expect(loadSettings(store, defaultSettings('es')).bag).toEqual(EMPTY);
  });
});

describe('the bag in a stored run (reload-proof play)', () => {
  it('accepts a bag of known kinds within their slot size, refuses anything else', () => {
    expect(bagLeftOk([{ id: 'dew-tonic', count: 2 }, null, null])).toBe(true);
    expect(bagLeftOk([{ id: 'dew-tonic', count: 3 }, null, null])).toBe(false);
    expect(bagLeftOk([{ id: 'nope', count: 1 }])).toBe(false);
    expect(bagLeftOk([null, null, null, null])).toBe(false);
    expect(bagLeftOk('x')).toBe(false);
  });
});

describe('the bag in a run', () => {
  const bag = [{ id: 'dew-tonic' as const, count: 2 }, null, { id: 'second-sprout' as const, count: 1 }];

  it('the selection moves to the next or previous filled slot, wrapping; an empty bag stays put', () => {
    expect(nextSlot(bag, 0, 1)).toBe(2);
    expect(nextSlot(bag, 2, 1)).toBe(0);
    expect(nextSlot(bag, 0, -1)).toBe(2);
    expect(nextSlot([null, null, null], 1, 1)).toBe(1);
  });

  it('a unit used leaves its slot by kind (the slot empties at 0)', () => {
    expect(spendFromBag(bag, 'dew-tonic')).toEqual([{ id: 'dew-tonic', count: 1 }, null, { id: 'second-sprout', count: 1 }]);
    expect(spendFromBag(bag, 'second-sprout')).toEqual([{ id: 'dew-tonic', count: 2 }, null, null]);
    expect(spendFromBag(bag, 'exit-cord')).toEqual(bag);
  });

  it('the selection lands on a filled slot', () => {
    expect(firstFilled(bag)).toBe(0);
    expect(firstFilled([null, null, { id: 'exit-cord', count: 1 }])).toBe(2);
    expect(firstFilled([null, null, null])).toBe(0);
  });
});
