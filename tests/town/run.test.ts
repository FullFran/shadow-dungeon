import { describe, expect, it } from 'vitest';
import { RUN_FACTOR, stepWalker, townArena } from '../../src/town/interact';
import { buildTownGrid } from '../../src/town/map';
import { WORLD } from '../../src/data/world';
import { TILE } from '../../src/core/tiles';

// Owner, 2026-11-02: "que en el pueblo haya opcion de correr".
describe('running in the town', () => {
  const arena = townArena(buildTownGrid(WORLD.refugio));
  const start = { pos: { x: WORLD.refugio.spawn!.x * TILE + TILE / 2, y: WORLD.refugio.spawn!.y * TILE + TILE / 2 }, facing: { x: 0, y: 1 } };

  it('covers more ground per step than walking, by the run factor', () => {
    const walked = stepWalker(start, { x: 1, y: 0 }, 100, arena);
    const ran = stepWalker(start, { x: 1, y: 0 }, 100, arena, RUN_FACTOR);
    const walk = walked.pos.x - start.pos.x;
    expect(walk).toBeGreaterThan(0);
    expect(ran.pos.x - start.pos.x).toBeCloseTo(walk * RUN_FACTOR, 5);
    expect(RUN_FACTOR).toBeGreaterThan(1.4);
  });

  it('walking stays as it was when no factor is given', () => {
    expect(stepWalker(start, { x: 0, y: 1 }, 100, arena)).toEqual(stepWalker(start, { x: 0, y: 1 }, 100, arena, 1));
  });
});
