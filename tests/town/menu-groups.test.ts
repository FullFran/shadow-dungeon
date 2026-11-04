import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/i18n';
import { WORLD } from '../../src/data/world';
import { groupOfGlyph, groupOptions, MENU_GROUPS, optionsLayout, type MenuGlyph } from '../../src/town/menu-groups';
import { menuGeometry } from '../../src/town/sheet-model';
import { looseServices, townMapMarkers } from '../../src/town/town-map';
import { TOWN_SERVICES } from '../../src/town/town-menu';

const ALL = new Set(TOWN_SERVICES);
const VIEWPORTS = [[1920, 1080], [1440, 900], [1366, 768], [1280, 720], [844, 390]] as const;

describe('option groups', () => {
  it('has four groups, in order, each with an es and en header', () => {
    expect(MENU_GROUPS.map((g) => g.id)).toEqual(['team', 'progress', 'social', 'system']);
    for (const lang of ['es', 'en'] as const) for (const g of MENU_GROUPS) expect(catalog(lang)[g.titleKey], `${lang} ${g.titleKey}`).toBeTruthy();
  });

  it('puts every town service in exactly one group', () => {
    for (const s of TOWN_SERVICES) {
      const owners = MENU_GROUPS.filter((g) => g.services.includes(s));
      expect(owners.map((g) => g.id), s).toHaveLength(1);
      expect(groupOfGlyph(s)).toBe(owners[0]!.id);
    }
  });

  it('files the owner-named options where they asked', () => {
    expect(groupOfGlyph('pokemon')).toBe('team');
    expect(groupOfGlyph('evolve')).toBe('team');
    expect(groupOfGlyph('achievements')).toBe('progress');
    expect(groupOfGlyph('gallery')).toBe('progress');
    expect(groupOfGlyph('friends')).toBe('social');
    expect(groupOfGlyph('account')).toBe('social');
    for (const g of ['settings', 'controls', 'title', 'room'] as const) expect(groupOfGlyph(g)).toBe('system');
    expect(groupOfGlyph('resume')).toBeNull();
  });

  it('keeps every current option of every map: the grouped list is the loose services plus the end rows, none dropped or doubled', () => {
    for (const map of Object.values(WORLD)) {
      const markers = townMapMarkers(map, ALL);
      const options = [...looseServices(markers, ALL).map((s): { glyph: MenuGlyph } => ({ glyph: s })), { glyph: 'title' as const }, { glyph: 'resume' as const }];
      const groups = groupOptions(options);
      const grouped = groups.flatMap((g) => g.options.map((o) => o.glyph));
      expect(grouped.sort(), map.id).toEqual(options.map((o) => o.glyph).filter((g) => g !== 'resume').sort());
      expect(groups.every((g) => g.options.length > 0)).toBe(true);
    }
  });
});

describe('options layout never needs a scroll', () => {
  for (const map of Object.values(WORLD)) {
    const markers = townMapMarkers(map, ALL);
    const options = [...looseServices(markers, ALL).map((s): { glyph: MenuGlyph } => ({ glyph: s })), { glyph: 'title' as const }];
    const sizes = groupOptions(options).map((g) => g.options.length);
    for (const [w, h] of VIEWPORTS) {
      it(`${map.id} at ${w}x${h}`, () => {
        const layout = optionsLayout(sizes, menuGeometry(w, h));
        expect(layout.needed).toBeLessThanOrEqual(layout.available);
        // Every group is placed once, in order.
        expect(layout.columns.flat()).toEqual(sizes.map((_, i) => i));
        if (h <= 520) expect(layout.mode).toBe('grid');
      });
    }
  }

  it('uses the single list when it fits and two columns when it does not', () => {
    expect(optionsLayout([2, 2, 2, 3], menuGeometry(1920, 1080)).mode).toBe('list');
    expect(optionsLayout([5, 4, 3, 3], menuGeometry(1280, 720)).mode).toBe('cols');
  });
});
