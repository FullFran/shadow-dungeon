import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES } from '../../src/data/types';
import { ATLAS_PAGE, BAKE_BUDGET_MS, cellOrigin, createBulletAtlas } from '../../src/adapters/bullet-atlas';
import { BULLET_ANIMS, BULLET_DIRS, cellSize, HANG_STEPS, MAX_BAKED_RADIUS, paintBullet, paintHangRing } from '../../src/adapters/bullet-art';

const CELLS = BULLET_DIRS * BULLET_ANIMS + HANG_STEPS;

/** A headless atlas: stub canvases that record what is put on them, a clock that ticks `msPerRead` on every read, and a hand-run scheduler. */
function harness(msPerRead = 1) {
  const puts: { image: ImageData; x: number; y: number }[] = [];
  const pending: ((budgetMs: number) => void)[] = [];
  let clock = 0;
  const atlas = createBulletAtlas({
    makeCanvas: () => ({ getContext: () => ({ putImageData: (image: ImageData, x: number, y: number) => puts.push({ image, x, y }) }) }) as unknown as HTMLCanvasElement,
    makeImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) as ImageData,
    schedule: (bake) => pending.push(bake),
    now: () => (clock += msPerRead),
  });
  const draws: number[][] = [];
  const ctx = { drawImage: (...args: number[]) => draws.push(args.slice(1)) } as unknown as CanvasRenderingContext2D;
  /** Runs the next scheduled bake callback, as the browser would in its next idle period; false when none is scheduled. */
  const idle = (budgetMs = BAKE_BUDGET_MS): boolean => {
    const bake = pending.shift();
    bake?.(budgetMs);
    return bake !== undefined;
  };
  return { atlas, ctx, puts, draws, pending, idle };
}

