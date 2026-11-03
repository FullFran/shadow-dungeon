import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACHIEVEMENT_FAMILIES } from '../../src/data/achievements';
import { CHANGELOG, CHANGELOG_SECTIONS } from '../../src/data/changelog';
import { ACHIEVEMENT_FAMILY_ICONS, ACH_NEWS_ICONS, NEWS_SECTION_ICONS } from '../../src/ui/icons/achievements-news-icons';

describe('achievements and news icons', () => {
  it('every achievement family has its own icon', () => {
    for (const family of ACHIEVEMENT_FAMILIES) expect(ACH_NEWS_ICONS[ACHIEVEMENT_FAMILY_ICONS[family]], family).toBeDefined();
    expect(new Set(ACHIEVEMENT_FAMILIES.map((f) => ACHIEVEMENT_FAMILY_ICONS[f])).size).toBe(ACHIEVEMENT_FAMILIES.length);
  });

  it('every changelog section has its own icon', () => {
    for (const section of CHANGELOG_SECTIONS) expect(ACH_NEWS_ICONS[NEWS_SECTION_ICONS[section]], section).toBeDefined();
    expect(new Set(CHANGELOG_SECTIONS.map((s) => NEWS_SECTION_ICONS[s])).size).toBe(CHANGELOG_SECTIONS.length);
  });

  for (const [id, icon] of Object.entries(ACH_NEWS_ICONS)) {
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
      expect(icon.palette.k, `${id} outline`).toBe('#140c11');
    });
  }

  it('every changelog icon names a drawn icon, and every image is a small webp under public/news', () => {
    for (const release of CHANGELOG)
      for (const section of CHANGELOG_SECTIONS)
        for (const item of release.sections[section] ?? []) {
          if (item.icon) expect(ACH_NEWS_ICONS[item.icon], item.icon).toBeDefined();
          if (item.image) {
            expect(item.image).toMatch(/^news\/[a-z0-9-]+\.webp$/);
            const file = join(__dirname, '../../public', item.image);
            expect(existsSync(file), item.image).toBe(true);
            expect(statSync(file).size, item.image).toBeLessThan(60 * 1024);
          }
        }
  });
});
