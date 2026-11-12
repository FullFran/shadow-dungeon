import { BAG, CONSUMABLE_IDS, CONSUMABLES, ITEM_GACHA, STARTER_CONSUMABLES, type ConsumableId } from '../data/consumables';
import type { Rarity } from '../data/items';
import type { Difficulty } from '../data/difficulty';
import { nextRandom } from './rng';

/**
 * The consumables a player owns between runs (odd/tasks/items-bag.md), pure: the stock per kind, the kinds unlocked,
 * the item gacha's pull and pity, the fixed-price rows and the bag packed before a run. The save holds the fields
 * (app/save.ts); every rule is here so the windows and the run only call it.
 */
export type ConsumableStock = Partial<Record<ConsumableId, number>>;

export interface ConsumableWallet {
  coins: number;
  /** Units per kind (absent = none). */
  stock?: ConsumableStock;
  /** Kinds unlocked beyond the commons (absent = none). */
  unlockedConsumables?: readonly ConsumableId[];
  /** Item gacha pulls since the last uncommon or better (absent = 0). */
  itemPity?: number;
  /** Item gacha pulls since the last rare (absent = 0). */
  itemRarePity?: number;
}

/** One bag slot: a kind and the units packed in it. */
export interface BagSlot {
  id: ConsumableId;
  count: number;
}
export type Bag = readonly (BagSlot | null)[];

export const stockOf = (wallet: Pick<ConsumableWallet, 'stock'>, id: ConsumableId): number => wallet.stock?.[id] ?? 0;

/** The commons from the start; the rest once the gacha gave them. */
export const isUnlocked = (wallet: Pick<ConsumableWallet, 'unlockedConsumables'>, id: ConsumableId): boolean => STARTER_CONSUMABLES.includes(id) || (wallet.unlockedConsumables ?? []).includes(id);

/** The stock with `delta` units of `id` (kept within 0..cap; a kind at 0 is dropped). */
function withUnits(stock: ConsumableStock | undefined, id: ConsumableId, units: number): ConsumableStock {
  const next: ConsumableStock = { ...stock };
  if (units > 0) next[id] = Math.min(BAG.stockCap, units);
  else delete next[id];
  return next;
}

/** A used unit leaves the stock (owner's option 2a: nothing else does). */
export const spendUnit = (stock: ConsumableStock | undefined, id: ConsumableId): ConsumableStock => withUnits(stock, id, (stock?.[id] ?? 0) - 1);

export interface ItemPullResult {
  id: ConsumableId;
  rarity: Rarity;
  /** Units the pull gave (some may have come back as `refund`). */
  units: number;
  /** The kind was locked before this pull. */
  unlocked: boolean;
  /** Pokémonedas back for the units over the stock cap. */
  refund: number;
}

const pick = <T>(pool: readonly T[], roll: number): T => pool[Math.min(pool.length - 1, Math.floor(roll * pool.length))]!;

/**
 * One item gacha pull (data/consumables.ts `ITEM_GACHA`), pure and seeded: three rolls in a fixed order (rarity, kind,
 * units). Null (nothing changes) without the Pokémonedas.
 */
