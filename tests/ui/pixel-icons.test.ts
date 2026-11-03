import { describe, expect, it } from 'vitest';
import { TOWN_SERVICES } from '../../src/town/town-menu';
import { HUB_ICON_IDS, PIXEL_ICONS, pixelIconRects } from '../../src/ui/pixel-icons';

describe('pixel icons', () => {
  it('has a colour icon for every town service and every hub action', () => {
    for (const id of [...TOWN_SERVICES, ...HUB_ICON_IDS]) expect(PIXEL_ICONS[id], id).toBeDefined();
  });

  for (const [id, icon] of Object.entries(PIXEL_ICONS)) {
    it(`"${id}" is a 16x16 map drawn only with its palette, in 3 to 8 colours`, () => {
      expect(icon.rows).toHaveLength(16);
      const used = new Set<string>();
      for (const row of icon.rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== '.') used.add(ch);
      }
      for (const ch of used) expect(icon.palette[ch], `${id} '${ch}'`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(used.size).toBeGreaterThanOrEqual(3);
      expect(used.size).toBeLessThanOrEqual(8);
    });
  }

  it('merges each horizontal run of one colour into one rect', () => {
    const rects = pixelIconRects({ palette: { a: '#ff0000', b: '#00ff00' }, rows: ['aab.'.padEnd(16, '.'), ...Array(15).fill('.'.repeat(16))] });
    expect(rects).toEqual([
      { x: 0, y: 0, w: 2, fill: '#ff0000' },
      { x: 2, y: 0, w: 1, fill: '#00ff00' },
    ]);
  });
});
