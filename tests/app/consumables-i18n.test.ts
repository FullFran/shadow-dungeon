import { describe, expect, it } from 'vitest';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';
import { CONSUMABLE_IDS } from '../../src/data/consumables';
import { CONSUMABLE_ICONS } from '../../src/ui/icons/consumable-icons';

const catalogs: Record<string, Record<string, string>> = { es, en };
const REFUSALS = ['fainted', 'passive', 'nothing', 'boss-arena', 'shared'];

describe('consumables: every kind has its name, description and icon (odd/tasks/items-bag.md)', () => {
  for (const [lang, catalog] of Object.entries(catalogs)) {
    it(`${lang}: every consumable's name and description, and every refusal line`, () => {
      for (const id of CONSUMABLE_IDS) {
        expect(catalog[`consumable.${id}`], `${lang} ${id}`).toBeTruthy();
        expect(catalog[`consumable.${id}.about`], `${lang} ${id}.about`).toBeTruthy();
      }
      for (const r of REFUSALS) expect(catalog[`bag.refused.${r}`], `${lang} ${r}`).toBeTruthy();
      // No em dashes in player-facing text (project style).
      for (const id of CONSUMABLE_IDS) expect(catalog[`consumable.${id}.about`]).not.toContain('—');
    });
  }

  it('every consumable has a 12x12 icon drawn only with its palette', () => {
    for (const id of CONSUMABLE_IDS) {
      const icon = CONSUMABLE_ICONS[id];
      expect(icon.rows, id).toHaveLength(12);
      for (const row of icon.rows) {
        expect(row, id).toHaveLength(12);
        for (const ch of row) if (ch !== '.') expect(icon.palette[ch], `${id} '${ch}'`).toBeDefined();
      }
    }
  });
});
