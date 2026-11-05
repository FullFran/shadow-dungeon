import { describe, expect, it } from 'vitest';
import { galleryGroups } from '../../src/app/lore-gallery';
import { GALLERY_ICONS } from '../../src/ui/icons/gallery-icons';
import { INSTALL_ICON } from '../../src/ui/icons/install-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

describe('gallery and install icons', () => {
  it('has an icon for every gallery group', () => {
    for (const group of galleryGroups()) expect(GALLERY_ICONS[group.id], group.id).toBeDefined();
  });

  it('every icon is 16x16, uses only colours of its palette, keeps the ink outline and the edge clear', () => {
    for (const [id, icon] of Object.entries({ ...GALLERY_ICONS, install: INSTALL_ICON })) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
      expect(icon.rows.join('').replaceAll('.', '').length, id).toBeGreaterThan(60);
    }
  });

  it('is original and every drawing differs', () => {
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    const all = Object.values({ ...GALLERY_ICONS, install: INSTALL_ICON });
    for (const icon of all) expect(hub.has(icon.rows.join(''))).toBe(false);
    expect(new Set(all.map((i) => i.rows.join(''))).size).toBe(all.length);
  });
});
