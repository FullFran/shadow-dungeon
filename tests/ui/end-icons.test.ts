import { describe, expect, it } from 'vitest';
import { END_ICONS, END_ICON_IDS } from '../../src/ui/icons/end-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

describe('end screen icons', () => {
  it('has the icons the stat tiles need', () => {
    for (const id of ['clock', 'crown', 'skull', 'shield', 'card', 'coin', 'gem', 'floor', 'level', 'seed', 'bag', 'party', 'medal', 'scroll', 'mode', 'sword']) expect(END_ICON_IDS, id).toContain(id);
  });

  it('every icon is 16x16, covered by its palette, 3 to 8 colours', () => {
    for (const [id, icon] of Object.entries(END_ICONS)) {
      expect(icon.rows, id).toHaveLength(16);
      for (const row of icon.rows) expect(row, id).toHaveLength(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} "${ch}"`).toBeTruthy();
      expect(used.size, id).toBeGreaterThanOrEqual(3);
      expect(used.size, id).toBeLessThanOrEqual(8);
    }
  });

  it('the newly drawn icons are not copies of each other or of a hub icon', () => {
    const own = Object.entries(END_ICONS).filter(([, icon]) => !Object.values(PIXEL_ICONS).includes(icon));
    expect(own.length).toBeGreaterThanOrEqual(10);
    const rows = own.map(([, i]) => i.rows.join(''));
    expect(new Set(rows).size).toBe(rows.length);
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    for (const r of rows) expect(hub.has(r)).toBe(false);
  });
});
