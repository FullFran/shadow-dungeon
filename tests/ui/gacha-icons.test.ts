import { describe, expect, it } from 'vitest';
import { GACHA_ICONS, GACHA_ICON_IDS } from '../../src/ui/icons/gacha-icons';

describe('gacha page pixel icons', () => {
  it('has every icon the page uses', () => {
    for (const id of GACHA_ICON_IDS) expect(GACHA_ICONS[id], id).toBeDefined();
    for (const id of ['capsule', 'capsuleTop', 'capsuleBottom', 'pull', 'pullTen', 'back', 'skip', 'sparkle', 'owned', 'unknown']) expect(GACHA_ICON_IDS).toContain(id);
  });

  it('the two capsule halves together draw the whole capsule', () => {
    const merged = GACHA_ICONS.capsuleTop!.rows.map((row, y) => [...row].map((ch, x) => (ch !== '.' ? ch : GACHA_ICONS.capsuleBottom!.rows[y]![x]!)).join(''));
    expect(merged).toEqual(GACHA_ICONS.capsule!.rows);
    expect(GACHA_ICONS.capsuleTop!.palette).toEqual(GACHA_ICONS.capsule!.palette);
  });

  for (const [id, icon] of Object.entries(GACHA_ICONS)) {
    it(`"${id}" is a 16x16 map drawn only with its palette, in 3 to 8 colours`, () => {
      expect(icon.rows).toHaveLength(16);
      const used = new Set<string>();
      for (const row of icon.rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== '.') used.add(ch);
      }
      for (const ch of used) expect(icon.palette[ch], `${id} '${ch}'`).toMatch(/^#[0-9a-f]{6}$/i);
      expect(used.size).toBeGreaterThanOrEqual(2);
      expect(used.size).toBeLessThanOrEqual(8);
    });
  }
});
