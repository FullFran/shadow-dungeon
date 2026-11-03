import { describe, expect, it } from 'vitest';
import { SLOT_FILTERS } from '../../src/app/tutor';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { TUTOR_ICONS } from '../../src/ui/icons/tutor-icons';

describe('tutor icons', () => {
  it('has one icon per slot filter and the sheet stats', () => {
    for (const id of [...SLOT_FILTERS, 'power', 'stamina', 'cooldown', 'rankup']) expect(TUTOR_ICONS[id], id).toBeDefined();
  });

  it('every icon is 16x16, uses only colours of its palette, has 3 to 8 colours and the ink outline', () => {
    const entries = Object.entries(TUTOR_ICONS);
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, icon] of entries) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      for (const ch of new Set(icon.rows.join('').replaceAll('.', ''))) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
      expect(icon.rows[0]!.replaceAll('.', ''), id).toBe('');
      expect(icon.rows[15]!.replaceAll('.', ''), id).toBe('');
    }
  });

  it('no two icons are the same drawing and none copies a hub icon', () => {
    const rows = Object.values(TUTOR_ICONS).map((i) => i.rows.join(''));
    expect(new Set(rows).size).toBe(rows.length);
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    for (const r of rows) expect(hub.has(r)).toBe(false);
  });
});
