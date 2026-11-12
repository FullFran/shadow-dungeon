import { describe, expect, it } from 'vitest';
import { GLOW_REACH, MIN_CORE_SCREEN_PX } from '../../src/adapters/bullet-art';
import { MARK_COLORS, MARK_HEIGHT, MARK_POP_MS, MARK_POP_SCALE, MARK_WIDTH, perilousMarkGrid, perilousMarkScale, perilousRim, RIM_SPIKES } from '../../src/adapters/perilous-art';

/** The perilous cue's art (odd/tasks/perilous-counter.md S1). */
describe('perilous mark', () => {
  const grid = perilousMarkGrid();

  it('is a warning triangle of known size, symmetric, every cell a palette role', () => {
    expect(grid).toHaveLength(MARK_HEIGHT);
    for (const row of grid) {
      expect(row).toHaveLength(MARK_WIDTH);
      expect(row).toBe([...row].reverse().join(''));
      for (const c of row) expect(c === '.' || c in MARK_COLORS).toBe(true);
    }
    // A point on top, a full outlined base: the silhouette reads without its colour.
    expect(grid[0]!.replace(/\./g, '')).toBe('o');
    expect(grid[MARK_HEIGHT - 1]).toBe('o'.repeat(MARK_WIDTH));
  });

  it('carries a thick white "!" (a bar and a dot, 3 cells wide) inside red', () => {
    const whiteRows = grid.map((row, y) => ({ y, n: [...row].filter((c) => c === 'w').length })).filter((r) => r.n > 0);
    expect(whiteRows.every((r) => r.n === 3)).toBe(true);
    const ys = whiteRows.map((r) => r.y);
    // A gap between the bar and the dot.
    expect(ys.some((y, i) => i > 0 && y - ys[i - 1]! > 1)).toBe(true);
    expect(grid.join('').split('r').length - 1).toBeGreaterThan(40);
  });

  it('is big on the smallest phone view (568x320): over twice the smallest bullet core across', () => {
    expect(MARK_WIDTH).toBeGreaterThan(MIN_CORE_SCREEN_PX * 4);
  });

  it('pops in big at its wind-up start and settles near 1', () => {
    expect(perilousMarkScale(0, 0)).toBe(MARK_POP_SCALE);
    expect(perilousMarkScale(MARK_POP_MS / 2, 0)).toBeLessThan(MARK_POP_SCALE);
    for (const t of [0, 300, 1000]) {
      const s = perilousMarkScale(MARK_POP_MS + 1, t);
      expect(s).toBeGreaterThan(0.9);
      expect(s).toBeLessThan(1.1);
    }
  });
});

describe('perilous rim', () => {
  it("sits outside the bullet's colour and glow at every size (the core stays the hitbox), with its spikes", () => {
    for (const radius of [2, 3, 5, 7, 10, 16]) {
      const rim = perilousRim(radius, 1234);
      expect(rim.ring).toBeGreaterThan(radius * GLOW_REACH);
      expect(rim.spikes).toHaveLength(RIM_SPIKES);
      for (const s of rim.spikes) expect(s.outer).toBeGreaterThan(s.inner);
      expect(rim.pulse).toBeGreaterThanOrEqual(0);
      expect(rim.pulse).toBeLessThanOrEqual(1);
    }
  });

  it('turns and pulses with time (shape and motion, not only colour)', () => {
    const a = perilousRim(5, 0);
    const b = perilousRim(5, 400);
    expect(b.spikes[0]!.angle).not.toBe(a.spikes[0]!.angle);
    expect(b.pulse).not.toBe(a.pulse);
  });
});

describe('counterstep feedback', () => {
  it('a counter flashes its own named toast, with a hitstop and a shake', async () => {
    const { applyEvents, initialJuice } = await import('../../src/adapters/juice');
    const { flashText } = await import('../../src/adapters/hud');
    const { t } = await import('../../src/i18n');
    const juice = applyEvents(initialJuice(), [{ type: 'perilousCounter', pos: { x: 0, y: 0 } }], { x: 0, y: 0 });
    expect(juice.flash?.kind).toBe('counter');
    expect(juice.hitstopMs).toBeGreaterThan(0);
    expect(juice.shakeMs).toBeGreaterThan(0);
    expect(flashText(juice.flash!)).toBe(t('hud.counter'));
  });
});
