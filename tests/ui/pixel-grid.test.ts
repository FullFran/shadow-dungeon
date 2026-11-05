import { describe, expect, it } from 'vitest';
import { Grid, seeded } from '../../src/ui/pixel-grid';

function fakeCtx() {
  const calls: [string, number, number, number, number][] = [];
  const ctx = { fillStyle: '', fillRect(x: number, y: number, w: number, h: number) { calls.push([String(this.fillStyle), x, y, w, h]); } };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('pixel grid', () => {
  it('paints palette keys and skips unknown ones', () => {
    const { ctx, calls } = fakeCtx();
    new Grid(ctx, { a: '#112233' }).rect(1, 2, 3, 4, 'a').rect(0, 0, 1, 1, 'zz').set(5, 5, 'a');
    expect(calls).toEqual([['#112233', 1, 2, 3, 4], ['#112233', 5, 5, 1, 1]]);
  });

  it('fills an ellipse row by row within its radii', () => {
    const { ctx, calls } = fakeCtx();
    new Grid(ctx, { a: '#000000' }).ellipse(10, 10, 4, 2, 'a');
    for (const [, x, y, w] of calls) {
      expect(x).toBeGreaterThanOrEqual(6);
      expect(x + w).toBeLessThanOrEqual(15);
      expect(Math.abs(y - 10)).toBeLessThanOrEqual(2);
    }
    expect(calls.length).toBe(5);
  });

  it('seeded streams repeat for a seed and differ between seeds', () => {
    const a = seeded(7), b = seeded(7), c = seeded(8);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });
});
