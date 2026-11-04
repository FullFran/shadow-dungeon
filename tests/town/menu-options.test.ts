import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { GROUP_HEADER, groupOptions, HOSTED_BY, ICON_SIZE, menuOptionServices, OPTION_ROW, OPTION_ROW_GAP, optionsLayout, type MenuGlyph } from '../../src/town/menu-groups';
import { cardPin, initialFocus, menuGeometry } from '../../src/town/sheet-model';
import { looseServices, townMapMarkers } from '../../src/town/town-map';
import { PLACE_SERVICES, TOWN_SERVICES, type TownService } from '../../src/town/town-menu';

// Owner, 2026-11-04: "si no hago hover sobre ningún punto no debe salir nada" and "un poco más grande esto, quita de ahí las
// opciones que no tengan sentido" (odd/tasks/town-map-menu.md, round 2).
const ALL = new Set<TownService>(TOWN_SERVICES);
const VIEWPORTS = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [844, 390]] as const;
type TownMap = (typeof WORLD)[keyof typeof WORLD];

describe('no place card until a pin is hovered or focused', () => {
  it('starts the focus on "Seguir" (the index after the pins), on every map', () => {
    for (const map of Object.values(WORLD)) {
      const pins = townMapMarkers(map, ALL).length;
      expect(initialFocus(pins), map.id).toBe(pins);
    }
  });

  it('shows a card only for a focused pin: not for Seguir, an option or nothing', () => {
    expect(cardPin(0, 3)).toBe(0);
    expect(cardPin(2, 3)).toBe(2);
    expect(cardPin(3, 3)).toBeNull();
    expect(cardPin(5, 3)).toBeNull();
    expect(cardPin(-1, 3)).toBeNull();
    expect(cardPin(0, 0)).toBeNull();
  });

  it('opens with no card on any map (the initial focus is not a pin)', () => {
    for (const map of Object.values(WORLD)) {
      const pins = townMapMarkers(map, ALL).length;
      expect(cardPin(initialFocus(pins), pins), map.id).toBeNull();
    }
  });
});

const optionsOf = (map: TownMap, available: ReadonlySet<TownService> = ALL): TownService[] => menuOptionServices(looseServices(townMapMarkers(map, available), available), available);

describe('options that make no sense here are removed, never a feature made unreachable', () => {
  it('lists Logros nowhere: the board window hosts it', () => {
    expect(HOSTED_BY.achievements).toBe('board');
    for (const map of Object.values(WORLD)) expect(optionsOf(map), map.id).not.toContain('achievements');
  });

  it('every removed service has its host as a pin or as a kept option on every map', () => {
    for (const map of Object.values(WORLD)) {
      const markers = townMapMarkers(map, ALL);
      // The waystone pin opens the dungeons window, which hosts challenges and travel (src/town/town-menu.ts PLACE_SERVICES).
      const waystone = markers.some((m) => m.id === 'waystone') ? PLACE_SERVICES.waystone : [];
      const reachable = new Set<TownService>([...markers.map((m) => m.service), ...waystone, ...optionsOf(map)]);
      for (const s of TOWN_SERVICES) {
        if (reachable.has(s)) continue;
        const host = HOSTED_BY[s];
        expect(host, `${map.id}: ${s} is neither a pin nor an option nor hosted`).toBeDefined();
        expect(reachable.has(host!), `${map.id}: ${s} hosted by ${host}`).toBe(true);
      }
    }
  });

  it('keeps a hosted service when its host is not wired', () => {
    const noBoard = new Set<TownService>(TOWN_SERVICES.filter((s) => s !== 'board'));
    for (const map of Object.values(WORLD)) expect(optionsOf(map, noBoard), map.id).toContain('achievements');
  });

  it('keeps controls (Ajustes has no gamepad help), pokemon, evolve, gallery, friends, account and settings reachable', () => {
    for (const map of Object.values(WORLD)) {
      const reach = new Set<TownService>([...townMapMarkers(map, ALL).map((m) => m.service), ...optionsOf(map)]);
      for (const s of ['controls', 'pokemon', 'evolve', 'gallery', 'friends', 'account', 'settings'] as const) expect(reach.has(s), `${map.id} ${s}`).toBe(true);
    }
  });
});

const sizesOf = (map: TownMap): number[] => groupOptions([...optionsOf(map).map((s): { glyph: MenuGlyph } => ({ glyph: s })), { glyph: 'title' as const }]).map((g) => g.options.length);

describe('bigger rows, still no scroll', () => {
  it('rows are at least 56 px and the icon 36 px', () => {
    expect(OPTION_ROW).toBeGreaterThanOrEqual(56);
    expect(ICON_SIZE).toBe(36);
  });

  it('a group with a single option has no header, so it takes no header height', () => {
    const geo = menuGeometry(1920, 1080);
    expect(optionsLayout([2], geo).needed - optionsLayout([1], geo).needed).toBe(OPTION_ROW + OPTION_ROW_GAP + GROUP_HEADER);
  });

  for (const map of Object.values(WORLD)) {
    for (const [w, h] of VIEWPORTS) {
      it(`${map.id} at ${w}x${h} fits without a scroll`, () => {
        const layout = optionsLayout(sizesOf(map), menuGeometry(w, h));
        expect(layout.needed).toBeLessThanOrEqual(layout.available);
      });
    }
  }

  it('the refugio list stays one column at 1920x1080, 1440x900 and 1366x768', () => {
    for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768]] as const) expect(optionsLayout(sizesOf(WORLD.refugio!), menuGeometry(w, h)).mode, `${w}x${h}`).toBe('list');
  });
});
