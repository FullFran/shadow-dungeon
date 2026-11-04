import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { readFileSync } from 'node:fs';
import { GROUP_HEADER, groupHeight, groupOptions, optionsLayout, townMenuOptions, type MenuGlyph } from '../../src/town/menu-groups';
import { cardPin, initialFocus, menuGeometry, sheetFit } from '../../src/town/sheet-model';
import { paintTownSheet } from '../../src/town/sheet-paint';
import { townMapMarkers } from '../../src/town/town-map';
import { NPC_SERVICE, TOWN_SERVICES, type TownService } from '../../src/town/town-menu';

// Owner, 2026-11-04: "el menú con el mapa hazlo consistente en todas las partes del mapa global, todos los mapas".
// One opener (src/town/scene.ts openTownMenu) serves every map of WORLD; this walks all of them.
const ALL = new Set<TownService>(TOWN_SERVICES);
const VIEWPORTS = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [844, 390]] as const;

describe('the map menu on every map of the world', () => {
  for (const map of Object.values(WORLD)) {
    describe(map.id, () => {
      const cols = Math.max(...map.rows.map((r) => r.length));
      const markers = townMapMarkers(map, ALL);

      it('has a name for the cartouche in es and en and paints the same sheet twice', () => {
        for (const lang of ['es', 'en'] as const) expect(catalog(lang)[map.nameKey], `${lang} ${map.nameKey}`).toBeTruthy();
        const a = paintTownSheet(map);
        const b = paintTownSheet(map);
        expect(a.data).toEqual(b.data);
      });

      it('pins are exactly its service NPCs and the places it has (waystone, board, shrine, beacon)', () => {
        const npcs = map.npcs.filter((n) => n.opens).map((n) => NPC_SERVICE[n.opens!]);
        const places = (['board', 'waystone', 'shrine', 'beacon'] as const).filter((p) => map[p]);
        expect(markers.length, map.id).toBe(npcs.length + places.length);
        for (const s of npcs) expect(markers.map((m) => m.service), map.id).toContain(s);
        for (const p of places) expect(markers.map((m) => m.id), map.id).toContain(p);
      });

      it('the options column is identical on every map (owner: "el menú solo debe cambiar el mapa, lo demás debe ser igual siempre")', () => {
        const options = townMenuOptions(ALL);
        // Every service, pins or not; the achievements live in the notice board's window.
        expect(options).toEqual(TOWN_SERVICES.filter((s) => s !== 'achievements'));
      });

      it('opens on Seguir with no card, and fits whole at the five sizes with a scroll-free option list', () => {
        expect(cardPin(initialFocus(markers.length), markers.length)).toBeNull();
        const glyphs = [...townMenuOptions(ALL).map((s): { glyph: MenuGlyph } => ({ glyph: s })), { glyph: 'title' as const }];
        const sizes = groupOptions(glyphs).map((g) => g.options.length);
        for (const [w, h] of VIEWPORTS) {
          const geo = menuGeometry(w, h);
          const fit = sheetFit(cols, map.rows.length, geo.mapBox.w, geo.mapBox.h);
          expect(fit.width, `${map.id} ${w}x${h}`).toBeLessThanOrEqual(geo.mapBox.w + 0.001);
          expect(fit.height, `${map.id} ${w}x${h}`).toBeLessThanOrEqual(geo.mapBox.h + 0.001);
          const l = optionsLayout(sizes, geo);
          expect(l.needed, `${map.id} ${w}x${h}`).toBeLessThanOrEqual(l.available);
        }
      });
    });
  }

  it('the scene builds the options from townMenuOptions only, never from the map', () => {
    const scene = readFileSync('src/town/scene.ts', 'utf8');
    expect(scene).toMatch(/options: \[\.\.\.townMenuOptions\(available\)/);
    expect(scene).not.toMatch(/looseServices\(/);
  });

  it('every group shows its title, a single-option group too', () => {
    expect(groupHeight(1)).toBe(GROUP_HEADER + 56);
  });
});
