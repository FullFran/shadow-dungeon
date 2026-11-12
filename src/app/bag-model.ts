import { BAG, CONSUMABLE_IDS, CONSUMABLES, isConsumableId, type ConsumableId } from '../data/consumables';
import type { Difficulty } from '../data/difficulty';
import { isUnlocked, packable, stockOf, type BagSlot, type ConsumableWallet } from '../core/consumable-stock';

/**
 * The loadout's bag step (odd/tasks/items-bag.md), pure: the kinds the player picked for the next run (remembered in
 * the settings as `bag`, `BAG.slots` long, null = empty), the rows the step lists, and the check of a bag stored in a
 * run record. What a run really carries is `packBag` (core/consumable-stock.ts): the pick capped by the stock.
 */
export type BagPick = readonly (ConsumableId | null)[];

export const EMPTY_BAG: BagPick = Array.from({ length: BAG.slots }, () => null);

/** A confirm on `id`: out of the bag when it is in, else into the first empty slot (a full bag stays as it is). */
export function toggleBag(bag: BagPick, id: ConsumableId): (ConsumableId | null)[] {
  const slots = Array.from({ length: BAG.slots }, (_, i) => bag[i] ?? null);
  const at = slots.indexOf(id);
  if (at >= 0) {
    slots[at] = null;
    return slots;
  }
  const free = slots.indexOf(null);
  if (free >= 0) slots[free] = id;
  return slots;
}

/** A stored pick: known kinds, once each, `BAG.slots` long (anything else is empty). */
export function sanitizeBagPick(raw: unknown): (ConsumableId | null)[] {
  const seen = new Set<ConsumableId>();
  return Array.from({ length: BAG.slots }, (_, i) => {
    const id = Array.isArray(raw) ? raw[i] : null;
    if (!isConsumableId(id) || seen.has(id)) return null;
    seen.add(id);
    return id;
  });
}

export interface BagRow {
  id: ConsumableId;
  /** Units owned. */
  stock: number;
  packed: boolean;
  /** It can go in this run: owned, and allowed at the tier (never the revive on Nightmare). */
  usable: boolean;
}

/** The step's rows: every unlocked kind in table order, its stock, and whether it is packed and can be. */
export function bagRows(wallet: Pick<ConsumableWallet, 'stock' | 'unlockedConsumables'>, bag: BagPick, tier: Difficulty): BagRow[] {
  return CONSUMABLE_IDS.filter((id) => isUnlocked(wallet, id)).map((id) => {
    const stock = stockOf(wallet, id);
    return { id, stock, packed: bag.includes(id), usable: stock > 0 && packable(id, tier) };
  });
}

/** A bag stored in a run record (app/run-resume.ts): at most `BAG.slots` slots of known kinds within their slot size. */
export function bagLeftOk(raw: unknown): raw is (BagSlot | null)[] {
  if (!Array.isArray(raw) || raw.length > BAG.slots) return false;
  return raw.every((slot) => slot === null || (typeof slot === 'object' && isConsumableId((slot as BagSlot).id) && Number.isInteger((slot as BagSlot).count) && (slot as BagSlot).count >= 1 && (slot as BagSlot).count <= CONSUMABLES[(slot as BagSlot).id].perSlot));
}
