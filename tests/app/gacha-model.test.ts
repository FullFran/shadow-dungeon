import { describe, expect, it } from 'vitest';
import { collectionStrip, pityView, pullState, revealPlan } from '../../src/app/gacha-model';
import { EMPTY_SAVE } from '../../src/app/save';
import type { PullResult } from '../../src/core/gacha';
import { GACHA, GACHA_POOL } from '../../src/data/gacha';
import { catalog, LANGUAGES } from '../../src/i18n';

const result = (over: Partial<PullResult> = {}): PullResult => ({ species: 'piplup', rarity: 'common', duplicate: false, refund: 0, shiny: false, ...over });

/** The gacha page's pure model (odd/tasks/gacha-page.md): reveal order and timing, pity, collection, pull state. */
describe('reveal plan', () => {
  it('lists one step per result in pull order, each told apart as new or duplicate', () => {
    const plan = revealPlan([result(), result({ species: 'abra', rarity: 'rare', duplicate: true, refund: 40 })], false);
    expect(plan.steps.map((s) => s.result.species)).toEqual(['piplup', 'abra']);
    expect(plan.steps.map((s) => s.kind)).toEqual(['new', 'duplicate']);
    expect(plan.steps.map((s) => s.index)).toEqual([0, 1]);
  });

  it('holds longer for a rare and longer still for a shiny (anticipation before payoff)', () => {
    const crack = (r: PullResult) => revealPlan([r], false).steps[0]!.crackMs;
    expect(crack(result({ rarity: 'rare' }))).toBeGreaterThan(crack(result()));
    expect(crack(result({ rarity: 'rare', shiny: true }))).toBeGreaterThan(crack(result({ rarity: 'rare' })));
    expect(crack(result())).toBeGreaterThan(0);
  });

  it('reveals a ten one by one: each starts after the one before, the total is the last end', () => {
    const plan = revealPlan(Array.from({ length: 10 }, (_, i) => result({ rarity: i === 9 ? 'rare' : 'common' })), false);
    for (let i = 1; i < plan.steps.length; i++) expect(plan.steps[i]!.startMs).toBeGreaterThan(plan.steps[i - 1]!.startMs);
    expect(plan.steps[0]!.startMs).toBe(0);
    expect(plan.totalMs).toBe(Math.max(...plan.steps.map((s) => s.endMs)));
    expect(plan.totalMs).toBeGreaterThan(0);
    for (const s of plan.steps) expect(s.endMs).toBe(s.startMs + s.crackMs + s.cardMs);
  });

  it('with reduced motion everything is instant', () => {
    const plan = revealPlan([result(), result({ rarity: 'rare', shiny: true })], true);
    expect(plan.totalMs).toBe(0);
    for (const s of plan.steps) expect([s.startMs, s.crackMs, s.cardMs, s.endMs]).toEqual([0, 0, 0, 0]);
  });

  it('sums the pulls: new, repeated, the refund, the rares and the shinies', () => {
    const plan = revealPlan([result(), result({ duplicate: true, refund: GACHA.duplicateRefund }), result({ species: 'abra', rarity: 'rare', shiny: true }), result({ duplicate: true, refund: GACHA.duplicateRefund })], false);
    expect(plan.summary).toEqual({ total: 4, fresh: 2, duplicates: 2, refund: 2 * GACHA.duplicateRefund, rares: 1, shinies: 1 });
  });
});

describe('pity view', () => {
  it('counts the pulls since the last rare and the last shiny, and says when the next one is sure', () => {
    const view = pityView({ ...EMPTY_SAVE, pity: 3, shinyPity: 10 });
    expect(view.rare).toEqual({ filled: 3, total: GACHA.hardPity, left: GACHA.hardPity - 3, nextSure: false });
    expect(view.shiny).toEqual({ filled: 10, total: GACHA.shinyPity, left: GACHA.shinyPity - 10, nextSure: false });
    expect(pityView({ ...EMPTY_SAVE, pity: GACHA.hardPity - 1 }).rare.nextSure).toBe(true);
    expect(pityView(EMPTY_SAVE).rare).toEqual({ filled: 0, total: GACHA.hardPity, left: GACHA.hardPity, nextSure: false });
  });
});

describe('collection strip', () => {
  it('lists every species the stall sells, owned when any form of its line is', () => {
    const strip = collectionStrip({ ...EMPTY_SAVE, owned: ['kadabra', 'luxio'], shinies: ['shinx'] });
    expect(strip.map((e) => e.species)).toEqual(GACHA_POOL.map((e) => e.species));
    expect(Object.fromEntries(strip.map((e) => [e.species, e.owned]))).toEqual({ piplup: false, shinx: true, abra: true, axew: false });
    expect(Object.fromEntries(strip.map((e) => [e.species, e.shiny]))).toEqual({ piplup: false, shinx: true, abra: false, axew: false });
  });
});

describe('pull state', () => {
  it('prices x1 and x10 and says how many Pokémonedas are missing', () => {
    expect(pullState({ ...EMPTY_SAVE, coins: 1000 }, 10)).toEqual({ cost: 10 * GACHA.cost, canPull: true, missing: 0 });
    expect(pullState({ ...EMPTY_SAVE, coins: 250 }, 10)).toEqual({ cost: 10 * GACHA.cost, canPull: false, missing: 10 * GACHA.cost - 250 });
    expect(pullState({ ...EMPTY_SAVE, coins: GACHA.cost }, 1).canPull).toBe(true);
  });
});

describe('gacha page text', () => {
  it('has every key in both languages, without em dashes', () => {
    for (const language of LANGUAGES) {
      const keys = Object.keys(catalog(language)).filter((k) => k.startsWith('gacha.page.'));
      expect(keys.length, language).toBeGreaterThan(20);
      for (const k of keys) expect(catalog(language)[k], k).not.toContain('—');
    }
  });
});
