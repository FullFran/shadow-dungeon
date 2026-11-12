import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NOTICE_LIFE_MS, pickWaits, type BossNotice } from '../../src/ui/boss-notice';

/** The boss falls: "¡JEFE DERROTADO!" first, its last lines next, the item pick last (owner, 2026-11-12). */
const notice = (kind: BossNotice['kind'], shownAtMs: number): BossNotice => ({ kind, heading: '', name: '', tip: null, shownAtMs });

describe('the boss reward waits for the defeat notice and the story lines', () => {
  it('waits while the defeat notice is on screen and opens once it is over', () => {
    expect(pickWaits(notice('finale', 1000), 1000, false)).toBe(true);
    expect(pickWaits(notice('finale', 1000), 1000 + NOTICE_LIFE_MS - 1, false)).toBe(true);
    expect(pickWaits(notice('finale', 1000), 1000 + NOTICE_LIFE_MS, false)).toBe(false);
  });

  it('waits while a story line (the boss\'s last words) is open', () => {
    expect(pickWaits(null, 0, true)).toBe(true);
    expect(pickWaits(notice('finale', 0), NOTICE_LIFE_MS + 5, true)).toBe(true);
  });

  it('a phase notice does not hold a pick, and nothing on screen opens it at once', () => {
    expect(pickWaits(notice('phase', 1000), 1000, false)).toBe(false);
    expect(pickWaits(null, 0, false)).toBe(false);
  });

  it('the run asks it before opening a boss\'s reward (src/app/game.ts watchBossPick)', () => {
    const game = readFileSync('src/app/game.ts', 'utf8');
    const watch = game.slice(game.indexOf('function watchBossPick'), game.indexOf('function watchBossPick') + 600);
    expect(watch).toMatch(/pickWaits\(moment, realMs, storyBox !== null \|\| storyLines\.length > 0\)\) return;/);
    expect(watch.indexOf('pickWaits')).toBeLessThan(watch.indexOf('offerPick()'));
  });
});
