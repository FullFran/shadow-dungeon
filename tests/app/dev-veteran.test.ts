import { describe, expect, it } from 'vitest';
import { townOpen } from '../../src/app/adventure-route';
import { veteranRecords, veteranSave } from '../../src/app/dev-unlock';
import { EMPTY_SAVE } from '../../src/app/save';
import { DUNGEONS, TUTORIAL } from '../../src/data/dungeons';

/** `?unlock=veteran` on the dev server: an advanced, believable profile for local review (owner, 2026-11-03). */
describe('veteran profile', () => {
  const empty = { runs: 0, victories: 0, bestLevel: null, lastSpecies: null, dungeons: {} };
  const records = veteranRecords(empty);
  const save = veteranSave(EMPTY_SAVE);

  it('opens the town and clears every guardian dungeon, the chasm at a believable depth', () => {
    expect(townOpen(new Set(Object.entries(records.dungeons).filter(([, d]) => d.cleared).map(([id]) => id)), save)).toBe(true);
    expect(records.dungeons[TUTORIAL.id]?.cleared).toBe(true);
    for (const d of DUNGEONS) {
      if (d.endless) {
        expect(records.dungeons[d.id]?.bestFloor).toBeGreaterThanOrEqual(20);
        expect(records.dungeons[d.id]?.bestFloor).toBeLessThanOrEqual(60);
      } else expect(records.dungeons[d.id]?.cleared, d.id).toBe(true);
    }
  });

  it('reads like a long played profile, not a cheat', () => {
    expect(records.runs).toBeGreaterThan(100);
    expect(records.victories).toBeGreaterThan(5);
    expect(records.lastSpecies).toBe('zorua');
    expect(save.coins).toBeGreaterThan(1000);
    expect(save.coins).toBeLessThan(100000);
  });
});
