import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { cartoucheRect, compassRect, menuGeometry, menuTiming, placeCard, seedOf, sheetFit, SHEET_MARGIN, TILE_ART, tornMask } from '../../src/town/sheet-model';

// Owner, 2026-11-04: the town menu is a map that shows the whole town, large, with a torn parchment edge, rising from the bottom.
const VIEWPORTS = [
  [1920, 1080],
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [844, 390],
] as const;
const maps = Object.values(WORLD);

describe('menu geometry', () => {
  it('takes about 94vw x 88vh, capped at 1500 x 900', () => {
    const big = menuGeometry(1920, 1080);
    expect(big.panel).toEqual({ w: 1500, h: 900 });
    const small = menuGeometry(1280, 720);
    expect(small.panel.w).toBeCloseTo(1280 * 0.94, 0);
    expect(small.panel.h).toBeCloseTo(720 * 0.88, 0);
  });

  it('gives the map 60% of the width on the short landscape phone and the rest to the options', () => {
    const g = menuGeometry(844, 390);
    expect(g.compact).toBe(true);
    expect(g.mapBox.w / (g.panel.w - 2 * g.pad)).toBeCloseTo(0.6, 1);
    expect(menuGeometry(1440, 900).compact).toBe(false);
  });

  it('keeps both boxes inside the panel', () => {
    for (const [w, h] of VIEWPORTS) {
      const g = menuGeometry(w, h);
      expect(g.mapBox.w + g.optionsBox.w + g.gap + 2 * g.pad, `${w}x${h}`).toBeLessThanOrEqual(g.panel.w + 0.001);
      expect(g.mapBox.h + 2 * g.pad, `${w}x${h}`).toBeLessThanOrEqual(g.panel.h + 0.001);
    }
  });
});

describe('sheetFit shows the whole map at every viewport', () => {
  for (const map of maps) {
    const cols = Math.max(...map.rows.map((r) => r.length));
    for (const [w, h] of VIEWPORTS) {
      it(`${map.id} at ${w}x${h}`, () => {
        const { mapBox } = menuGeometry(w, h);
        const fit = sheetFit(cols, map.rows.length, mapBox.w, mapBox.h);
        expect(fit.artW).toBe(cols * TILE_ART + 2 * SHEET_MARGIN);
        expect(fit.artH).toBe(map.rows.length * TILE_ART + 2 * SHEET_MARGIN);
        expect(fit.width).toBeCloseTo(fit.artW * fit.scale, 5);
        expect(fit.width).toBeLessThanOrEqual(mapBox.w + 0.001);
        expect(fit.height).toBeLessThanOrEqual(mapBox.h + 0.001);
        // Largest scale: the whole map fills one side of the box.
        const raw = Math.min(mapBox.w / fit.artW, mapBox.h / fit.artH);
        if (Number.isInteger(fit.scale)) {
          expect(fit.scale + 1).toBeGreaterThan(raw);
          // A whole scale is only kept while it wastes at most 30% of the limiting side.
          expect(fit.scale / raw).toBeGreaterThanOrEqual(0.7);
        } else {
          expect(fit.scale).toBeCloseTo(raw, 5);
          expect(Math.floor(raw) / raw < 0.7 || Math.floor(raw) < 1).toBe(true);
        }
      });
    }
  }

  it('is crisp (whole scale) on the big desktop windows', () => {
    const { mapBox } = menuGeometry(1920, 1080);
    expect(Number.isInteger(sheetFit(32, 24, mapBox.w, mapBox.h).scale)).toBe(true);
  });
});

describe('entrance timing', () => {
  it('slides up 260 ms, leaves in 200 ms, veil 160 ms', () => {
    expect(menuTiming(false)).toEqual({ kind: 'slide', enterMs: 260, exitMs: 200, veilMs: 160 });
  });
  it('is a plain fade under reduced motion (no travel)', () => {
    const t = menuTiming(true);
    expect(t.kind).toBe('fade');
    expect(t.enterMs).toBeLessThanOrEqual(160);
    expect(t.exitMs).toBeLessThanOrEqual(160);
  });
});

