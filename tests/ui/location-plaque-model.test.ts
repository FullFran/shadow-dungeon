import { describe, expect, it } from 'vitest';
import { CHALLENGES, DUNGEONS, SENDA_ROADS, TUTORIAL } from '../../src/data/dungeons';
import { SIMA_BANDS } from '../../src/data/sima';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { PLACE_ICONS } from '../../src/ui/icons/place-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { BOSS_PLACE, dungeonPlace, PLAQUE_VARIANTS, plaquePhase, plaqueTiming, plaqueOf, shrinePlace, simaBandPlace, townPlace, type PlaceDef } from '../../src/ui/location-plaque-model';

const allPlaces = (): { label: string; place: PlaceDef }[] => [
  ...Object.values(WORLD).map((m) => ({ label: `town ${m.id}`, place: townPlace(m.id) })),
  ...[...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS, TUTORIAL].map((d) => ({ label: `dungeon ${d.id}`, place: dungeonPlace(d) })),
  ...SIMA_BANDS.map((b) => ({ label: `sima band ${b.id}`, place: simaBandPlace(b) })),
  { label: 'shrine', place: shrinePlace() },
  { label: 'boss', place: BOSS_PLACE },
];

describe('location plaque places', () => {
  it('every place has an existing icon, es+en name and a variant', () => {
    const places = allPlaces();
    expect(places.length).toBeGreaterThan(30);
    for (const { label, place } of places) {
      const icon = (PLACE_ICONS as Record<string, (typeof PIXEL_ICONS)['play']>)[place.icon] ?? (PIXEL_ICONS as Record<string, (typeof PIXEL_ICONS)['play']>)[place.icon];
      expect(icon, `${label} icon ${place.icon}`).toBeDefined();
      expect(icon?.rows, label).toHaveLength(16);
      for (const language of ['es', 'en'] as const) expect(catalog(language)[place.nameKey], `${label} ${language} ${place.nameKey}`).toBeTruthy();
      expect(PLAQUE_VARIANTS, label).toContain(place.variant);
    }
  });

  it('town is warm, the Sima is eclipse, bosses and the shrine are blood, the rest is stone', () => {
    expect(townPlace('refugio').variant).toBe('town');
    expect(dungeonPlace(DUNGEONS.find((d) => d.endless)!).variant).toBe('sima');
    for (const band of SIMA_BANDS) expect(simaBandPlace(band).variant).toBe('sima');
    expect(BOSS_PLACE.variant).toBe('boss');
    expect(shrinePlace().variant).toBe('boss');
    expect(dungeonPlace(DUNGEONS[0]!).variant).toBe('stone');
  });

  it('each dungeon theme has its own icon (no two themes share a picture by accident)', () => {
    const first = DUNGEONS.filter((d) => !d.endless).map((d) => dungeonPlace(d).icon);
    expect(new Set(first).size).toBe(first.length);
    const lines = CHALLENGES.map((d) => dungeonPlace(d).icon);
    expect(new Set(lines).size).toBe(lines.length);
    expect(new Set(allPlaces().map((p) => p.place.icon)).size).toBeGreaterThanOrEqual(18);
  });

  it('a Senda road wears its line icon', () => {
    for (const road of SENDA_ROADS) {
      const base = CHALLENGES.find((c) => c.challenge!.line === road.challenge!.line)!;
      expect(dungeonPlace(road).icon).toBe(dungeonPlace(base).icon);
    }
  });
});

describe('plaqueOf', () => {
  it('joins name, floor and difficulty, and keeps the note only when there is one', () => {
    const plaque = plaqueOf(townPlace('refugio'), { name: 'Refugio del Ocaso' });
    expect(plaque).toEqual({ icon: 'refuge', variant: 'town', name: 'Refugio del Ocaso', subtitle: null, note: null });
    const floor = plaqueOf(dungeonPlace(DUNGEONS[0]!), { name: 'Cripta', subtitle: ['Planta 6', 'Difícil'], note: 'El aire tiembla.' });
    expect(floor.subtitle).toBe('Planta 6 · Difícil');
    expect(floor.note).toBe('El aire tiembla.');
  });
});

describe('plaque timing', () => {
  it('unfurls 260 ms, then icon and text rise 160 ms staggered, holds 2.2 s and leaves in 300 ms', () => {
    const timing = plaqueTiming(false);
    expect(timing.motion).toBe('unfurl');
    expect(timing.unfurlMs).toBe(260);
    expect(timing.riseMs).toBe(160);
    expect(timing.holdMs).toBe(2200);
    expect(timing.outMs).toBe(300);
    expect(timing.textDelayMs).toBeGreaterThan(timing.iconDelayMs);
    expect(timing.inMs).toBe(timing.textDelayMs + timing.riseMs);
    expect(timing.totalMs).toBe(timing.inMs + timing.holdMs + timing.outMs);
  });

  it('honours prefers-reduced-motion with a plain fade (no unfurl, no rise)', () => {
    const timing = plaqueTiming(true);
    expect(timing.motion).toBe('fade');
    expect(timing.unfurlMs).toBe(0);
    expect(timing.riseMs).toBe(0);
    expect(timing.textDelayMs).toBe(0);
    expect(timing.totalMs).toBeLessThan(plaqueTiming(false).totalMs);
  });

  it('walks in, hold, out and gone', () => {
    const timing = plaqueTiming(false);
    expect(plaquePhase(timing, -1)).toBe('gone');
    expect(plaquePhase(timing, 10)).toBe('in');
    expect(plaquePhase(timing, timing.inMs + 100)).toBe('hold');
    expect(plaquePhase(timing, timing.inMs + timing.holdMs + 100)).toBe('out');
    expect(plaquePhase(timing, timing.totalMs + 1)).toBe('gone');
  });
});
