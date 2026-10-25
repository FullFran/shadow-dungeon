import { CRYPT_SPAWNS, DUNGEON, type SpawnEntry, type SpawnTuning } from '../data/dungeon';
import { ROLE_LINE, roleOf, ROLES_PER_ROOM, threatOf, type EncounterBudget, type EnemyRole } from '../data/encounters';
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
  /** Its group's leader (core/leaders.ts `assignLeaders`). */
  leader?: true;
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

/** Enemy count bounds per room at a depth (the dungeon's spawn tuning; the Crypt's by default). */
export function spawnsPerRoom(depth: number, tuning: SpawnTuning = CRYPT_SPAWNS): { min: number; max: number } {
  const { base, perDepth, jitter, maxPerRoom } = tuning;
  const min = Math.min(maxPerRoom, base + Math.floor(perDepth * Math.max(0, depth - 1)));
  return { min, max: Math.min(maxPerRoom, min + jitter) };
}

/** Weight of a pool entry at a depth (index 0 is floor 1, deeper floors use the last entry). */
export const weightAt = (entry: SpawnEntry, depth: number): number => entry.weights[Math.min(Math.max(1, depth), entry.weights.length) - 1] ?? 0;

function pickSpawn(rng: Random, pool: readonly SpawnEntry[], depth: number): SpawnEntry {
  const total = pool.reduce((sum, entry) => sum + weightAt(entry, depth), 0);
  let roll = rng.next() * total;
  for (const entry of pool) {
    roll -= weightAt(entry, depth);
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1]!;
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

/** One generated floor; `spawns` is the dungeon's enemy table (the Crypt's by default). */
export function generateFloor(seed: number, depth: number, spawnTuning: SpawnTuning = CRYPT_SPAWNS): Floor {
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
  const bounds = spawnsPerRoom(depth, spawnTuning);
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
    if (spawnTuning.budget) {
      spawns.push(...budgetedRoom(rng, spawnTuning.pool, spawnTuning.budget, depth, rng.shuffle(candidates), dist, cols, index));
      return;
    }
    const count = rng.int(bounds.min, bounds.max);
    const tiles = rng.shuffle(candidates).slice(0, count);
    // A pack (swarmers) fills the next free tiles with the same species; single picks draw once each, as before.
    for (let i = 0; i < tiles.length; ) {
      const entry = pickSpawn(rng, spawnTuning.pool, depth);
      const size = Math.max(1, entry.pack ?? 1);
      for (const tile of tiles.slice(i, i + size)) spawns.push({ species: entry.species, tile, room: index });
      i += size;
      // A mixed pack (the forest's trickster and its pumpkins): the escorts take the next tiles, no extra draw.
      if (entry.escort) {
        for (const tile of tiles.slice(i, i + entry.escort.count)) spawns.push({ species: entry.escort.species, tile, room: index });
        i += entry.escort.count;
      }
    }
  });

  return { seed, depth, cols, rows, tiles, rooms, startRoom, stairsRoom, start, stairs, spawns };
}

/** Threat budget of one room at a depth, before its jitter (data/encounters.ts). */
export const roomBudget = (budget: EncounterBudget, depth: number): number => budget.base + budget.perDepth * Math.max(0, depth - 1);

/** Threat cost of a pool entry as one buy: its pack (up to `room` units) and its escort. */
function entryBuy(entry: SpawnEntry, room: number): { units: SpeciesId[]; cost: number } {
  const pack = Math.min(Math.max(1, entry.pack ?? 1), room);
  const units: SpeciesId[] = Array<SpeciesId>(pack).fill(entry.species);
  if (entry.escort) units.push(...Array<SpeciesId>(Math.max(0, Math.min(entry.escort.count, room - pack))).fill(entry.escort.species));
  return { units, cost: units.reduce((sum, s) => sum + threatOf(s), 0) };
}

/**
 * One room of a budgeted floor (docs/gdd.md §3 "Encuentros con sentido"):
 * maybe a breather (empty), otherwise it buys roles from the pool until
 * nothing affordable fits, never more than `maxEnemies` bodies nor more than
 * `maxRoles` roles, a role already bought weighing less (variety makes the
 * combo). The front line (brutes, skirmishers, swarms) takes the tiles
 * nearest the way in, the back line (gunners, controllers) the farthest.
 */
function budgetedRoom(rng: Random, pool: readonly SpawnEntry[], budget: EncounterBudget, depth: number, shuffled: readonly TilePoint[], dist: readonly number[], cols: number, room: number): FloorSpawn[] {
  if (rng.next() < (budget.rest[Math.min(Math.max(1, depth), budget.rest.length) - 1] ?? 0)) return [];
  const maxRoles = budget.maxRoles ?? ROLES_PER_ROOM.easy;
  let left = roomBudget(budget, depth) + rng.int(0, budget.jitter);
  const bought: SpeciesId[] = [];
  const roles = new Set<EnemyRole>();
  for (let tries = 0; tries < budget.maxEnemies; tries++) {
    const room = Math.min(budget.maxEnemies, shuffled.length) - bought.length;
    if (room <= 0) break;
    const open = pool
      .map((entry) => ({ entry, buy: entryBuy(entry, room) }))
      .filter(({ entry, buy }) => {
        if (weightAt(entry, depth) <= 0 || buy.cost > left) return false;
        const fresh = new Set([...roles, ...buy.units.map(roleOf)]);
        return fresh.size <= maxRoles;
      });
    if (open.length === 0) break;
    const weightOf = ({ entry, buy }: (typeof open)[number]) => weightAt(entry, depth) * (buy.units.every((s) => roles.has(roleOf(s))) ? budget.repeatWeight : 1);
    let roll = rng.next() * open.reduce((sum, o) => sum + weightOf(o), 0);
    let pick = open[open.length - 1]!;
    for (const o of open) {
      roll -= weightOf(o);
      if (roll < 0) {
        pick = o;
        break;
      }
    }
    bought.push(...pick.buy.units);
    pick.buy.units.forEach((s) => roles.add(roleOf(s)));
    left -= pick.buy.cost;
  }
  // Front and back lines: the near half of the room (walking distance from the start) for the front, the far 40 % for the back, in the shuffled order.
  const ordered = [...shuffled].sort((a, b) => dist[a.y * cols + a.x]! - dist[b.y * cols + b.x]!);
  const rank = new Map(ordered.map((t, i) => [t, i]));
  const n = ordered.length;
  const fits = (t: TilePoint, line: 'front' | 'back') => (line === 'front' ? rank.get(t)! < Math.ceil(n / 2) : rank.get(t)! >= Math.floor(n * 0.6));
  const used = new Set<TilePoint>();
  return bought.map((species) => {
    const line = ROLE_LINE[roleOf(species)];
    const tile = shuffled.find((t) => !used.has(t) && fits(t, line)) ?? shuffled.find((t) => !used.has(t))!;
    used.add(tile);
    return { species, tile, room };
  });
}

/** A tile rectangle in world pixels. */
export const roomRect = (room: TileRect) => ({ x: room.x * TILE, y: room.y * TILE, width: room.width * TILE, height: room.height * TILE });
