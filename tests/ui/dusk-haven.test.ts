import { describe, expect, it } from 'vitest';
import { HAVEN_PROPS } from '../../src/ui/dusk-haven';
import { TOWN_RESIDENTS } from '../../src/ui/town-walkers';

/** Every resident keeps to its place in the town (docs/gdd.md "El mundo"): in front of its prop, on the ground. */
describe('Dusk Haven layout', () => {
  it('ties every grounded resident to a prop of the scene, standing just in front of it', () => {
    for (const r of TOWN_RESIDENTS) {
      if (!r.prop) continue;
      const prop = HAVEN_PROPS[r.prop]!;
      expect(prop, `${r.id} -> ${r.prop}`).toBeDefined();
      const cx = (r.area.x0 + r.area.x1) / 2;
      expect(Math.abs(cx - prop.x), r.id).toBeLessThan(0.07);
      // In front means on the ground row of the prop or a little nearer (lower on screen), never behind it.
      expect(r.area.y0, r.id).toBeGreaterThanOrEqual(prop.y - 0.005);
      expect(r.area.y1, r.id).toBeLessThan(prop.y + 0.08);
    }
  });

  it('places the props of the lore: stall, forge, stone house, board, waystone, easel, training tree', () => {
    for (const id of ['stall', 'forge', 'stoneHouse', 'board', 'waystone', 'easel', 'trainingTree']) expect(HAVEN_PROPS[id], id).toBeDefined();
    const tied = TOWN_RESIDENTS.filter((r) => r.prop).map((r) => r.id);
    for (const id of ['mimikyu', 'poochyena', 'abra', 'smeargle', 'axew', 'gastly']) expect(tied, id).toContain(id);
  });
});
