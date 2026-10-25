import { DUNGEON } from '../data/dungeon';
import type { SpeciesId } from '../data/species';
import { deriveSeed, nextRandom } from './rng';
import { isWall, TILE, tileCenter, type TileGrid, type TilePoint } from './tiles';
import { distance } from './vec';

/**
 * Seeded floor generator, Mystery Dungeon style (docs/gdd.md §3): the map is
 * split into a grid of cells, each cell holds a rectangular room or a
 * corridor junction, and L-shaped corridors join neighbouring cells along a
 * random spanning tree plus a few extra loops. Pure: (seed, depth) -> floor.
 */

/** Rectangle in tiles. */
export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorSpawn {
  species: SpeciesId;
  tile: TilePoint;
  /** Index into `rooms`. */
  room: number;
}

export interface Floor extends TileGrid {
  seed: number;
  depth: number;
  rooms: readonly TileRect[];
  startRoom: number;
  stairsRoom: number;
  start: TilePoint;
  stairs: TilePoint;
  spawns: readonly FloorSpawn[];
}

/** Local seeded draw helpers; the closure keeps the generator a pure function of its inputs. */
function random(seed: number) {
  let state = seed;
  const next = () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
  /** Integer in [min, max], inclusive. */
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };
  return { next, int, shuffle };
}

type Random = ReturnType<typeof random>;

/** Enemy count bounds per room at a depth (tuning in `DUNGEON.spawns`). */
export function spawnsPerRoom(depth: number): { min: number; max: number } {
  const { base, perDepth, jitter, maxPerRoom } = DUNGEON.spawns;
  const min = Math.min(maxPerRoom, base + perDepth * Math.max(0, depth - 1));
  return { min, max: Math.min(maxPerRoom, min + jitter) };
}

function pickSpecies(rng: Random): SpeciesId {
  const table = DUNGEON.spawns.species;
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng.next() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll < 0) return entry.species;
  }
  return table[table.length - 1]!.species;
}

const centerOf = (room: TileRect): TilePoint => ({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });

/** Breadth-first walking distance (in tiles) from `from` to every floor tile; -1 where unreachable. */
export function tileDistances(grid: TileGrid, from: TilePoint): number[] {
  const dist = new Array<number>(grid.cols * grid.rows).fill(-1);
  const queue: TilePoint[] = [from];
  dist[from.y * grid.cols + from.x] = 0;
  for (let head = 0; head < queue.length; head++) {
    const { x, y } = queue[head]!;
    const d = dist[y * grid.cols + x]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(grid, nx, ny) || dist[ny * grid.cols + nx] !== -1) continue;
      dist[ny * grid.cols + nx] = d + 1;
      queue.push({ x: nx, y: ny });
    }
  }
  return dist;
}

