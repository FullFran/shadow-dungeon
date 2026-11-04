import { describe, expect, it } from 'vitest';
import { MARKER_KINDS } from '../../src/app/pause-map';
import { MAP_ICONS, PAUSE_ICONS } from '../../src/ui/icons/pause-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

const entries = [...Object.entries(PAUSE_ICONS), ...Object.entries(MAP_ICONS)];

describe('pause icons', () => {
  it('has an icon for every pause action and every map marker', () => {
    for (const id of ['resume', 'restart', 'settings', 'report', 'copyReport', 'quit']) expect(PAUSE_ICONS[id as keyof typeof PAUSE_ICONS], id).toBeDefined();
    for (const kind of MARKER_KINDS) expect(MAP_ICONS[kind], kind).toBeDefined();
  });

  it('every icon is 16x16 with a palette that covers its letters and 3 to 8 colours', () => {
    for (const [id, icon] of entries) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      for (const ch of new Set(icon.rows.join('').replaceAll('.', ''))) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
    }
  });

  it('the icons drawn for the pause are not copies of each other or of a hub icon', () => {
    const own = [PAUSE_ICONS.restart, PAUSE_ICONS.copyReport, PAUSE_ICONS.quit, MAP_ICONS.player, MAP_ICONS.partner, MAP_ICONS.item, MAP_ICONS.enemy, MAP_ICONS.event].map((i) => i.rows.join(''));
    expect(new Set(own).size).toBe(own.length);
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    for (const r of own) expect(hub.has(r)).toBe(false);
  });

  it('the player and the partner are told apart by colour, not only by place', () => {
    expect(MAP_ICONS.player.palette).not.toEqual(MAP_ICONS.partner.palette);
  });
});
