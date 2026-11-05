import { describe, expect, it } from 'vitest';
import { HAVEN_HOUSES, HAVEN_PAL, HAVEN_PROPS } from '../../src/ui/dusk-haven';
import { existsSync } from 'node:fs';
import * as eclipse from '../../src/ui/eclipse';

/** Dusk Haven on the title (odd/tasks/title-hub.md T9; docs/gdd.md "El mundo"). */
describe('Dusk Haven layout', () => {
  // Owner, 2026-11-04: "quita al mimikyu y al gastly de ahí": the backdrop is the town alone, no wandering Pokémon.
  it('has no residents: the hub backdrop draws no Pokémon', () => {
    expect(existsSync(new URL('../../src/ui/town-walkers.ts', import.meta.url).pathname)).toBe(false);
    expect(Object.keys(eclipse)).not.toContain('setBackdropSheets');
    expect(Object.keys(HAVEN_PROPS).sort()).toEqual(['board', 'stall']);
  });

  // Owner, 2026-11-03: houses cut into each other and looked symmetric: fewer, irregular, never overlapping.
  it('keeps a few irregular houses, spaced in depth so none cuts into another, never mirrored', () => {
    expect(HAVEN_HOUSES.length).toBeGreaterThanOrEqual(3);
    expect(HAVEN_HOUSES.length).toBeLessThanOrEqual(5);
    for (const side of [-1, 1] as const) {
      const row = HAVEN_HOUSES.filter((h) => h.side === side).sort((a, b) => a.depth - b.depth);
      expect(row.length, `side ${side}`).toBeGreaterThanOrEqual(1);
      for (let i = 1; i < row.length; i++) expect(row[i]!.depth - row[i - 1]!.depth, `side ${side}`).toBeGreaterThanOrEqual(0.3);
    }
    const left = HAVEN_HOUSES.filter((h) => h.side < 0).map((h) => h.depth.toFixed(2)).join();
    const right = HAVEN_HOUSES.filter((h) => h.side > 0).map((h) => h.depth.toFixed(2)).join();
    expect(left).not.toBe(right);
  });

  it('keeps houses at irregular distances from the road and nothing violet in the palette', () => {
    expect(new Set(HAVEN_HOUSES.map((h) => h.gap)).size).toBe(HAVEN_HOUSES.length);
    expect(Math.max(...HAVEN_HOUSES.map((h) => h.gap)) - Math.min(...HAVEN_HOUSES.map((h) => h.gap))).toBeGreaterThanOrEqual(0.08);
    expect(Object.keys(HAVEN_PAL).some((k) => k.startsWith('vi'))).toBe(false);
  });
});