describe('bullet atlas: the bake never freezes a frame', () => {
  it('drawing a type not baked yet bakes nothing: it queues the block, schedules the bake and returns false (the caller draws its orb)', () => {
    const { atlas, ctx, draws, pending } = harness();
    for (const type of POKEMON_TYPES) expect(atlas.draw(ctx, type, 9, { x: 0, y: 0 }, 0, { state: 'flying', angle: 0 }), type).toBe(false);
    expect(atlas.stats()).toMatchObject({ blocks: 0, pending: POKEMON_TYPES.length, cells: 0 });
    expect(draws).toHaveLength(0);
    // One bake scheduled, not one per draw.
    expect(pending).toHaveLength(1);
  });

  it('each bake call stops once over its budget: a block takes many small calls, never one', () => {
    // Every clock read ticks 1 ms: a call paints a cell, reads the clock, and stops at the budget.
    const { atlas, ctx, idle } = harness(1);
    atlas.draw(ctx, 'fire', 16, { x: 0, y: 0 }, 0, { state: 'flying' });
    let before = 0;
    let calls = 0;
    while (atlas.stats().pending > 0) {
      expect(idle()).toBe(true);
      calls++;
      const cells = atlas.stats().cells;
      expect(cells - before).toBeLessThanOrEqual(BAKE_BUDGET_MS);
      before = cells;
    }
    expect(atlas.stats().cells).toBe(CELLS);
    expect(calls).toBeGreaterThanOrEqual(Math.ceil(CELLS / BAKE_BUDGET_MS));
    // Spent time per call is the budget plus the read after the last cell, never the whole block.
    expect(atlas.stats().longestCallMs).toBeLessThanOrEqual(BAKE_BUDGET_MS + 1);
  });

  it('allocating a page is a bake step of its own, done ahead of need: pages 0 and 1 when the atlas is made, a spare once the last is in use', () => {
    const { atlas, ctx, puts, pending, idle } = harness(100);
    // Made at boot: two pages queued for their first touch before any bullet is drawn, one step each.
    expect(pending).toHaveLength(1);
    expect(atlas.stats().pages).toBe(2);
    idle(0);
    expect(puts).toHaveLength(1);
    idle(0);
    expect(puts).toHaveLength(2);
    expect(idle()).toBe(false);
    // Blocks land on allocated pages, cells only: a radius-16 block per page.
    atlas.draw(ctx, 'rock', 16, { x: 0, y: 0 }, 0, { state: 'flying' });
    for (let i = 0; i < CELLS; i++) idle(0);
    expect(atlas.stats()).toMatchObject({ cells: CELLS, pending: 0, pages: 2 });
    expect(puts.map((p) => p.image.width)).toEqual([1, 1, 8 * cellSize(16)]);
    // The second page gets a block: a spare page 2 is made and touched in its own step, after the cells.
    atlas.draw(ctx, 'fire', 16, { x: 0, y: 0 }, 0, { state: 'flying' });
    expect(atlas.stats().pages).toBe(3);
    for (let i = 0; i < CELLS; i++) idle(0);
    expect(puts.map((p) => p.image.width)).toEqual([1, 1, 8 * cellSize(16), 8 * cellSize(16)]);
    idle(0);
    expect(puts.map((p) => p.image.width)).toEqual([1, 1, 8 * cellSize(16), 8 * cellSize(16), 1]);
    expect(idle()).toBe(false);
  });

  it('the biggest baked bullet\'s block fits one page', () => {
    expect(8 * cellSize(MAX_BAKED_RADIUS)).toBeLessThanOrEqual(ATLAS_PAGE);
    expect(Math.ceil(CELLS / 8) * cellSize(MAX_BAKED_RADIUS)).toBeLessThanOrEqual(ATLAS_PAGE);
  });

  it('a call always paints at least one cell, even with no idle time left (the queue always drains)', () => {
    const { atlas, ctx, idle } = harness(100);
    atlas.draw(ctx, 'water', 6, { x: 0, y: 0 }, 0, { state: 'flying' });
    // Two steps allocate pages 0 and 1, then one cell per call.
    for (let i = 0; i < CELLS + 2; i++) idle(0);
    expect(atlas.stats()).toMatchObject({ blocks: 1, pending: 0, cells: CELLS });
  });

  it('once baked, a bullet is drawn from the atlas, and the scheduler goes quiet', () => {
    const { atlas, ctx, draws, pending, idle } = harness();
    atlas.draw(ctx, 'ice', 6, { x: 10, y: 20 }, 0, { state: 'flying' });
    while (idle()) {
      // One idle period after another until the block is ready.
    }
    expect(pending).toHaveLength(0);
    expect(atlas.draw(ctx, 'ice', 6, { x: 10, y: 20 }, 0, { state: 'hanging', hang: 0.5 })).toBe(true);
    // The flight frame, then its ring.
    expect(draws).toHaveLength(2);
    expect(atlas.stats()).toMatchObject({ blocks: 1, pending: 0 });
  });

  it('the baked cells are the painted ones, so the atlas keeps the core = hitbox of bullet-art.ts', () => {
    const { atlas, puts } = harness();
    atlas.warm('dragon', 7);
    atlas.flush();
    // Page 0 first touched (a 1 px put) as the block waits on it, the whole block in one put, then the spare page 1.
    expect(puts.map((p) => p.image.width)).toEqual([1, 8 * cellSize(7), 1]);
    const { image } = puts[1]!;
    const size = cellSize(7);
    const check = (cell: { rgba: Uint8ClampedArray }, index: number): void => {
      const o = cellOrigin({ x: 0, y: 0 }, size, index);
      for (let row = 0; row < size; row++) {
        const start = ((o.y + row) * image.width + o.x) * 4;
        expect([...image.data.subarray(start, start + size * 4)], `cell ${index} row ${row}`).toEqual([...cell.rgba.subarray(row * size * 4, (row + 1) * size * 4)]);
      }
    };
    for (let f = 0; f < BULLET_DIRS * BULLET_ANIMS; f++) check(paintBullet('dragon', 7, f), f);
    for (let s = 0; s < HANG_STEPS; s++) check(paintHangRing('dragon', 7, s), BULLET_DIRS * BULLET_ANIMS + s);
  });
});
