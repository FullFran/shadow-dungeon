import { describe, expect, it } from 'vitest';
import { HAVEN_HOUSES, HAVEN_PROPS } from '../../src/ui/dusk-haven';
import { TOWN_RESIDENTS } from '../../src/ui/town-walkers';

/** Dusk Haven on the title (odd/tasks/title-hub.md T9; docs/gdd.md "El mundo"). */
describe('Dusk Haven layout', () => {
  it('ties every resident to its prop, standing just in front of it', () => {
    for (const r of TOWN_RESIDENTS) {
      const prop = HAVEN_PROPS[r.prop ?? '']!;
      expect(prop, `${r.id} -> ${r.prop}`).toBeDefined();
      expect(Math.abs((r.area.x0 + r.area.x1) / 2 - prop.x), r.id).toBeLessThan(0.07);
      expect(r.area.y0, r.id).toBeGreaterThanOrEqual(prop.y - 0.005);
      expect(r.area.y1, r.id).toBeLessThan(prop.y + 0.08);
    }
    expect(TOWN_RESIDENTS.find((r) => r.id === 'mimikyu')?.prop).toBe('stall');
    expect(TOWN_RESIDENTS.find((r) => r.id === 'gastly')?.prop).toBe('board');
  });

  it('lines the road with houses in perspective: nearer rows lower and larger, on both sides', () => {
    for (const side of [-1, 1] as const) {
      const row = HAVEN_HOUSES.filter((h) => h.side === side).sort((a, b) => a.depth - b.depth);
      expect(row.length, `side ${side}`).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < row.length; i++) expect(row[i]!.depth).toBeGreaterThan(row[i - 1]!.depth);
    }
  });
});
