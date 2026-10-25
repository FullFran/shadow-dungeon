import { describe, expect, it } from 'vitest';
import { COINS } from '../../src/data/coins';
import { coinBreakdown, emptyTally, tallyFloor, tallyStep, type CoinTally } from '../../src/core/coins';

const MINUTE = 60_000;

/** A tally built from floors cleared (depth, escape ms or null), enemy depths and played time. */
function tally(floors: [number, number | null][], enemies: number[], playedMs: number): CoinTally {
  let out = emptyTally();
  for (const depth of enemies) out = tallyStep(out, { credited: [] }, { credited: ['e'], depth }, 0);
  for (const [depth, escape] of floors) out = tallyFloor(out, depth, escape);
  return tallyStep(out, { credited: [] }, { credited: [], depth: 1 }, playedMs);
}

describe('coin tally', () => {
  it('starts empty and pays nothing', () => {
    expect(coinBreakdown(emptyTally(), null).total).toBe(0);
  });

  it('counts each newly credited enemy once, at the depth it fell, and the played time', () => {
    let t = emptyTally();
    t = tallyStep(t, { credited: [] }, { credited: ['e1', 'e2'], depth: 2 }, 16);
    t = tallyStep(t, { credited: ['e1', 'e2'] }, { credited: ['e1', 'e2'], depth: 2 }, 16);
    t = tallyStep(t, { credited: ['e1', 'e2'] }, { credited: ['e1', 'e2', 'e3'], depth: 3 }, 16);
    expect(t.enemies).toEqual([2, 2, 3]);
    expect(t.playedMs).toBe(48);
  });

  it('records cleared floors and collapse escapes; does not mutate its input', () => {
    const start = emptyTally();
    const one = tallyFloor(start, 1, null);
    const two = tallyFloor(one, 2, 25_000);
    expect(start).toEqual(emptyTally());
    expect(two.floors).toEqual([1, 2]);
    expect(two.escapes).toEqual([25_000]);
  });
});

describe('coin breakdown', () => {
  it('pays per floor by depth, per enemy by depth, per minute and the guardian on victory', () => {
    const t = tally([[1, null], [2, null], [3, null]], [1, 1, 2, 3], 10 * MINUTE + 30_000);
    const win = coinBreakdown(t, 'victory');
    const floors = COINS.perFloor * (1 + 2 + 3);
    const enemies = Math.floor(COINS.perEnemy * (1 + 1 + (1 + COINS.perEnemyDepth) + (1 + 2 * COINS.perEnemyDepth)));
    expect(win.floors).toBe(floors);
    expect(win.enemies).toBe(enemies);
    expect(win.time).toBe(COINS.perMinute * 10);
    expect(win.guardian).toBe(COINS.guardian);
    expect(win.escapes).toBe(0);
    expect(win.subtotal).toBe(floors + enemies + COINS.perMinute * 10 + COINS.guardian);
    expect(win.total).toBe(win.subtotal);
  });

  it('pays more for a quicker collapse escape', () => {
    const quick = coinBreakdown(tally([[2, 10_000]], [], 0), null).escapes;
    const medium = coinBreakdown(tally([[2, 45_000]], [], 0), null).escapes;
    const slow = coinBreakdown(tally([[2, 200_000]], [], 0), null).escapes;
    expect(quick).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(slow);
    expect(slow).toBe(COINS.escapeSlow);
  });

  it('keeps a share on defeat, with no guardian bonus', () => {
    const t = tally([[1, null], [2, null]], [1, 2, 2], 4 * MINUTE);
    const lost = coinBreakdown(t, 'defeat');
    expect(lost.guardian).toBe(0);
    expect(lost.share).toBe(COINS.defeatShare);
    expect(lost.total).toBe(Math.floor(lost.subtotal * COINS.defeatShare));
    expect(lost.total).toBeLessThan(lost.subtotal);
  });

  it('grows with minutes played, not only per run', () => {
    const short = coinBreakdown(tally([[1, null]], [1], 2 * MINUTE), 'defeat').total;
    const long = coinBreakdown(tally([[1, null]], [1], 20 * MINUTE), 'defeat').total;
    expect(long).toBeGreaterThan(short);
  });

  it('multiplies by the difficulty', () => {
    const t = tally([[1, null], [2, null]], [1, 2], 3 * MINUTE);
    // Easy is the balance the game shipped with: it pays ×1, as the default always did.
    const easy = coinBreakdown(t, 'victory', 'easy');
    const hard = coinBreakdown(t, 'victory', 'hard');
    expect(easy.multiplier).toBe(1);
    expect(coinBreakdown(t, 'victory')).toEqual(easy);
    expect(hard.total).toBe(Math.floor(easy.subtotal * COINS.difficulty.hard));
  });

  it('is deterministic: the same tally gives the same breakdown', () => {
    const t = tally([[1, 20_000], [2, null]], [1, 1, 2], 7 * MINUTE);
    expect(coinBreakdown(t, 'defeat')).toEqual(coinBreakdown(t, 'defeat'));
  });

  it('pays half a guardian for a mid-boss floor cleared (Trevenant), kept on defeat with the share', () => {
    let t = tallyFloor(emptyTally(), 3, null);
    t = tallyFloor(t, 4, null, true);
    expect(t.midbosses).toBe(1);
    expect(COINS.midboss).toBe(COINS.guardian / 2);
    expect(coinBreakdown(t, null).guardian).toBe(COINS.midboss);
    expect(coinBreakdown(t, 'victory').guardian).toBe(COINS.guardian + COINS.midboss);
    const lost = coinBreakdown(t, 'defeat');
    expect(lost.guardian).toBe(COINS.midboss);
    expect(lost.total).toBe(Math.floor(lost.subtotal * COINS.defeatShare));
  });

  it('pays no mid-boss bonus for ordinary floors', () => {
    const t = tallyFloor(tallyFloor(emptyTally(), 1, null), 2, null, false);
    expect(t.midbosses).toBe(0);
    expect(coinBreakdown(t, 'defeat').guardian).toBe(0);
  });
});
