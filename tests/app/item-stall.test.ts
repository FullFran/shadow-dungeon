import { describe, expect, it } from 'vitest';
import { itemStallInfo, shopRowsOf } from '../../src/app/item-stall-model';
import { BAG, CONSUMABLE_IDS, CONSUMABLES, ITEM_GACHA } from '../../src/data/consumables';

describe('the item stall (odd/tasks/items-bag.md)', () => {
  it('shows the price, the odds per rarity (summing to 100) and the pulls left to each pity', () => {
    const info = itemStallInfo({ coins: 120, itemPity: 2, itemRarePity: 10 });
    expect(info.cost).toBe(ITEM_GACHA.cost);
    expect(info.canPull).toBe(true);
    expect(info.rates.map((r) => r.percent).reduce((a, b) => a + b, 0)).toBe(100);
    expect(info.uncommonLeft).toBe(ITEM_GACHA.uncommonPity - 2);
    expect(info.rareLeft).toBe(ITEM_GACHA.rarePity - 10);
    expect(itemStallInfo({ coins: ITEM_GACHA.cost - 1 }).canPull).toBe(false);
  });

  it('sells every unlocked kind at its fixed price, never a locked one (owner option 1a)', () => {
    const rows = shopRowsOf({ coins: 30, stock: { 'dew-tonic': BAG.stockCap }, unlockedConsumables: ['exit-cord'] });
    for (const id of CONSUMABLE_IDS) {
      const row = rows.find((r) => r.id === id);
      if (CONSUMABLES[id].rarity === 'common' || id === 'exit-cord') expect(row?.price, id).toBe(CONSUMABLES[id].price);
      else expect(row, id).toBeUndefined();
    }
    expect(rows.find((r) => r.id === 'dew-tonic')).toMatchObject({ full: true, affordable: false });
    expect(rows.find((r) => r.id === 'clear-salt')).toMatchObject({ full: false, affordable: true });
    expect(rows.find((r) => r.id === 'exit-cord')).toMatchObject({ affordable: false });
  });
});
