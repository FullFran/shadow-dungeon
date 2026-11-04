import { describe, expect, it } from 'vitest';
import { ACCOUNT_ICONS } from '../../src/ui/icons/account-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

describe('account icons', () => {
  it('has the five the drawer draws', () => {
    expect(Object.keys(ACCOUNT_ICONS).sort()).toEqual(['cloud', 'discord', 'google', 'guest', 'mail']);
  });

  it('every icon is 16x16, uses only colours of its palette, 3 to 8 colours, with the ink outline', () => {
    for (const [id, icon] of Object.entries(ACCOUNT_ICONS)) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
    }
  });

  it('draws something substantial and never twice the same, nor a hub icon', () => {
    const hub = new Set(Object.values(PIXEL_ICONS).map((i) => i.rows.join('')));
    const seen = new Set<string>();
    for (const [id, icon] of Object.entries(ACCOUNT_ICONS)) {
      const flat = icon.rows.join('');
      expect(flat.replaceAll('.', '').length, id).toBeGreaterThan(70);
      expect(hub.has(flat), id).toBe(false);
      seen.add(flat);
    }
    expect(seen.size).toBe(5);
  });

  it('the provider marks are colourful: Google has four colours, Discord is blurple', () => {
    const colours = (id: 'google' | 'discord') => new Set([...ACCOUNT_ICONS[id].rows.join('')].filter((c) => c !== '.' && c !== 'k')).size;
    expect(colours('google')).toBe(4);
    expect(ACCOUNT_ICONS.discord.palette.b).toBe('#5865f2');
  });
});