export function itemPull<W extends ConsumableWallet>(wallet: W, rng: number): { result: ItemPullResult; state: W; rng: number } | null {
  if (wallet.coins < ITEM_GACHA.cost) return null;
  const rarityRoll = nextRandom(rng);
  const kindRoll = nextRandom(rarityRoll.state);
  const unitsRoll = nextRandom(kindRoll.state);
  const pity = wallet.itemPity ?? 0;
  const rarePity = wallet.itemRarePity ?? 0;
  const { rates } = ITEM_GACHA;
  const rarity: Rarity =
    rarePity + 1 >= ITEM_GACHA.rarePity || rarityRoll.value < rates.rare ? 'rare' : pity + 1 >= ITEM_GACHA.uncommonPity || rarityRoll.value < rates.rare + rates.uncommon ? 'uncommon' : 'common';
  const ofRarity = CONSUMABLE_IDS.filter((id) => CONSUMABLES[id].rarity === rarity);
  // A rare goes to a kind still locked while there is one; then it pays a unit of any rare.
  const locked = ofRarity.filter((id) => !isUnlocked(wallet, id));
  const id = pick(rarity === 'rare' && locked.length > 0 ? locked : ofRarity, kindRoll.value);
  const span = rarity === 'common' ? ITEM_GACHA.commonUnits : rarity === 'uncommon' ? ITEM_GACHA.uncommonUnits : [ITEM_GACHA.rareUnits, ITEM_GACHA.rareUnits];
  const units = span[0] + Math.floor(unitsRoll.value * (span[1] - span[0] + 1));
  const have = stockOf(wallet, id);
  const kept = Math.min(units, BAG.stockCap - have);
  const refund = (units - kept) * ITEM_GACHA.overflowRefund;
  const unlocked = !isUnlocked(wallet, id);
  const state: W = {
    ...wallet,
    coins: wallet.coins - ITEM_GACHA.cost + refund,
    stock: withUnits(wallet.stock, id, have + kept),
    ...(unlocked ? { unlockedConsumables: [...(wallet.unlockedConsumables ?? []), id] } : {}),
    itemPity: rarity === 'common' ? pity + 1 : 0,
    itemRarePity: rarity === 'rare' ? 0 : rarePity + 1,
  };
  return { result: { id, rarity, units, unlocked, refund }, state, rng: unitsRoll.state };
}

/** One unit of an unlocked kind at its fixed price; null when locked, short or at the stock cap. */
export function buyConsumable<W extends ConsumableWallet>(wallet: W, id: ConsumableId): W | null {
  const price = CONSUMABLES[id].price;
  if (!isUnlocked(wallet, id) || wallet.coins < price || stockOf(wallet, id) >= BAG.stockCap) return null;
  return { ...wallet, coins: wallet.coins - price, stock: withUnits(wallet.stock, id, stockOf(wallet, id) + 1) };
}

/** Whether a kind may be packed for a run at `tier`: the revive never on Nightmare (owner's option 3b). */
export const packable = (id: ConsumableId, tier: Difficulty): boolean => !(id === 'second-sprout' && tier === 'nightmare');

/** Whether a run has a bag at all: the Shrine's trials never do (owner's option 4a; they stay "without items"). */
export const bagAllowed = (run: { trial: boolean }): boolean => !run.trial;

/**
 * The bag a run starts with: the kinds the player picked (`wanted`, one per slot, the last packed), each once, as many
 * units as a slot holds and the stock has, only those packable at `tier`. Always `BAG.slots` long (null = empty slot).
 */
export function packBag(wanted: readonly (ConsumableId | null)[], stock: ConsumableStock | undefined, tier: Difficulty): (BagSlot | null)[] {
  const seen = new Set<ConsumableId>();
  return Array.from({ length: BAG.slots }, (_, i) => {
    const id = wanted[i] ?? null;
    if (!id || seen.has(id) || !packable(id, tier)) return null;
    const count = Math.min(CONSUMABLES[id].perSlot, stock?.[id] ?? 0);
    if (count <= 0) return null;
    seen.add(id);
    return { id, count };
  });
}

/** The bag after one unit of slot `index` was used (the slot empties at 0). */
export function takeFromBag(bag: Bag, index: number): (BagSlot | null)[] {
  return bag.map((slot, i) => (i !== index || !slot ? slot : slot.count > 1 ? { ...slot, count: slot.count - 1 } : null));
}

/** The bag after one unit of `id` was used, wherever it is packed (unchanged when it is not). */
export function spendFromBag(bag: Bag, id: ConsumableId): (BagSlot | null)[] {
  const at = bag.findIndex((slot) => slot?.id === id);
  return at < 0 ? [...bag] : takeFromBag(bag, at);
}
