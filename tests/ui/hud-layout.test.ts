import { afterEach, describe, expect, it } from 'vitest';
import { playViewport } from '../../src/adapters/viewport';
import { itemsChip } from '../../src/adapters/hud';
import { setLanguage } from '../../src/i18n';
import { type HudBox, hudRects, hudScaleFor, hudSpace, liftHintBand } from '../../src/ui/hud-layout';
import { hintBand } from '../../src/ui/play-hints-model';

const MINIMAP = { cols: 40, rows: 28 };

/** HUD space and rects for a window, as the game computes them. */
function layoutFor(viewportW: number, viewportH: number, touch: boolean, dpr = 1, extra: { slots?: number; partners?: number } = {}) {
  const fit = playViewport(viewportW, viewportH, dpr, touch);
  const scale = hudScaleFor(viewportW, viewportH, fit.pixelScale, touch);
  const space = hudSpace(fit.viewWidth * fit.pixelScale, fit.viewHeight * fit.pixelScale, scale);
  // CSS pixels per backing-store pixel (1 on desktop).
  const css = fit.cssWidth / (fit.viewWidth * fit.pixelScale);
  return { fit, scale, space, css, rects: hudRects(space, { chip: true, slots: extra.slots ?? 2, partners: extra.partners ?? 0, minimap: MINIMAP, touch }) };
}

const overlaps = (a: HudBox, b: HudBox): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('HUD scale', () => {
  it('desktop scales with the viewport: 2 at 1280x720, 3 at 1920x1080, half steps below 2, never under 1', () => {
    expect(hudScaleFor(1280, 720, 2, false)).toBe(2);
    expect(hudScaleFor(1700, 950, 2, false)).toBe(2);
    expect(hudScaleFor(1920, 1080, 3, false)).toBe(3);
    expect(hudScaleFor(1440, 900, 2, false)).toBe(2);
    expect(hudScaleFor(1024, 640, 1, false)).toBe(1.5);
    expect(hudScaleFor(3840, 2160, 6, false)).toBe(6);
    expect(hudScaleFor(600, 400, 1, false)).toBe(1);
  });

  it('touch keeps the canvas scale, so the HUD space is the whole view (320 high on a phone held sideways)', () => {
    const { fit, scale, space } = layoutFor(844, 390, true, 3);
    expect(scale).toBe(fit.pixelScale);
    expect(space).toEqual({ scale, width: fit.viewWidth, height: fit.viewHeight });
    expect(space.height).toBe(320);
  });

  it('a 1280x720 window gets a 640x360 HUD space (the regular layout); a phone gets the compact one', () => {
    expect(layoutFor(1280, 720, false).space).toMatchObject({ width: 640, height: 360 });
    expect(layoutFor(1280, 720, false).rects.variant).toBe('regular');
    expect(layoutFor(844, 390, true, 3).rects.variant).toBe('compact');
  });
});

const VIEWPORTS = [
  [1920, 1080, false],
  [1700, 950, false],
  [1440, 900, false],
  [1280, 720, false],
  [1024, 640, false],
  [800, 600, false],
  [844, 390, true],
  [568, 320, true],
] as const;

/** The hint bar's footprint in HUD pixels: its free band, lifted over the boss block while a boss fights. 56 CSS px tall covers the enlarged bar. */
const hintBox = (band: { left: number; right: number; bottom: number }, space: { height: number }, scale: number): HudBox => ({ x: band.left, y: space.height - band.bottom - 56 / scale, width: band.right - band.left, height: 56 / scale });

