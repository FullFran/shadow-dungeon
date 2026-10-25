import { afterEach, describe, expect, it } from 'vitest';
import { fitCanvas } from '../../src/adapters/fit';
import { itemsChip } from '../../src/adapters/hud';
import { setLanguage } from '../../src/i18n';
import { type HudBox, hudRects, hudScaleFor, hudSpace } from '../../src/ui/hud-layout';

const VIEW = { width: 512, height: 320 };
const MINIMAP = { cols: 40, rows: 28 };

/** HUD space and rects for a window, as the game computes them. */
function layoutFor(viewportW: number, viewportH: number, touch: boolean, dpr = 1) {
  const fit = fitCanvas(viewportW, viewportH, VIEW.width, VIEW.height, dpr, touch);
  const scale = hudScaleFor(viewportW, viewportH, fit.pixelScale, touch);
  const space = hudSpace(VIEW.width * fit.pixelScale, VIEW.height * fit.pixelScale, scale);
  // CSS pixels per backing-store pixel (1 on desktop).
  const css = fit.cssWidth / (VIEW.width * fit.pixelScale);
  return { fit, scale, space, css, rects: hudRects(space, { chip: true, slots: 2, minimap: MINIMAP }) };
}

const overlaps = (a: HudBox, b: HudBox): boolean => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('HUD scale', () => {
  it('desktop picks a HUD scale from the viewport, below the canvas scale on big screens', () => {
    expect(hudScaleFor(1280, 720, 2, false)).toBe(1);
    expect(hudScaleFor(1024, 640, 2, false)).toBe(1);
    expect(hudScaleFor(1920, 1080, 3, false)).toBe(2);
    expect(hudScaleFor(3840, 2160, 6, false)).toBe(4);
    // Never above the canvas scale (a tiny window keeps the view-space HUD).
    expect(hudScaleFor(600, 400, 1, false)).toBe(1);
  });

  it('touch keeps the canvas scale, so the HUD space stays the 512x320 view', () => {
    const { fit, scale, space } = layoutFor(844, 390, true, 3);
    expect(scale).toBe(fit.pixelScale);
    expect(space).toEqual({ scale, width: VIEW.width, height: VIEW.height });
  });
});

describe('HUD layout', () => {
  for (const [w, h] of [
    [1280, 720],
    [1920, 1080],
    [1024, 640],
  ] as const) {
    it(`keeps the status window small at ${w}x${h}`, () => {
      const { rects, scale, css } = layoutFor(w, h, false);
      const status = rects.status;
      expect((status.width * scale * css) / w).toBeLessThanOrEqual(0.22);
      expect((status.height * scale * css) / h).toBeLessThanOrEqual(0.14);
      expect((status.width * status.height * scale * scale) / (w * h)).toBeLessThanOrEqual(0.03);
    });
  }

  for (const [w, h, touch] of [
    [1280, 720, false],
    [1920, 1080, false],
    [1024, 640, false],
    [844, 390, true],
  ] as const) {
    it(`no HUD panels overlap and all fit at ${w}x${h}${touch ? ' (touch)' : ''}`, () => {
      const { rects, space } = layoutFor(w, h, touch, touch ? 3 : 1);
      const boxes: [string, HudBox][] = [
        ['status', rects.status],
        ['log', rects.log],
        ['boss', rects.boss],
        ...(rects.minimap ? [['minimap', rects.minimap] as [string, HudBox]] : []),
        ...rects.slots.map((s, i) => [`slot${i}`, s] as [string, HudBox]),
      ];
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

  it('the status window does not grow with the held items (one chip line at most)', () => {
    const space = { width: 1024, height: 640 };
    const none = hudRects(space, { chip: false, slots: 2 }).status;
    const some = hudRects(space, { chip: true, slots: 2 }).status;
    expect(some.width).toBe(none.width);
    expect(some.height - none.height).toBeLessThanOrEqual(12);
  });

  it('touch keeps the same rects as the view-space HUD it had', () => {
    const { rects } = layoutFor(844, 390, true, 3);
    expect(rects.status).toMatchObject({ x: 6, y: 6, width: 196 });
    expect(rects.slots.at(-1)).toEqual({ x: VIEW.width - 6 - 104, y: VIEW.height - 6 - 30, width: 104, height: 30 });
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
