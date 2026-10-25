import { describe, expect, it } from 'vitest';
import { TOWN } from '../../src/data/town';
import { TILE, tileOf } from '../../src/core/tiles';
import { TUNING } from '../../src/data/tuning';
import { buildTownGrid } from '../../src/town/map';
import { inExit, stepWalker, townArena } from '../../src/town/interact';

const arena = townArena(buildTownGrid(TOWN));
const start = { x: (TOWN.spawn.x + 0.5) * TILE, y: (TOWN.spawn.y + 0.5) * TILE };

describe('walking in town', () => {
  it('moves at the player walking speed and faces the way it walks', () => {
    const next = stepWalker({ pos: start, facing: { x: 0, y: 1 } }, { x: 1, y: 0 }, 1000, arena);
    expect(next.pos.x - start.x).toBeCloseTo(TUNING.player.moveSpeed, 5);
    expect(next.facing).toEqual({ x: 1, y: 0 });
  });

  it('keeps the facing when standing still', () => {
    const next = stepWalker({ pos: start, facing: { x: -1, y: 0 } }, { x: 0, y: 0 }, 16, arena);
    expect(next).toEqual({ pos: start, facing: { x: -1, y: 0 } });
  });

  it('is stopped by the forest', () => {
    let walker = { pos: start, facing: { x: 0, y: 1 } };
    for (let i = 0; i < 400; i++) walker = stepWalker(walker, { x: 0, y: -1 }, 16, arena);
    // North of the plaza is the shop; walk the grass column x = 18 instead.
    walker = { pos: { x: 18.5 * TILE, y: 12.5 * TILE }, facing: { x: 0, y: 1 } };
    for (let i = 0; i < 400; i++) walker = stepWalker(walker, { x: 0, y: -1 }, 16, arena);
    expect(tileOf(walker.pos).y).toBe(2);
  });

  it('reaches the route exit walking east along the road', () => {
    let walker = { pos: { x: 20.5 * TILE, y: 10.5 * TILE }, facing: { x: 1, y: 0 } };
    expect(inExit(walker.pos, TOWN.exit)).toBe(false);
    for (let i = 0; i < 200 && !inExit(walker.pos, TOWN.exit); i++) walker = stepWalker(walker, { x: 1, y: 0 }, 16, arena);
    expect(inExit(walker.pos, TOWN.exit)).toBe(true);
  });
});
