import { describe, expect, it } from 'vitest';
import { BAG, CONSUMABLE_IDS, CONSUMABLES, ITEM_GACHA, STARTER_CONSUMABLES, type ConsumableId } from '../../src/data/consumables';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { bagAllowed, buyConsumable, isUnlocked, itemPull, packBag, packable, spendUnit, type ConsumableWallet } from '../../src/core/consumable-stock';

const rich = (extra: Partial<ConsumableWallet> = {}): ConsumableWallet => ({ coins: 100_000, ...extra });

/** Pulls `n` times from `wallet`, threading the seeded RNG. */
function pulls(wallet: ConsumableWallet, n: number, seed = 7) {
  let state = wallet;
  let rng = seed;
  const results = [];
  for (let i = 0; i < n; i++) {
    const out = itemPull(state, rng)!;
    results.push(out.result);
    state = out.state;
    rng = out.rng;
  }
  return { state, results };
}

describe('consumable stock: unlocks (owner option 1a)', () => {
  it('the commons are unlocked from the start, the others are not', () => {
    for (const id of CONSUMABLE_IDS) expect(isUnlocked({}, id), id).toBe(CONSUMABLES[id].rarity === 'common');
    expect(STARTER_CONSUMABLES.length).toBeGreaterThan(0);
  });
});

describe('consumable stock: the item gacha', () => {
  it('costs ITEM_GACHA.cost and refuses without the Pokémonedas', () => {
    expect(itemPull({ coins: ITEM_GACHA.cost - 1 }, 1)).toBeNull();
    const out = itemPull({ coins: ITEM_GACHA.cost }, 1)!;
    expect(out.state.coins).toBe(out.result.refund);
  });

  it('is deterministic for the same wallet and seed', () => {
    expect(itemPull(rich(), 42)).toEqual(itemPull(rich(), 42));
  });

  it('pays an uncommon or better by the uncommonPity-th pull, whatever the seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { results } = pulls(rich(), ITEM_GACHA.uncommonPity, seed);
      expect(results.some((r) => r.rarity !== 'common'), `seed ${seed}`).toBe(true);
    }
  });

  it('pays a rare by the rarePity-th pull, whatever the seed', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { results } = pulls(rich(), ITEM_GACHA.rarePity, seed);
      expect(results.some((r) => r.rarity === 'rare'), `seed ${seed}`).toBe(true);
    }
  });

  it('a common pays units of an unlocked common kind; an uncommon or rare unlocks its kind', () => {
    const { state, results } = pulls(rich(), 60);
    for (const r of results) {
      expect(CONSUMABLES[r.id].rarity).toBe(r.rarity);
      if (r.rarity === 'common') expect(r.units).toBeGreaterThanOrEqual(ITEM_GACHA.commonUnits[0]);
      if (r.rarity !== 'common') expect(isUnlocked(state, r.id)).toBe(true);
    }
  });

  it('a pity counter resets on its rarity and counts otherwise', () => {
    const out = itemPull(rich({ itemPity: ITEM_GACHA.uncommonPity - 1 }), 3)!;
    expect(out.result.rarity).not.toBe('common');
    expect(out.state.itemPity ?? 0).toBe(0);
    const rare = itemPull(rich({ itemRarePity: ITEM_GACHA.rarePity - 1 }), 3)!;
    expect(rare.result.rarity).toBe('rare');
    expect(rare.state.itemRarePity ?? 0).toBe(0);
    expect(rare.state.itemPity ?? 0).toBe(0);
  });

  it('units over the stock cap refund ITEM_GACHA.overflowRefund each', () => {
    const full = Object.fromEntries(CONSUMABLE_IDS.map((id) => [id, BAG.stockCap])) as Record<ConsumableId, number>;
    const unlocked = [...CONSUMABLE_IDS];
    const out = itemPull(rich({ stock: full, unlockedConsumables: unlocked }), 9)!;
    expect(out.state.stock?.[out.result.id]).toBe(BAG.stockCap);
    expect(out.result.refund).toBe(out.result.units * ITEM_GACHA.overflowRefund);
    expect(out.state.coins).toBe(100_000 - ITEM_GACHA.cost + out.result.refund);
  });
});

describe('consumable stock: fixed-price rows (owner option 1a)', () => {
  it('sells an unlocked kind at its price, one unit', () => {
    const out = buyConsumable<ConsumableWallet>({ coins: 50 }, 'dew-tonic')!;
    expect(out.coins).toBe(50 - CONSUMABLES['dew-tonic'].price);
    expect(out.stock?.['dew-tonic']).toBe(1);
  });

  it('refuses a locked kind, a short balance and a full stock', () => {
    expect(buyConsumable({ coins: 500 }, 'hush-lantern')).toBeNull();
    expect(buyConsumable({ coins: 5 }, 'dew-tonic')).toBeNull();
    expect(buyConsumable({ coins: 500, stock: { 'dew-tonic': BAG.stockCap } }, 'dew-tonic')).toBeNull();
    expect(buyConsumable<ConsumableWallet>({ coins: 500, unlockedConsumables: ['hush-lantern'] }, 'hush-lantern')?.stock?.['hush-lantern']).toBe(1);
  });
});

describe('consumable stock: the bag', () => {
  it('packs up to BAG.slots kinds, each at most its per-slot units and what the stock holds, once each', () => {
    const bag = packBag(['dew-tonic', 'dew-tonic', 'clear-salt', 'ember-dust'], { 'dew-tonic': 5, 'clear-salt': 1 }, 'normal');
    expect(bag).toHaveLength(BAG.slots);
    expect(bag[0]).toEqual({ id: 'dew-tonic', count: CONSUMABLES['dew-tonic'].perSlot });
    expect(bag[1]).toBeNull();
    expect(bag[2]).toEqual({ id: 'clear-salt', count: 1 });
  });

  it('the revive never goes in a Nightmare bag (owner option 3b), and goes in every other tier', () => {
    for (const tier of DIFFICULTIES) {
      expect(packable('second-sprout', tier), tier).toBe(tier !== 'nightmare');
      const bag = packBag(['second-sprout'], { 'second-sprout': 1 }, tier);
      expect(bag[0] === null, tier).toBe(tier === 'nightmare');
    }
  });

  it('there is no bag in the Shrine (owner option 4a); runs, challenges and the Sima have one', () => {
    expect(bagAllowed({ trial: true })).toBe(false);
    expect(bagAllowed({ trial: false })).toBe(true);
  });

  it('a used unit leaves the stock; nothing else does (owner option 2a)', () => {
    expect(spendUnit({ 'dew-tonic': 3 }, 'dew-tonic')).toEqual({ 'dew-tonic': 2 });
    expect(spendUnit({ 'dew-tonic': 1, 'clear-salt': 2 }, 'dew-tonic')).toEqual({ 'clear-salt': 2 });
    expect(spendUnit({}, 'dew-tonic')).toEqual({});
  });
});
