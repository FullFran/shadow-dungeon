import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/core/dungeon';
import { floorArena } from '../../src/core/floor';
import { TILE } from '../../src/core/tiles';
import { distance, vec } from '../../src/core/vec';
import { toPlayerInput } from '../../src/adapters/input';
import { cameraView, followCamera, visibleTiles } from '../../src/adapters/view';

const arena = floorArena(generateFloor(7, 1));

describe('camera on a generated floor', () => {
  it('eases towards the player and settles on it', () => {
    let camera = vec(100, 100);
    const target = vec(300, 200);
    const first = followCamera(camera, target, 16);
    expect(distance(first, target)).toBeLessThan(distance(camera, target));
    expect(distance(first, target)).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) camera = followCamera(camera, target, 16);
    expect(distance(camera, target)).toBeLessThan(0.5);
  });

  it('does not depend on how the time is split into frames', () => {
    const target = vec(400, 0);
    let small = vec(0, 0);
    for (let i = 0; i < 4; i++) small = followCamera(small, target, 8);
    const big = followCamera(vec(0, 0), target, 32);
    expect(distance(small, big)).toBeLessThan(1e-6);
  });

  it('snaps when the target jumps far away (a new floor)', () => {
    expect(followCamera(vec(0, 0), vec(2000, 900), 16)).toEqual(vec(2000, 900));
  });

  it('stays inside the map', () => {
    const corner = cameraView(vec(0, 0), 512, 320, arena);
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    const far = cameraView(vec(arena.width, arena.height), 512, 320, arena);
    expect(far.x + far.width).toBe(arena.width);
    expect(far.y + far.height).toBe(arena.height);
  });

  it('maps the cursor to world points through the camera offset, and the lock view is the camera rect', () => {
    const view = cameraView(vec(600, 500), 512, 320, arena);
    expect(view.x).toBeGreaterThan(0);
    const raw = { keys: new Set<string>(), buttons: new Set<number>(), mouse: vec(100, 60), rollPressed: false, wheel: 0 };
    const mapped = toPlayerInput(raw, view, 2);
    expect(mapped.aim).toEqual(vec(view.x + 50, view.y + 30));
    expect(mapped.view).toEqual(view);
  });

  it('lists only the tiles inside the view, clamped to the map', () => {
    const range = visibleTiles({ x: 40, y: 70, width: 512, height: 320 }, arena.tiles!);
    expect(range).toEqual({ x0: 1, y0: 2, x1: Math.floor((40 + 512) / TILE), y1: Math.floor((70 + 320) / TILE) });
    const edge = visibleTiles({ x: -50, y: -50, width: 100000, height: 100000 }, arena.tiles!);
    expect(edge).toEqual({ x0: 0, y0: 0, x1: arena.tiles!.cols - 1, y1: arena.tiles!.rows - 1 });
  });
});
