import { describe, expect, it } from 'vitest';
import { POOCHYENA } from '../../src/data/enemies';
import { flowField, flowStep, updateFlow } from '../../src/core/flow';
import type { Arena, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { lineOfSight, TILE, tileCenter, tileOf, type TileGrid } from '../../src/core/tiles';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input, run } from './helpers';

/**
 * An L-shaped wall: a bar along row 3 (closed against the left border) and a
 * column at x 8 down to row 6. The pocket below the bar only opens at the
 * bottom right, so an enemy at (2, 6) cannot see a player at (2, 1) and the
 * straight line walks it into the bar.
 */
const MAP = [
  '############',
  '#..........#',
  '#..........#',
  '#########..#',
  '#.......#..#',
  '#.......#..#',
  '#.......#..#',
  '#..........#',
  '#..........#',
  '############',
];
const GRID: TileGrid = { cols: MAP[0]!.length, rows: MAP.length, tiles: MAP.join('').split('').map((c) => (c === '#' ? 0 : 1)) };
const ARENA: Arena = { width: GRID.cols * TILE, height: GRID.rows * TILE, tiles: GRID };
const at = (x: number, y: number): Vec2 => tileCenter({ x, y });

function behindWall(): WorldState {
  return spawnEnemy(createWorld({ seed: 3, arena: ARENA, playerPos: at(2, 1) }), 'poochyena', at(2, 6));
}

/** Ticks until the enemy is in lunge range with a clear line of sight (or -1). */
function ticksToReach(state: WorldState, maxTicks: number): number {
  let current = state;
  for (let i = 0; i < maxTicks; i++) {
    current = step(current, input(), FIXED_DT_MS);
    const enemy = current.enemies[0]!;
    if (distance(enemy.pos, current.player.pos) <= POOCHYENA.lungeRange && lineOfSight(GRID, enemy.pos, current.player.pos)) return i + 1;
  }
  return -1;
}

describe('flow field', () => {
  it('counts walking steps from the player tile around walls', () => {
    const field = flowField(GRID, { x: 2, y: 1 });
    expect(field.dist[1 * GRID.cols + 2]).toBe(0);
    // Around the L: down the right side and back along the bottom.
    expect(field.dist[6 * GRID.cols + 2]).toBeGreaterThan(15);
    expect(field.dist[0]).toBe(-1);
  });

  it('points downhill, never through a wall corner', () => {
    const field = flowField(GRID, { x: 2, y: 1 });
    const next = flowStep(GRID, field, { x: 2, y: 6 })!;
    expect(field.dist[next.y * GRID.cols + next.x]).toBeLessThan(field.dist[6 * GRID.cols + 2]!);
    // From just under the bar's end the way is to the right (x 9), not diagonally into the column.
    const corner = flowStep(GRID, field, { x: 7, y: 7 })!;
    expect(corner).toEqual({ x: 8, y: 7 });
  });

  it('is recomputed only when the player changes tile', () => {
    const state = updateFlow(behindWall());
    const field = state.flow!;
    const sameTile = updateFlow({ ...state, player: { ...state.player, pos: vec(at(2, 1).x + 5, at(2, 1).y) } });
    expect(sameTile.flow).toBe(field);
    const moved = updateFlow({ ...state, player: { ...state.player, pos: at(3, 1) } });
    expect(moved.flow).not.toBe(field);
    expect(moved.flow!.origin).toEqual({ x: 3, y: 1 });
    // Same tile on another floor: rebuilt for the new grid.
    const otherGrid = { ...GRID, tiles: [...GRID.tiles] };
    const otherFloor = updateFlow({ ...state, arena: { ...ARENA, tiles: otherGrid } });
    expect(otherFloor.flow!.grid).toBe(otherGrid);
  });

  it('is not built on arenas without tiles (boss room)', () => {
    const plain = createWorld({ seed: 1, arena: { width: 400, height: 300 }, playerPos: vec(100, 100) });
    expect(step(plain, input(), FIXED_DT_MS).flow).toBeUndefined();
  });
});

describe('enemy chase pathfinding', () => {
  it('brings a walker behind an L-wall to the player', () => {
    const ticks = ticksToReach(behindWall(), 900);
    expect(ticks).toBeGreaterThan(0);
    // About 21 tiles at walk speed, with slack for corners.
    expect(ticks).toBeLessThan(Math.ceil(((24 * TILE) / POOCHYENA.walkSpeed) * 1000 / FIXED_DT_MS));
  });

  it('is deterministic', () => {
    const a = run(behindWall(), input(), 400);
    const b = run(behindWall(), input(), 400);
    expect(a.enemies).toEqual(b.enemies);
    expect(tileOf(a.enemies[0]!.pos)).not.toEqual({ x: 2, y: 6 });
  });

  it('leaves Gastly floating straight through walls', () => {
    const state = spawnEnemy(createWorld({ seed: 3, arena: ARENA, playerPos: at(2, 1) }), 'gastly', at(2, 6));
    const later = run(state, input(), 60);
    // Straight up towards its distance band: x does not wander around the wall.
    expect(Math.abs(later.enemies[0]!.pos.x - at(2, 6).x)).toBeLessThan(TILE);
  });
});
