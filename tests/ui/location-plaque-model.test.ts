import { describe, expect, it } from 'vitest';
import { CHALLENGES, DUNGEONS, SENDA_ROADS, TUTORIAL } from '../../src/data/dungeons';
import { SIMA_BANDS } from '../../src/data/sima';
import { WORLD } from '../../src/data/world';
import { catalog } from '../../src/i18n';
import { PLACE_ICONS } from '../../src/ui/icons/place-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';
import { hudRects, hudScaleFor, hudSpace } from '../../src/ui/hud-layout';
import { playViewport } from '../../src/adapters/viewport';
import { BOSS_PLACE, dungeonPlace, plaqueBox, plaqueMetrics, PLAQUE_VARIANTS, plaquePhase, plaqueTiming, plaqueOf, shrinePlace, simaBandPlace, townPlace, type PlaceDef } from '../../src/ui/location-plaque-model';

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

/** The plaque follows the HUD scale rule (src/ui/hud-layout.ts): modestly larger on big windows, never invasive. */
describe('location plaque size', () => {
  const hudScale = (w: number, h: number, touch: boolean): number => hudScaleFor(w, h, playViewport(w, h, touch ? 3 : 1, touch).pixelScale, touch);

  it('keeps today at the smallest scale and grows by steps with the HUD scale, inside name 20-26 px and icon 32-40 px', () => {
    const at = (w: number, h: number) => plaqueMetrics(hudScale(w, h, false), false);
    expect(at(800, 600)).toMatchObject({ name: 22, icon: 32 });
    expect(at(1440, 900).name).toBeGreaterThan(22);
    expect(at(1440, 900).icon).toBeGreaterThan(32);
    expect(at(1920, 1080).name).toBeGreaterThanOrEqual(at(1440, 900).name);
    for (const [w, h] of [[800, 600], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]] as const) {
      const m = plaqueMetrics(hudScale(w, h, false), false);
      expect(m.name, `${w}x${h}`).toBeGreaterThanOrEqual(20);
      expect(m.name, `${w}x${h}`).toBeLessThanOrEqual(26);
      expect(m.icon, `${w}x${h}`).toBeGreaterThanOrEqual(32);
      expect(m.icon, `${w}x${h}`).toBeLessThanOrEqual(40);
    }
  });

  it('touch keeps the small plaque (18 px name, 32 px icon)', () => {
    expect(plaqueMetrics(2, true)).toMatchObject({ name: 18, icon: 32 });
  });

  for (const [w, h, touch] of [[1920, 1080, false], [1700, 950, false], [1440, 900, false], [1280, 720, false], [1024, 640, false], [800, 600, false]] as const) {
    it(`its largest box clears the status block, the minimap and the boss strip at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      // Touch keeps its own rule (phones held sideways): the plaque there is not part of this proof.
      const fit = playViewport(w, h, touch ? 3 : 1, touch);
      const scale = hudScaleFor(w, h, fit.pixelScale, touch);
      const space = hudSpace(fit.viewWidth * fit.pixelScale, fit.viewHeight * fit.pixelScale, scale);
      const rects = hudRects(space, { chip: true, slots: 4, partners: 3, minimap: { cols: 40, rows: 28 }, touch });
      // HUD px -> CSS px.
      const css = fit.cssWidth / (fit.viewWidth * fit.pixelScale);
      const unit = css * scale;
      const box = plaqueBox(fit.cssWidth, fit.cssHeight, unit, touch);
      const toCss = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x * unit, y: b.y * unit, width: b.width * unit, height: b.height * unit });
      const hit = (a: typeof box, b: typeof box) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      for (const [name, r] of [['status', rects.status], ['chips', rects.chips], ['minimap', rects.minimap!], ['boss', rects.boss], ['caption', rects.caption]] as const) expect(hit(box, toCss(r)), name).toBe(false);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(fit.cssWidth);
    });
  }
});
