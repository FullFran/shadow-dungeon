import { BAG, CONSUMABLE_IDS, CONSUMABLES, ITEM_GACHA, type ConsumableId } from '../data/consumables';
import type { Rarity } from '../data/items';
import { isUnlocked, stockOf, type ConsumableWallet } from '../core/consumable-stock';

/** What the item stall shows (app/item-stall.ts), pure: the pull's price, the odds and the pulls left to each pity. */
export interface ItemStallInfo {
  cost: number;
  canPull: boolean;
  rates: { rarity: Rarity; percent: number }[];
  /** Pulls until an uncommon or better is sure. */
  uncommonLeft: number;
  /** Pulls until a rare is sure. */
  rareLeft: number;
}

export function itemStallInfo(wallet: ConsumableWallet): ItemStallInfo {
  const { rates } = ITEM_GACHA;
  return {
    cost: ITEM_GACHA.cost,
    canPull: wallet.coins >= ITEM_GACHA.cost,
    rates: (['common', 'uncommon', 'rare'] as const).map((rarity) => ({ rarity, percent: Math.round(rates[rarity] * 100) })),
    uncommonLeft: ITEM_GACHA.uncommonPity - (wallet.itemPity ?? 0),
    rareLeft: ITEM_GACHA.rarePity - (wallet.itemRarePity ?? 0),
  };
}

export interface StallShopRow {
  id: ConsumableId;
  price: number;
  stock: number;
  /** At the stock cap: nothing more can be bought. */
  full: boolean;
  affordable: boolean;
}

/** The fixed-price rows: every unlocked kind in table order (owner's option 1a: the gacha unlocks, the rows sell). */
export function shopRowsOf(wallet: ConsumableWallet): StallShopRow[] {
  return CONSUMABLE_IDS.filter((id) => isUnlocked(wallet, id)).map((id) => {
    const stock = stockOf(wallet, id);
    const full = stock >= BAG.stockCap;
    return { id, price: CONSUMABLES[id].price, stock, full, affordable: !full && wallet.coins >= CONSUMABLES[id].price };
  });
}
