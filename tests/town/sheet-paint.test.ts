import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { TOWN_PROPS } from '../../src/data/town';
import { paintTownSheet, PAINTED_PROPS } from '../../src/town/sheet-paint';
import { SHEET_MARGIN, TILE_ART } from '../../src/town/sheet-model';

const hash = (d: Uint8ClampedArray): number => {
  let h = 2166136261;
  for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i]!, 16777619);
  return h >>> 0;
};

describe('the painted town sheet', () => {
  it('has a painter for every prop kind of the game', () => {
    expect([...PAINTED_PROPS].sort()).toEqual(Object.keys(TOWN_PROPS).sort());
  });

  for (const map of Object.values(WORLD)) {
    it(`${map.id}: is the map's size plus the torn margin, deterministic, opaque inside and transparent at the corners`, () => {
      const cols = Math.max(...map.rows.map((r) => r.length));
      const a = paintTownSheet(map);
      expect(a.w).toBe(cols * TILE_ART + 2 * SHEET_MARGIN);
      expect(a.h).toBe(map.rows.length * TILE_ART + 2 * SHEET_MARGIN);
      expect(hash(paintTownSheet(map).data)).toBe(hash(a.data));
      const alpha = (x: number, y: number) => a.data[(y * a.w + x) * 4 + 3]!;
      expect(alpha(0, 0)).toBe(0);
      expect(alpha(a.w - 1, a.h - 1)).toBe(0);
      for (let y = SHEET_MARGIN; y < a.h - SHEET_MARGIN; y += 5) for (let x = SHEET_MARGIN; x < a.w - SHEET_MARGIN; x += 5) expect(alpha(x, y)).toBe(255);
    });
  }

  it('looks different on different maps (not one picture)', () => {
    expect(hash(paintTownSheet(WORLD.refugio).data)).not.toBe(hash(paintTownSheet(WORLD.ruinas).data));
  });

  it('stays in a warm parchment range (no neon, no pure white)', () => {
    const s = paintTownSheet(WORLD.refugio);
    let paper = 0;
    for (let i = 0; i < s.data.length; i += 4) {
      if (s.data[i + 3] === 0) continue;
      const [r, g, b] = [s.data[i]!, s.data[i + 1]!, s.data[i + 2]!];
      expect(Math.max(r, g, b)).toBeLessThan(250);
      if (r > 150 && r >= g && g >= b) paper++;
    }
    expect(paper).toBeGreaterThan((s.w * s.h) / 3);
  });
});
