import { describe, expect, it } from 'vitest';
import { CARD_RULES } from '../../src/data/cards';
import { captureAward, cardEnd, cardHpFloor, cardSegment, emptyCapture, timeoutHp, trackCapture } from '../../src/core/cards';

describe('spell-card HP segments', () => {
  it('splits the bar into equal segments, the last one ending at 0', () => {
    expect([0, 1, 2, 3].map((i) => cardHpFloor(1000, i, 4))).toEqual([750, 500, 250, 0]);
    expect(cardSegment(1000, 1000, 4)).toBe(0);
    expect(cardSegment(751, 1000, 4)).toBe(0);
    expect(cardSegment(750, 1000, 4)).toBe(1);
    expect(cardSegment(1, 1000, 4)).toBe(3);
    expect(cardSegment(0, 1000, 4)).toBe(3);
  });

  it('a card ends when its segment is emptied (hp) or its timer runs out (timeout); hp wins a tie', () => {
    expect(cardEnd({ hp: 800, maxHp: 1000, index: 0, count: 4, elapsedMs: 100, timerMs: 30_000 })).toBeNull();
    expect(cardEnd({ hp: 750, maxHp: 1000, index: 0, count: 4, elapsedMs: 100, timerMs: 30_000 })).toBe('hp');
    expect(cardEnd({ hp: 800, maxHp: 1000, index: 0, count: 4, elapsedMs: 30_000, timerMs: 30_000 })).toBe('timeout');
    expect(cardEnd({ hp: 700, maxHp: 1000, index: 0, count: 4, elapsedMs: 30_000, timerMs: 30_000 })).toBe('hp');
  });

  it('a timeout drops the HP to the segment floor (never below 0); the last card falls', () => {
    expect(timeoutHp(1000, 0, 4)).toBe(750);
    expect(timeoutHp(1000, 3, 4)).toBe(0);
  });
});

describe('capture tracking (per player, from the card in play)', () => {
  it('a card cleared before its timer without a hit is captured; a hit or a timeout is not', () => {
    let t = emptyCapture();
    // Card A starts.
    let r = trackCapture(t, { card: 'a', nowMs: 0, hurt: false, timerMs: 20_000 });
    expect(r.award).toBeNull();
    // Card B starts at 9 s: A was cleared, no hit.
    r = trackCapture(r.tracker, { card: 'b', nowMs: 9000, hurt: false, timerMs: 20_000 });
    expect(r.award).toEqual({ card: 'a', outcome: 'captured' });
    // A hit during B.
    r = trackCapture(r.tracker, { card: 'b', nowMs: 10_000, hurt: true, timerMs: 20_000 });
    expect(r.award).toBeNull();
    r = trackCapture(r.tracker, { card: 'c', nowMs: 12_000, hurt: false, timerMs: 20_000 });
    expect(r.award).toEqual({ card: 'b', outcome: 'cleared' });
    // C runs out its timer.
    r = trackCapture(r.tracker, { card: 'd', nowMs: 12_000 + 20_000, hurt: false, timerMs: 20_000 });
    expect(r.award).toEqual({ card: 'c', outcome: 'timeout' });
    // The boss falls during D (no card any more): D is judged too.
    r = trackCapture(r.tracker, { card: null, nowMs: 40_000, hurt: false, timerMs: 0 });
    expect(r.award).toEqual({ card: 'd', outcome: 'captured' });
    t = r.tracker;
    expect(trackCapture(t, { card: null, nowMs: 41_000, hurt: false, timerMs: 0 }).award).toBeNull();
  });

  it('pays coins only for captures', () => {
    expect(captureAward('captured')).toBe(CARD_RULES.captureCoins);
    expect(captureAward('cleared')).toBe(0);
    expect(captureAward('timeout')).toBe(0);
  });
});