export function generateFloor(seed: number, depth: number): Floor {
  const { cols, rows, cellCols, cellRows, corridorWidth: cw } = DUNGEON;
  const rng = random(deriveSeed(seed, depth));
  const tiles = new Array<number>(cols * rows).fill(0);
  const carve = (x: number, y: number) => {
    // Never carve the outer ring: the map border stays solid.
    if (x > 0 && y > 0 && x < cols - 1 && y < rows - 1) tiles[y * cols + x] = 1;
  };
  const brush = (x: number, y: number) => {
    for (let dy = 0; dy < cw; dy++) for (let dx = 0; dx < cw; dx++) carve(x + dx, y + dy);
  };

  // Cells: interior split evenly, one-tile margin inside each cell keeps rooms apart.
  const cellW = Math.floor((cols - 2) / cellCols);
  const cellH = Math.floor((rows - 2) / cellRows);
  const cellCount = cellCols * cellRows;
  const roomCount = rng.int(DUNGEON.rooms.min, Math.min(DUNGEON.rooms.max, cellCount));
  const roomCells = new Set(rng.shuffle([...Array(cellCount).keys()]).slice(0, roomCount));

  const rooms: TileRect[] = [];
  /** Per cell: the tile corridors start from, and its room index (or -1 for a junction). */
  const anchors: { point: TilePoint; room: number }[] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    const x0 = 1 + (cell % cellCols) * cellW;
    const y0 = 1 + Math.floor(cell / cellCols) * cellH;
    if (roomCells.has(cell)) {
      const width = rng.int(DUNGEON.roomWidth.min, Math.min(DUNGEON.roomWidth.max, cellW - 2));
      const height = rng.int(DUNGEON.roomHeight.min, Math.min(DUNGEON.roomHeight.max, cellH - 2));
      const room = { x: x0 + 1 + rng.int(0, cellW - 2 - width), y: y0 + 1 + rng.int(0, cellH - 2 - height), width, height };
      for (let y = room.y; y < room.y + height; y++) for (let x = room.x; x < room.x + width; x++) carve(x, y);
      const point = { x: rng.int(room.x, room.x + width - cw), y: rng.int(room.y, room.y + height - cw) };
      anchors.push({ point, room: rooms.length });
      rooms.push(room);
    } else {
      const point = { x: rng.int(x0 + 1, x0 + cellW - 1 - cw), y: rng.int(y0 + 1, y0 + cellH - 1 - cw) };
      brush(point.x, point.y);
      anchors.push({ point, room: -1 });
    }
  }

  // Neighbouring cells, then a random spanning tree (Prim) plus a few extra edges for loops.
  const edges: [number, number][] = [];
  for (let cell = 0; cell < cellCount; cell++) {
    if (cell % cellCols < cellCols - 1) edges.push([cell, cell + 1]);
    if (cell + cellCols < cellCount) edges.push([cell, cell + cellCols]);
  }
  const inTree = new Set<number>([rng.int(0, cellCount - 1)]);
  const used: [number, number][] = [];
  let spare = [...edges];
  while (inTree.size < cellCount) {
    const frontier = spare.filter(([a, b]) => inTree.has(a) !== inTree.has(b));
    const edge = frontier[rng.int(0, frontier.length - 1)]!;
    used.push(edge);
    inTree.add(edge[0]).add(edge[1]);
    spare = spare.filter((e) => e !== edge);
  }
  const loops = rng.int(DUNGEON.extraLoops.min, DUNGEON.extraLoops.max);
  used.push(...rng.shuffle(spare).slice(0, loops));

  for (const [a, b] of used) {
    const from = anchors[a]!.point;
    const to = anchors[b]!.point;
    const corner = rng.next() < 0.5 ? { x: to.x, y: from.y } : { x: from.x, y: to.y };
    for (const [p, q] of [[from, corner], [corner, to]] as const) {
      const steps = Math.max(Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      for (let i = 0; i <= steps; i++) brush(p.x + Math.sign(q.x - p.x) * i, p.y + Math.sign(q.y - p.y) * i);
    }
  }

  const grid: TileGrid = { cols, rows, tiles };
  const startRoom = rng.int(0, rooms.length - 1);
  const start = centerOf(rooms[startRoom]!);
  // Stairs in the room whose centre is the longest walk from the start.
  const dist = tileDistances(grid, start);
  let stairsRoom = startRoom === 0 ? 1 : 0;
  rooms.forEach((room, index) => {
    if (index === startRoom) return;
    const c = centerOf(room);
    const best = centerOf(rooms[stairsRoom]!);
    if (dist[c.y * cols + c.x]! > dist[best.y * cols + best.x]!) stairsRoom = index;
  });
  const stairs = centerOf(rooms[stairsRoom]!);

  const spawns: FloorSpawn[] = [];
  const startPos = tileCenter(start);
  const bounds = spawnsPerRoom(depth);
  rooms.forEach((room, index) => {
    if (index === startRoom) return;
    // Inner tiles only, so bodies do not start against a wall; never on the stairs or near the start.
    const candidates: TilePoint[] = [];
    for (let y = room.y + 1; y < room.y + room.height - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.width - 1; x++) {
        const tile = { x, y };
        if ((x === stairs.x && y === stairs.y) || distance(tileCenter(tile), startPos) <= DUNGEON.spawns.safeRadius) continue;
        candidates.push(tile);
      }
    }
    const count = rng.int(bounds.min, bounds.max);
    for (const tile of rng.shuffle(candidates).slice(0, count)) spawns.push({ species: pickSpecies(rng), tile, room: index });
  });

  return { seed, depth, cols, rows, tiles, rooms, startRoom, stairsRoom, start, stairs, spawns };
}

/** A tile rectangle in world pixels. */
export const roomRect = (room: TileRect) => ({ x: room.x * TILE, y: room.y * TILE, width: room.width * TILE, height: room.height * TILE });
