import { describe, expect, it } from 'vitest';
import { CREDITS_CONTROLS_ICONS, CREDITS_CONTROLS_ICON_IDS } from '../../src/ui/icons/credits-controls-icons';

describe('credits and controls pixel icons', () => {
  it('has every icon the two screens use', () => {
    for (const id of CREDITS_CONTROLS_ICON_IDS) expect(CREDITS_CONTROLS_ICONS[id], id).toBeDefined();
    for (const id of ['team', 'creator', 'designer', 'sprites', 'font', 'tiles', 'music', 'code', 'legal', 'chevron', 'link', 'combat', 'menus', 'pad']) expect(CREDITS_CONTROLS_ICON_IDS).toContain(id);
  });

  for (const [id, icon] of Object.entries(CREDITS_CONTROLS_ICONS)) {
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
});
