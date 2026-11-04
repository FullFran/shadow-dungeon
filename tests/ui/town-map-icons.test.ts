import { describe, expect, it } from 'vitest';
import { SEAL_BACKING, YOU_ARE_HERE } from '../../src/ui/icons/town-map-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

describe('town map icons', () => {
  it('the cross is a 16x16 icon and the seal a 20x20 backing, each with a palette covering its letters', () => {
    expect(YOU_ARE_HERE.rows).toHaveLength(16);
    for (const row of YOU_ARE_HERE.rows) expect(row).toHaveLength(16);
    expect(SEAL_BACKING.rows).toHaveLength(20);
    for (const row of SEAL_BACKING.rows) expect(row).toHaveLength(20);
    for (const icon of [YOU_ARE_HERE, SEAL_BACKING]) {
      for (const ch of new Set(icon.rows.join('').replaceAll('.', ''))) expect(icon.palette[ch], ch).toBeTruthy();
      expect(Object.keys(icon.palette).length).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length).toBeLessThanOrEqual(8);
    }
  });

  it('the seal is a round blob (centre filled, corners clear, edge outlined) and shades differ across it', () => {
    const rows = SEAL_BACKING.rows;
    expect(rows[10]![10]).not.toBe('.');
    expect(rows[0]![0]).toBe('.');
    expect(rows[19]![19]).toBe('.');
    expect(rows.join('')).toContain('k');
    expect(rows.join('')).toContain('d');
    expect(rows.join('')).toContain('h');
  });

  it('the marks are not copies of a registered icon', () => {
    const known = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    expect(known.has(YOU_ARE_HERE.rows.join(''))).toBe(false);
  });
});
