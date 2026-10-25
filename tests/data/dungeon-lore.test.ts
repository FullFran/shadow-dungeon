import { describe, expect, it } from 'vitest';
import { DUNGEON_LORE } from '../../src/data/dungeon-lore';
import { catalog, LANGUAGES } from '../../src/i18n';

describe('dungeon lore', () => {
  it('starts with the Crypt of the Sword King', () => {
    expect(DUNGEON_LORE[0]?.id).toBe('crypt-of-the-sword-king');
    expect(new Set(DUNGEON_LORE.map((d) => d.id)).size).toBe(DUNGEON_LORE.length);
  });

  for (const language of LANGUAGES) {
    it(`has the name, subtitle and every lore line in "${language}"`, () => {
      const strings = catalog(language);
      const keys = DUNGEON_LORE.flatMap((d) => [d.nameKey, d.subtitleKey, ...d.loreKeys]);
      expect(keys.filter((key) => !strings[key])).toEqual([]);
    });
  }
});
