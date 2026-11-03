import { describe, expect, it } from 'vitest';
import { MATERIAL_TIERS } from '../../src/data/player-evolutions';
import { EVOLVE_SHOP_ICONS } from '../../src/ui/icons/evolve-shop-icons';

describe('evolve and shop icons', () => {
  it('has an essence per material tier plus the chain arrow and the awakening mark', () => {
    for (const tier of MATERIAL_TIERS) expect(EVOLVE_SHOP_ICONS[`essence-${tier}`], tier).toBeDefined();
    expect(EVOLVE_SHOP_ICONS.arrow).toBeDefined();
    expect(EVOLVE_SHOP_ICONS.awaken).toBeDefined();
  });

  it('every icon is 16x16, uses only its palette, in 3 to 8 colours with the ink outline', () => {
    for (const [id, icon] of Object.entries(EVOLVE_SHOP_ICONS)) {
      expect(icon.rows, id).toHaveLength(16);
      for (const row of icon.rows) expect(row, id).toHaveLength(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} "${ch}"`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(used.size, id).toBeGreaterThanOrEqual(3);
      expect(used.size, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
    }
  });

  it('the three essences differ in colour so a tier reads without its label', () => {
    const fills = MATERIAL_TIERS.map((tier) => JSON.stringify(EVOLVE_SHOP_ICONS[`essence-${tier}`]!.palette));
    expect(new Set(fills).size).toBe(3);
  });
});