describe('HUD layout', () => {
  for (const [w, h, touch] of VIEWPORTS) {
    it(`no HUD panel overlaps another and all fit at ${w}x${h}${touch ? ' (touch)' : ''}, boss fight with a full party`, () => {
      const { rects, space, scale } = layoutFor(w, h, touch, touch ? 3 : 1, { slots: 4, partners: 3 });
      const band = liftHintBand(hintBand(space, 4), rects.boss, space);
      const boxes: [string, HudBox][] = [
        ['status', rects.status],
        ['log', rects.log],
        ['boss', rects.boss],
        ['minimap', rects.minimap!],
        ...rects.partners.map((p, i) => [`partner${i}`, p] as [string, HudBox]),
        ...rects.slots.map((s, i) => [`slot${i}`, s] as [string, HudBox]),
        ...(touch ? [] : [['hint', hintBox(band, space, scale)] as [string, HudBox]]),
      ];
      expect(rects.partners).toHaveLength(3);
      for (const [name, box] of boxes) {
        expect(box.x, name).toBeGreaterThanOrEqual(0);
        expect(box.y, name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, name).toBeLessThanOrEqual(space.width);
        expect(box.y + box.height, name).toBeLessThanOrEqual(space.height);
      }
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i]![1], boxes[j]![1]), `${boxes[i]![0]} vs ${boxes[j]![0]}`).toBe(false);
    });
  }

  for (const [w, h, touch] of VIEWPORTS) {
    it(`the boss bar is wide and sits bottom-centre at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      const { rects, space } = layoutFor(w, h, touch, touch ? 3 : 1);
      const centre = rects.boss.x + rects.boss.width / 2;
      expect(Math.abs(centre - space.width / 2)).toBeLessThanOrEqual(1);
      expect(rects.boss.y + rects.boss.height).toBeGreaterThan(space.height * 0.6);
      const share = rects.boss.width / space.width;
      if (touch) expect(share).toBeGreaterThanOrEqual(0.4);
      else {
        expect(share).toBeGreaterThanOrEqual(0.5);
        expect(share).toBeLessThanOrEqual(0.62);
      }
    });
  }

  for (const [w, h] of VIEWPORTS.filter((v) => !v[2])) {
    it(`desktop ${w}x${h}: slots are square, at least 44 CSS px, in the bottom-right corner`, () => {
      const { rects, space, scale } = layoutFor(w, h, false, 1, { slots: 4 });
      for (const slot of rects.slots) {
        expect(slot.width).toBe(slot.height);
        expect(slot.width * scale).toBeGreaterThanOrEqual(44);
        expect(slot.x).toBeGreaterThan(space.width / 2);
        expect(slot.y).toBeGreaterThan(space.height / 2);
      }
    });

    it(`desktop ${w}x${h}: the status panel stays in the top-left corner, under a third of the width`, () => {
      const { rects, space } = layoutFor(w, h, false);
      expect(rects.status.x).toBeLessThanOrEqual(10);
      expect(rects.status.y).toBeLessThanOrEqual(10);
      expect(rects.status.width / space.width).toBeLessThanOrEqual(0.36);
      expect(rects.status.height / space.height).toBeLessThanOrEqual(0.3);
    });
  }

  it('with no boss the message log drops to the bottom edge', () => {
    const space = { width: 640, height: 360 };
    const quiet = hudRects(space, { chip: false, slots: 2, boss: false });
    const fight = hudRects(space, { chip: false, slots: 2, boss: true });
    expect(quiet.log.y + quiet.log.height).toBeGreaterThan(fight.log.y + fight.log.height);
    expect(fight.log.y + fight.log.height).toBeLessThanOrEqual(fight.boss.y);
  });

  it('lifting the hint bar for a boss fight raises it over the boss block and changes nothing else', () => {
    const space = { width: 640, height: 360 };
    const rects = hudRects(space, { chip: true, slots: 4 });
    const band = hintBand(space, 4);
    const lifted = liftHintBand(band, rects.boss, space);
    expect(lifted.bottom).toBeGreaterThanOrEqual(space.height - rects.boss.y);
    expect(lifted.left).toBe(band.left);
    expect(lifted.right).toBe(band.right);
    expect(liftHintBand(band, null, space)).toEqual(band);
  });

  it('the status window does not grow with the held items (one chip line at most)', () => {
    const space = { width: 1024, height: 640 };
    const none = hudRects(space, { chip: false, slots: 2 }).status;
    const some = hudRects(space, { chip: true, slots: 2 }).status;
    expect(some.width).toBe(none.width);
    expect(some.height - none.height).toBeLessThanOrEqual(12);
  });

  it('touch keeps the status window clear of the Pause button and draws no slot windows over the thumbs', () => {
    const { rects } = layoutFor(844, 390, true, 3);
    expect(rects.status).toMatchObject({ x: 68, y: 6 });
    expect(rects.slots).toEqual([]);
  });
});

describe('held items chip', () => {
  afterEach(() => setLanguage('es'));

  it('replaces the badges with a count and the Esc hint on desktop', () => {
    setLanguage('es');
    expect(itemsChip(0, false)).toBeNull();
    expect(itemsChip(12, false)).toBe('Objetos equipados ×12 · Esc');
    expect(itemsChip(3, true)).toBe('Objetos equipados ×3');
    setLanguage('en');
    expect(itemsChip(1, false)).toBe('Held items ×1 · Esc');
  });
});
