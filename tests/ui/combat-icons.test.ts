import { describe, expect, it } from 'vitest';
import { COMBAT_ICONS, COMBAT_ICON_IDS, iconRuns } from '../../src/ui/combat-icons';
import { BOSS_CUES } from '../../src/data/boss-lore';

describe('combat HUD pixel icons', () => {
  it('draws every icon the HUD names, plus one per cue kind', () => {
    for (const id of ['heart', 'bolt', 'mask', 'crown', 'skull', 'gem', 'poison', 'flame', 'stun', 'shield', 'mark', 'weak', 'hourglass', 'slotFast', 'slotHeavy', 'slotBoost', 'slotArea', 'coin', 'stairs', 'seal']) expect(COMBAT_ICON_IDS, id).toContain(id);
    for (const cue of BOSS_CUES) expect(COMBAT_ICON_IDS, cue).toContain(`cue-${cue}`);
  });

  for (const id of COMBAT_ICON_IDS) {
    it(`${id} is a 16x16 map of at most six declared colours and is not empty`, () => {
      const icon = COMBAT_ICONS[id]!;
      expect(icon.rows).toHaveLength(16);
      const colours = new Set<string>();
      for (const row of icon.rows) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== '.') colours.add(ch);
      }
      expect(colours.size).toBeGreaterThan(0);
      expect(colours.size).toBeLessThanOrEqual(6);
      for (const ch of colours) expect(icon.palette[ch], `${id} uses "${ch}"`).toMatch(/^#[0-9a-f]{6}$/);
      expect(iconRuns(icon).length).toBeGreaterThan(8);
    });
  }
});
