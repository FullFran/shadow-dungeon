import { describe, expect, it } from 'vitest';
import { DUNGEON_LORE } from '../../src/data/dungeon-lore';
import { GUARDIANS } from '../../src/data/guardians';
import { catalog, LANGUAGES } from '../../src/i18n';

const keys = [
  ...Object.values(GUARDIANS).flatMap((g) => [g!.titleKey, ...g!.preKeys, ...g!.postKeys]),
  ...DUNGEON_LORE.flatMap((d) => [d.nameKey, d.subtitleKey, ...d.loreKeys]),
  'spell.decidueye.volley',
  'spell.decidueye.fan',
  'spell.decidueye.dive',
];

describe('guardian and dungeon lore', () => {
  for (const language of LANGUAGES) {
    it(`has every line in "${language}", short, never naming what lies beneath`, () => {
      const strings = catalog(language);
      expect(keys.filter((key) => !strings[key])).toEqual([]);
      for (const key of keys) {
        const text = strings[key]!;
        expect(text, key).not.toMatch(/necrozma/i);
        expect(text.length, key).toBeLessThanOrEqual(110);
        // House style: parentheses or commas, no em dashes.
        expect(text, key).not.toContain('—');
      }
    });
  }

  it('keeps the Sword King as the first guardian only: no other line calls itself king', () => {
    const es = catalog('es');
    for (const key of keys.filter((k) => k.includes('decidueye') || k.includes('forest'))) expect(es[key], key).not.toMatch(/rey/i);
  });
});
