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

describe('gacha: shiny (odd/tasks/shiny-echo.md)', () => {
  it('has a rare shiny chance and its own, longer pity', () => {
    expect(GACHA.shinyRate).toBe(0.025);
    expect(GACHA.shinyPity).toBe(80);
  });

  it(`guarantees a shiny within ${GACHA.shinyPity} pulls, on every seed, and counts its own pity`, () => {
    for (let seed = 0; seed < 200; seed++) {
      const { results, state } = pulls(rich(), seedRng(seed), 400);
      let since = 0;
      for (const r of results) {
        since = r.shiny ? 0 : since + 1;
        expect(since, `seed ${seed}`).toBeLessThan(GACHA.shinyPity);
      }
      expect(state.shinyPity ?? 0, `seed ${seed}`).toBe(since);
    }
  });

  it('gives shinies near their rate over many pulls', () => {
    const { results } = pulls(rich(10_000_000), seedRng(13), 40_000);
    const share = results.filter((r) => r.shiny).length / results.length;
    expect(share).toBeGreaterThan(GACHA.shinyRate * 0.9);
    expect(share).toBeLessThan(GACHA.shinyRate * 1.4);
  });

  it('a shiny unlocks (and wears) its line skin, even on a duplicate that still refunds', () => {
    // Every line owned and the pity at its last pull: the next pull is a shiny duplicate, whatever the seed.
    for (let seed = 0; seed < 20; seed++) {
      const state: Collection = { coins: 1000, owned: GACHA_POOL.map((e) => e.species), shinyPity: GACHA.shinyPity - 1 };
      const next = pull(state, seedRng(seed))!;
      expect(next.result.shiny).toBe(true);
      expect(next.result.duplicate).toBe(true);
      expect(next.state.coins).toBe(1000 - GACHA.cost + GACHA.duplicateRefund);
      expect(next.state.shinies).toEqual([lineOf(next.result.species)]);
      expect(next.state.shinyWorn).toEqual([lineOf(next.result.species)]);
      expect(next.state.shinyPity ?? 0).toBe(0);
    }
  });

  it('a shiny of a line already unlocked changes no skin', () => {
    const owned = GACHA_POOL.map((e) => e.species);
    const state: Collection = { coins: 1000, owned, shinies: owned, shinyWorn: [], shinyPity: GACHA.shinyPity - 1 };
    const next = pull(state, seedRng(1))!;
    expect(next.result.shiny).toBe(true);
    expect(next.state.shinies).toEqual(owned);
    expect(next.state.shinyWorn).toEqual([]);
  });
});
