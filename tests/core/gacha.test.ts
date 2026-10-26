import { describe, expect, it } from 'vitest';
import type { Collection } from '../../src/core/collection';
import { lineOf } from '../../src/core/evolution';
import { pull } from '../../src/core/gacha';
import { seedRng } from '../../src/core/rng';
import { GACHA, GACHA_POOL } from '../../src/data/gacha';
import { isPlayable, isStarter } from '../../src/data/species';

const rich = (coins = 100_000): Collection => ({ coins });

/** `n` pulls in a row from `state`, or as many as the coins allow. */
function pulls(state: Collection, rng: number, n: number) {
  const results = [];
  for (let i = 0; i < n; i++) {
    const next = pull(state, rng);
    if (!next) break;
    results.push(next.result);
    state = next.state;
    rng = next.rng;
  }
  return { results, state };
}

describe('gacha: data', () => {
  it('pools the first forms of the lines, common and rare, and refunds less than a pull', () => {
    for (const { species } of GACHA_POOL) expect(isPlayable(species) && !isStarter(species) && lineOf(species) === species, species).toBe(true);
    expect(GACHA_POOL.some((e) => e.rarity === 'common')).toBe(true);
    expect(GACHA_POOL.some((e) => e.rarity === 'rare')).toBe(true);
    expect(GACHA.cost).toBe(100);
    expect(GACHA.rareRate).toBeGreaterThan(0);
    expect(GACHA.rareRate).toBeLessThan(1);
    expect(GACHA.duplicateRefund).toBeGreaterThan(0);
    expect(GACHA.duplicateRefund).toBeLessThan(GACHA.cost);
  });
});

describe('gacha: a pull', () => {
  it('is the same for the same seed and state', () => {
    for (const seed of [1, 2, 99]) expect(pulls(rich(), seedRng(seed), 30)).toEqual(pulls(rich(), seedRng(seed), 30));
  });

  it('costs its Pokémonedas and adds a new species to the collection', () => {
    const next = pull(rich(500), seedRng(3))!;
    expect(next.result.duplicate).toBe(false);
    expect(next.state.coins).toBe(500 - GACHA.cost);
    expect(next.state.owned).toEqual([next.result.species]);
  });

  it('never pulls without the Pokémonedas', () => {
    expect(pull({ coins: GACHA.cost - 1 }, seedRng(1))).toBeNull();
  });

  it('refunds a duplicate (any form of an owned line) and keeps the collection as it was', () => {
    for (const { species } of GACHA_POOL) {
      const evolved = GACHA_POOL.map((e) => e.species).filter((s) => s !== species);
      // Every line owned, this one already evolved: whatever comes out is a duplicate.
      const state: Collection = { coins: 1000, owned: [...evolved, species === 'abra' ? 'kadabra' : species] };
      const next = pull(state, seedRng(7))!;
      expect(next.result.duplicate).toBe(true);
      expect(next.result.refund).toBe(GACHA.duplicateRefund);
      expect(next.state.coins).toBe(1000 - GACHA.cost + GACHA.duplicateRefund);
      expect(next.state.owned).toEqual(state.owned);
    }
  });

  it('a rare resets the pity, anything else adds one', () => {
    const { results, state } = pulls(rich(), seedRng(5), 40);
    let pity = 0;
    for (const r of results) pity = r.rarity === 'rare' ? 0 : pity + 1;
    expect(state.pity ?? 0).toBe(pity);
  });

  it(`guarantees a rare within ${GACHA.hardPity} pulls, on every seed`, () => {
    for (let seed = 0; seed < 500; seed++) {
      const { results } = pulls(rich(), seedRng(seed), 200);
      let since = 0;
      for (const r of results) {
        since = r.rarity === 'rare' ? 0 : since + 1;
        expect(since, `seed ${seed}`).toBeLessThan(GACHA.hardPity);
      }
    }
  });

  it('gives rares near their rate over many pulls', () => {
    const { results } = pulls(rich(10_000_000), seedRng(11), 20_000);
    const share = results.filter((r) => r.rarity === 'rare').length / results.length;
    // The pity lifts the real rate a little above the base rate.
    expect(share).toBeGreaterThan(GACHA.rareRate * 0.9);
    expect(share).toBeLessThan(GACHA.rareRate * 1.6);
  });
});
