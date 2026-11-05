import { describe, expect, it } from 'vitest';
import { REPORT_TYPES } from '../../src/app/report-forms';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { REPORT_ICONS, FORM_ICONS } from '../../src/ui/icons/report-icons';

const ALL = { ...REPORT_ICONS, ...FORM_ICONS };
const BIG = REPORT_ICONS;

describe('report icons', () => {
  it('has one icon per report type', () => {
    for (const type of REPORT_TYPES) expect(REPORT_ICONS[type], type).toBeDefined();
  });

  it('every icon is 16x16, uses only colours of its palette, and keeps the ink outline', () => {
    for (const [id, icon] of Object.entries(ALL)) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
    }
  });

  it('draws something in at least a third of the cells, never touching the edge', () => {
    for (const [id, icon] of Object.entries(BIG)) {
      const filled = icon.rows.join('').replaceAll('.', '').length;
      expect(filled, id).toBeGreaterThan(80);
      expect(icon.rows[0]!.replaceAll('.', ''), id).toBe('');
      expect(icon.rows[15]!.replaceAll('.', ''), id).toBe('');
    }
  });

  it('is original: no icon repeats a hub icon map', () => {
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    for (const [id, icon] of Object.entries(BIG)) expect(hub.has(icon.rows.join('')), id).toBe(false);
  });

  it('no two report icons are the same drawing', () => {
    const seen = new Set(Object.values(REPORT_ICONS).map((i) => i.rows.join('')));
    expect(seen.size).toBe(Object.keys(REPORT_ICONS).length);
  });
});
