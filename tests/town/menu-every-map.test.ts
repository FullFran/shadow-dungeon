import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { groupOptions, menuOptionServices, optionsLayout, type MenuGlyph } from '../../src/town/menu-groups';
import { cardPin, initialFocus, menuGeometry, sheetFit } from '../../src/town/sheet-model';
import { paintTownSheet } from '../../src/town/sheet-paint';
import { looseServices, townMapMarkers } from '../../src/town/town-map';
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

      it('lists every service once: as a pin, hosted by the waystone or a kept option, or hosted by another window', () => {
        const options = menuOptionServices(looseServices(markers, ALL), ALL);
        const waystone = markers.some((m) => m.id === 'waystone') ? ['dungeons', 'challenges', 'travel'] : [];
        const seen = [...markers.map((m) => m.service), ...options];
        expect(new Set(seen).size, `${map.id} no doubles among pins and options (a waystone pin is the dungeons one)`).toBe(seen.length);
        for (const s of TOWN_SERVICES) expect(seen.includes(s) || waystone.includes(s) || s === 'achievements', `${map.id} ${s}`).toBe(true);
      });

      it('opens on Seguir with no card, and fits whole at the five sizes with a scroll-free option list', () => {
        expect(cardPin(initialFocus(markers.length), markers.length)).toBeNull();
        const glyphs = [...menuOptionServices(looseServices(markers, ALL), ALL).map((s): { glyph: MenuGlyph } => ({ glyph: s })), { glyph: 'title' as const }];
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
});
