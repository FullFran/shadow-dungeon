import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { cartoucheRect, compassRect, SHEET_MARGIN, TILE_ART } from '../../src/town/sheet-model';
import { placeCards, townMapMarkers } from '../../src/town/town-map';
import { TOWN_SERVICES } from '../../src/town/town-menu';

const ALL = new Set(TOWN_SERVICES);

describe('place cards (the tooltip model of every service pin)', () => {
  for (const map of Object.values(WORLD)) {
    it(`${map.id}: every pin has a card with a name, who and what, in es and en`, () => {
      const markers = townMapMarkers(map, ALL);
      const cards = placeCards(markers, map);
      expect(cards.map((c) => c.id)).toEqual(markers.map((m) => m.id));
      for (const card of cards) {
        expect(PIXEL_ICONS[card.service as keyof typeof PIXEL_ICONS], card.id).toBeDefined();
        for (const lang of ['es', 'en'] as const) for (const key of [card.labelKey, card.aboutKey, card.whoKey]) expect(catalog(lang)[key], `${lang} ${key}`).toBeTruthy();
      }
    });
  }

  it('names the NPC of an NPC pin and the place of a place pin', () => {
    const cards = placeCards(townMapMarkers(WORLD.refugio, ALL), WORLD.refugio);
    expect(cards.find((c) => c.id === 'gacha')!.whoKey).toBe('town.name.gacha');
    expect(cards.find((c) => c.id === 'shrine')!.whoKey).toBe('world.lore.shrine.name');
    expect(cards.find((c) => c.id === 'board')!.whoKey).toBe('town.name.board');
    expect(cards.find((c) => c.id === 'beacon')!.whoKey).toBe('town.name.beacon');
  });

  it('keeps every pin clear of the cartouche and the compass', () => {
    for (const map of Object.values(WORLD)) {
      const cols = Math.max(...map.rows.map((r) => r.length));
      const artW = cols * TILE_ART + 2 * SHEET_MARGIN;
      const artH = map.rows.length * TILE_ART + 2 * SHEET_MARGIN;
      const c = cartoucheRect(artW);
      const k = compassRect(artW, artH);
      for (const m of townMapMarkers(map, ALL)) {
        const x = SHEET_MARGIN + m.x * TILE_ART;
        const y = SHEET_MARGIN + m.y * TILE_ART;
        for (const r of [c, k]) {
          const inside = x > r.x - 8 && x < r.x + r.w + 8 && y > r.y - 8 && y < r.y + r.h + 8;
          expect(inside, `${map.id} ${m.id}`).toBe(false);
        }
      }
    }
  });
});
