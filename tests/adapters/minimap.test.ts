import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/core/dungeon';
import type { WorldState } from '../../src/core/state';
import { loadFloor } from '../../src/core/floor';
import { TILE, tileCenter } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { createMemory, isSeen, MINIMAP, minimapMarks, revealAround } from '../../src/adapters/minimap';

const floor = generateFloor(11, 2);
const world = () => loadFloor(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), floor);

describe('minimap fog of war', () => {
  it('starts dark and reveals the whole start room (with its walls) on entering', () => {
    const memory = createMemory(floor);
    expect(memory.seen.every((v) => v === 0)).toBe(true);
    revealAround(memory, floor, floor.rooms, floor.start);
    const room = floor.rooms[floor.startRoom]!;
    for (let y = room.y - 1; y <= room.y + room.height; y++) {
      for (let x = room.x - 1; x <= room.x + room.width; x++) expect(isSeen(memory, x, y)).toBe(true);
    }
    const other = floor.rooms.find((_, i) => i !== floor.startRoom)!;
    expect(isSeen(memory, other.x + 1, other.y + 1)).toBe(false);
  });

  it('reveals only a radius around the player in corridors', () => {
    const memory = createMemory(floor);
    // A floor tile outside every room: a corridor.
    const index = floor.tiles.findIndex((v, i) => {
      const x = i % floor.cols;
      const y = Math.floor(i / floor.cols);
      return v === 1 && !floor.rooms.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
    });
    const tile = { x: index % floor.cols, y: Math.floor(index / floor.cols) };
    revealAround(memory, floor, floor.rooms, tile);
    expect(isSeen(memory, tile.x, tile.y)).toBe(true);
    expect(isSeen(memory, tile.x + MINIMAP.revealRadius, tile.y)).toBe(tile.x + MINIMAP.revealRadius < floor.cols);
    expect(isSeen(memory, tile.x + MINIMAP.revealRadius + 1, tile.y)).toBe(false);
    expect(memory.seen.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual((2 * MINIMAP.revealRadius + 1) ** 2);
  });

  it('marks the player always, the stairs once seen and enemies only inside the view', () => {
    const memory = createMemory(floor);
    let state: WorldState = { ...world(), enemies: [] };
    state = spawnEnemy(state, 'poochyena', vec(state.player.pos.x + 40, state.player.pos.y));
    state = spawnEnemy(state, 'gastly', tileCenter(floor.stairs));
    const view = { x: state.player.pos.x - 256, y: state.player.pos.y - 160, width: 512, height: 320 };
    revealAround(memory, floor, floor.rooms, floor.start);
    const marks = minimapMarks(state, memory, view);
    expect(marks.player).toEqual({ x: state.player.pos.x / TILE, y: state.player.pos.y / TILE });
    expect(marks.stairs).toBeNull();
    expect(marks.enemies).toHaveLength(1);
    revealAround(memory, floor, floor.rooms, floor.stairs);
    expect(minimapMarks(state, memory, view).stairs).toEqual(floor.stairs);
  });
});
