import { describe, expect, it } from 'vitest';
import { ACTIONS_LIVE_MAX_MS, countAt, countParts, countMsFor, endTimeline, isLive } from '../../src/app/end-choreography';

/** The end screen's entrance as data (owner, 2026-11-04): staggered tiles, a counting reward, actions live within 1.2 s, skippable, instant under reduced motion. */
describe('end choreography', () => {
  it('actions go live within 1.2 s for any number of tiles, with or without a seal and any reward', () => {
    for (const tiles of [0, 1, 3, 6, 8, 12]) {
      for (const seal of [false, true]) {
        for (const amount of [0, 5, 78, 640, 99_999]) {
          const tl = endTimeline({ tiles, seal, rewardAmount: amount, reduced: false });
          const at = `${tiles} ${seal} ${amount}`;
          expect(tl.actionsAt, at).toBeLessThanOrEqual(ACTIONS_LIVE_MAX_MS);
          expect(tl.tileAt, at).toHaveLength(tiles);
          expect(tl.sealAt === null, at).toBe(!seal);
          expect(tl.rewardsAt === null, at).toBe(amount === 0);
        }
      }
    }
  });

  it('orders the beats: veil, title, sprite, tiles (60 ms apart), reward count, then the actions', () => {
    const tl = endTimeline({ tiles: 6, seal: true, rewardAmount: 120, reduced: false });
    expect(tl.titleAt).toBeGreaterThan(tl.veilMs - 1);
    expect(tl.spriteAt).toBeGreaterThan(tl.titleAt);
    expect(tl.tileAt[0]!).toBeGreaterThan(tl.spriteAt);
    for (let i = 1; i < tl.tileAt.length; i++) expect(tl.tileAt[i]! - tl.tileAt[i - 1]!).toBe(60);
    expect(tl.sealAt!).toBeGreaterThan(tl.tileAt[5]!);
    expect(tl.rewardsAt!).toBeGreaterThan(tl.tileAt[0]!);
    expect(tl.actionsAt).toBeGreaterThanOrEqual(tl.rewardsAt! + tl.countMs);
  });

  it('the coin count lasts 300 to 800 ms and grows with the amount', () => {
    expect(countMsFor(0)).toBeGreaterThanOrEqual(300);
    expect(countMsFor(1_000_000)).toBe(800);
    expect(countMsFor(200)).toBeGreaterThan(countMsFor(10));
    for (const a of [1, 10, 100, 1000, 100_000]) {
      expect(countMsFor(a)).toBeGreaterThanOrEqual(300);
      expect(countMsFor(a)).toBeLessThanOrEqual(800);
    }
  });

  it('the count climbs from 0 to the exact amount and never overshoots', () => {
    let last = -1;
    for (let t = 0; t <= 800; t += 20) {
      const n = countAt(137, t, 500);
      expect(n).toBeGreaterThanOrEqual(last);
      expect(n).toBeLessThanOrEqual(137);
      last = n;
    }
    expect(countAt(137, 0, 500)).toBe(0);
    expect(countAt(137, 500, 500)).toBe(137);
    expect(countAt(137, 9_000, 500)).toBe(137);
  });

  it('reduced motion is instant: every beat at 0, the final count at once, actions live now', () => {
    const tl = endTimeline({ tiles: 6, seal: true, rewardAmount: 120, reduced: true });
    expect([tl.veilMs, tl.titleAt, tl.spriteAt, tl.sealAt, tl.rewardsAt, tl.actionsAt, tl.countMs]).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(tl.tileAt.every((t) => t === 0)).toBe(true);
    expect(countAt(120, 0, tl.countMs)).toBe(120);
    expect(isLive(tl, 0, false)).toBe(true);
  });

  it('any key or click skips to the final state: the actions are live before their time only when skipped', () => {
    const tl = endTimeline({ tiles: 6, seal: false, rewardAmount: 50, reduced: false });
    expect(isLive(tl, tl.actionsAt - 1, false)).toBe(false);
    expect(isLive(tl, tl.actionsAt, false)).toBe(true);
    expect(isLive(tl, 10, true)).toBe(true);
  });

  it('splits a figure around its number so the number can count', () => {
    expect(countParts('+42 P', 42)).toEqual(['+', ' P']);
    expect(countParts('100 P', 100)).toEqual(['', ' P']);
    expect(countParts('+42 P', 7)).toBeNull();
  });
});
