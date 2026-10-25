import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/dungeon';
import { generateFloor, spawnsPerRoom, type Floor } from '../../src/core/dungeon';
import { isWall, TILE, tileCenter, type TilePoint } from '../../src/core/tiles';
import { distance } from '../../src/core/vec';

const SEEDS = Array.from({ length: 1000 }, (_, i) => i * 7919 + 13);
const DEPTHS = [1, 2, 3];

/** Walkable tiles reachable from the start tile (4-neighbour flood fill). */
function reachable(floor: Floor): Set<number> {
  const seen = new Set<number>();
  const queue: TilePoint[] = [floor.start];
  seen.add(floor.start.y * floor.cols + floor.start.x);
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = ny * floor.cols + nx;
      if (seen.has(key) || isWall(floor, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

const insideRoom = (p: TilePoint, r: Floor['rooms'][number]) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height;

describe('floor generator', () => {
  it('is deterministic: the same seed and depth give the same floor', () => {
    for (const seed of SEEDS.slice(0, 50)) {
      expect(generateFloor(seed, 2)).toEqual(generateFloor(seed, 2));
    }
    expect(generateFloor(1, 1).tiles).not.toEqual(generateFloor(2, 1).tiles);
  });

  it('keeps every room, the start and the stairs inside the map, with a solid border', () => {
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 1);
      expect(floor.cols).toBe(DUNGEON.cols);
      expect(floor.rows).toBe(DUNGEON.rows);
      expect(floor.tiles.length).toBe(floor.cols * floor.rows);
      expect(floor.rooms.length).toBeGreaterThanOrEqual(DUNGEON.rooms.min);
      expect(floor.rooms.length).toBeLessThanOrEqual(DUNGEON.rooms.max);
      for (let x = 0; x < floor.cols; x++) expect(isWall(floor, x, 0) && isWall(floor, x, floor.rows - 1)).toBe(true);
      for (let y = 0; y < floor.rows; y++) expect(isWall(floor, 0, y) && isWall(floor, floor.cols - 1, y)).toBe(true);
      for (const room of floor.rooms) {
        expect(room.x).toBeGreaterThan(0);
        expect(room.y).toBeGreaterThan(0);
        expect(room.x + room.width).toBeLessThan(floor.cols);
        expect(room.y + room.height).toBeLessThan(floor.rows);
      }
    }
  });

  it('is fully connected: from the start you reach the stairs and every room tile (1000 seeds, depths 1-3)', () => {
    for (const depth of DEPTHS) {
      for (const seed of SEEDS) {
        const floor = generateFloor(seed, depth);
        const seen = reachable(floor);
        expect(seen.has(floor.stairs.y * floor.cols + floor.stairs.x), `seed ${seed}`).toBe(true);
        let missing = 0;
        for (const room of floor.rooms) {
          for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) if (!seen.has(y * floor.cols + x)) missing++;
          }
        }
        expect(missing, `seed ${seed} depth ${depth}`).toBe(0);
      }
    }
  });

  it('puts the start and the stairs in different rooms', () => {
    for (const seed of SEEDS) {
      const floor = generateFloor(seed, 1);
      expect(floor.startRoom).not.toBe(floor.stairsRoom);
      expect(insideRoom(floor.start, floor.rooms[floor.startRoom]!)).toBe(true);
      expect(insideRoom(floor.stairs, floor.rooms[floor.stairsRoom]!)).toBe(true);
    }
  });

  it('places spawns on floor tiles of their room, never in the start room nor near the start', () => {
    for (const depth of DEPTHS) {
      for (const seed of SEEDS) {
        const floor = generateFloor(seed, depth);
        const start = tileCenter(floor.start);
        const used = new Set<string>();
        for (const spawn of floor.spawns) {
          expect(isWall(floor, spawn.tile.x, spawn.tile.y)).toBe(false);
          expect(spawn.room).not.toBe(floor.startRoom);
          expect(insideRoom(spawn.tile, floor.rooms[spawn.room]!)).toBe(true);
          expect(distance(tileCenter(spawn.tile), start)).toBeGreaterThan(DUNGEON.spawns.safeRadius);
          expect(['poochyena', 'gastly']).toContain(spawn.species);
          const key = `${spawn.tile.x},${spawn.tile.y}`;
          expect(used.has(key)).toBe(false);
          used.add(key);
        }
      }
    }
  });

  it('grows the enemy count with depth', () => {
    expect(spawnsPerRoom(1).max).toBeLessThan(spawnsPerRoom(3).max);
    const total = (depth: number) => SEEDS.slice(0, 200).reduce((sum, seed) => sum + generateFloor(seed, depth).spawns.length, 0);
    expect(total(3)).toBeGreaterThan(total(1));
    for (const seed of SEEDS.slice(0, 200)) {
      const floor = generateFloor(seed, 1);
      const perRoom = new Map<number, number>();
      for (const s of floor.spawns) perRoom.set(s.room, (perRoom.get(s.room) ?? 0) + 1);
      for (const count of perRoom.values()) expect(count).toBeLessThanOrEqual(spawnsPerRoom(1).max);
    }
  });

  it('mixes both species over many floors', () => {
    const species = new Set(SEEDS.slice(0, 100).flatMap((seed) => generateFloor(seed, 2).spawns.map((s) => s.species)));
    expect([...species].sort()).toEqual(['gastly', 'poochyena']);
  });

  it('uses the shared tile size', () => {
    expect(TILE).toBe(DUNGEON.tileSize);
    expect(tileCenter({ x: 2, y: 1 })).toEqual({ x: 2.5 * TILE, y: 1.5 * TILE });
  });
});