describe('torn edge mask', () => {
  const W = 300;
  const H = 220;
  const seed = seedOf('refugio');
  const mask = tornMask(W, H, seed);

  it('is deterministic for a seed and differs between seeds', () => {
    expect(Array.from(tornMask(W, H, seed))).toEqual(Array.from(mask));
    expect(Array.from(tornMask(W, H, seedOf('lago')))).not.toEqual(Array.from(mask));
    expect(seedOf('refugio')).toBe(seed);
    expect(seedOf('lago')).not.toBe(seed);
  });

  it('has the right size, drops the corners and keeps the middle', () => {
    expect(mask.length).toBe(W * H);
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) expect(mask[y! * W + x!]).toBe(0);
    expect(mask[(H >> 1) * W + (W >> 1)]).toBe(3);
  });

  it('is irregular on all four sides (the first kept pixel varies along the edge)', () => {
    const distinct = (read: (i: number) => number, len: number) => {
      const out = new Set<number>();
      for (let i = 8; i < len - 8; i++) out.add(read(i));
      return out.size;
    };
    const left = (y: number) => { let x = 0; while (mask[y * W + x] === 0) x++; return x; };
    const right = (y: number) => { let x = W - 1; while (mask[y * W + x] === 0) x--; return W - 1 - x; };
    const top = (x: number) => { let y = 0; while (mask[y * W + x] === 0) y++; return y; };
    const bottom = (x: number) => { let y = H - 1; while (mask[y * W + x] === 0) y--; return H - 1 - y; };
    expect(distinct(left, H)).toBeGreaterThanOrEqual(5);
    expect(distinct(right, H)).toBeGreaterThanOrEqual(5);
    expect(distinct(top, W)).toBeGreaterThanOrEqual(5);
    expect(distinct(bottom, W)).toBeGreaterThanOrEqual(5);
  });

  it('never bites into the map content (the margin is a torn band only)', () => {
    for (let y = SHEET_MARGIN; y < H - SHEET_MARGIN; y += 3) for (const x of [SHEET_MARGIN, W - SHEET_MARGIN - 1]) expect(mask[y * W + x], `${x},${y}`).toBe(3);
    for (let x = SHEET_MARGIN; x < W - SHEET_MARGIN; x += 3) for (const y of [SHEET_MARGIN, H - SHEET_MARGIN - 1]) expect(mask[y * W + x], `${x},${y}`).toBe(3);
  });

  it('marks a burnt rim, then a singed band, then clean paper, from the edge in', () => {
    const states = new Set(mask);
    expect(states.has(1)).toBe(true);
    expect(states.has(2)).toBe(true);
    expect(states.has(3)).toBe(true);
    const y = H >> 1;
    let x = 0;
    while (mask[y * W + x] === 0) x++;
    expect(mask[y * W + x]).toBe(1);
  });
});

describe('placeCard', () => {
  const bounds = { w: 800, h: 600 };
  const card = { w: 260, h: 120 };
  it('sits above the pin, centred, with its arrow on the pin', () => {
    const p = placeCard({ x: 400, y: 300 }, card, bounds, 14);
    expect(p.side).toBe('above');
    expect(p.x).toBeCloseTo(400 - 130, 5);
    expect(p.y + card.h + 14).toBeCloseTo(300, 5);
    expect(p.arrowX).toBeCloseTo(130, 5);
  });
  it('flips below when there is no room above and clamps inside the bounds', () => {
    const p = placeCard({ x: 10, y: 40 }, card, bounds, 14);
    expect(p.side).toBe('below');
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThan(40);
    expect(p.arrowX).toBeCloseTo(10 - p.x, 5);
    const r = placeCard({ x: 790, y: 300 }, card, bounds, 14);
    expect(r.x + card.w).toBeLessThanOrEqual(bounds.w);
  });
});

describe('ornament rectangles', () => {
  it('keep the cartouche and the compass inside the sheet, apart from each other', () => {
    const artW = 284;
    const artH = 220;
    const c = cartoucheRect(artW);
    const k = compassRect(artW, artH);
    for (const r of [c, k]) {
      expect(r.w).toBeGreaterThan(0);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(artW);
      expect(r.y + r.h).toBeLessThanOrEqual(artH);
    }
    expect(c.y + c.h <= k.y || c.x + c.w <= k.x).toBe(true);
  });
});
