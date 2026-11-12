import type { TileRect } from '../core/dungeon';
import { isWall, TILE, type TileGrid, type TilePoint } from '../core/tiles';
import type { ToxicPool } from '../core/toxic';
import type { DungeonDecor } from '../data/dungeons';
import { decorHash } from './crypt-decor';

/**
 * The dungeon art pass (odd/tasks/dungeon-art-pass.md, docs/gdd.md "Arte de
 * las mazmorras"): which art set a floor wears, where its props stand and
 * which variant each floor tile shows. Presentation only and pure: placement
 * reads nothing but the floor's grid, rooms, water and toxic pools, which
 * every co-op peer shares, so every peer sees the same floor; nothing here
 * collides, and the simulation never imports it.
 *
 * Props stand on the ring of room tiles along the walls (where the generator
 * never puts a spawn; the start and the stairs are room centres), never at a
 * doorway or next to one, never in a corridor (the chokepoints), never near
 * the stairs, never in water or a toxic pool. The rest of the floor is
 * dressed by its tile variants (speckles, pebbles, tufts baked into the tile).
 */

/** One art set per look: the four dungeon decors and the Sima's abyss. */
export type ArtTheme = 'crypt' | 'forest' | 'caves' | 'swamp' | 'abyss';

export const ART_THEMES: readonly ArtTheme[] = ['crypt', 'forest', 'caves', 'swamp', 'abyss'];

export type PropKind =
  // Crypt: old bones, fallen masonry, a cracked urn, cobwebs in the corners.
  | 'bones'
  | 'rubble'
  | 'urn'
  | 'web'
  // Forest: grass tufts, ferns, small flowers, a mossy stone, a fallen log.
  | 'tuft'
  | 'fern'
  | 'flowers'
  | 'mossStone'
  | 'log'
  // Caves: pebbles, small crystals, stalagmite stubs, glowing moss.
  | 'pebbles'
  | 'shard'
  | 'stalagmite'
  | 'glowMoss'
  // Swamp: mud puddles, bleached bones, toadstools, rotten stumps.
  | 'puddle'
  | 'skull'
  | 'toadstool'
  | 'stump'
  // Abyss: rock splinters, eclipse-red crystals, ash drifts.
  | 'splinters'
  | 'redShard'
  | 'ash';

export interface PropWeight {
  kind: PropKind;
  weight: number;
  /** Only in a room corner (two walls touch the tile). */
  corner?: true;
}

export interface ThemeSet {
  props: readonly PropWeight[];
  /** Share of eligible ring tiles that hold a prop. */
  chance: number;
}

export const THEME_SETS: Readonly<Record<ArtTheme, ThemeSet>> = {
  crypt: {
    chance: 0.42,
    props: [
      { kind: 'bones', weight: 2 },
      { kind: 'rubble', weight: 3 },
      { kind: 'urn', weight: 1.5 },
      { kind: 'web', weight: 3, corner: true },
    ],
  },
  forest: {
    chance: 0.55,
    props: [
      { kind: 'tuft', weight: 4 },
      { kind: 'fern', weight: 3 },
      { kind: 'flowers', weight: 2 },
      { kind: 'mossStone', weight: 1.5 },
      { kind: 'log', weight: 0.8 },
    ],
  },
  caves: {
    chance: 0.45,
    props: [
      { kind: 'pebbles', weight: 3 },
      { kind: 'shard', weight: 2 },
      { kind: 'stalagmite', weight: 2 },
      { kind: 'glowMoss', weight: 1.5 },
    ],
  },
  swamp: {
    chance: 0.45,
    props: [
      { kind: 'puddle', weight: 2.5 },
      { kind: 'skull', weight: 1 },
      { kind: 'toadstool', weight: 2.5 },
      { kind: 'stump', weight: 1.2 },
      { kind: 'tuft', weight: 2 },
    ],
  },
  abyss: {
    chance: 0.4,
    props: [
      { kind: 'splinters', weight: 3 },
      { kind: 'redShard', weight: 2 },
      { kind: 'ash', weight: 2.5 },
    ],
  },
};

/** The art set a floor wears: the abyss band's own, else its dungeon's decor (the Crypt's when it has none). */
export function artThemeOf(decor: DungeonDecor | null | undefined, abyss: boolean): ArtTheme {
  if (abyss) return 'abyss';
  return decor ?? 'crypt';
}

export interface FloorProp extends TilePoint {
  kind: PropKind;
  /** 0..1: the prop's own small differences (flip, size, offset). */
  look: number;
}

/** What placement reads: the floor every peer shares. */
export type ArtFloor = TileGrid & {
  rooms?: readonly TileRect[];
  /** Flooded Caves: 1 = shallow water (core/water.ts). */
  water?: readonly number[];
  /** Toxic Swamp: its pools (core/toxic.ts), in world px. */
  pools?: readonly ToxicPool[];
};

/** A number that tells floors apart (same layout, same number): mixes every tile. */
export function floorSignature(grid: TileGrid): number {
  let h = 2166136261 ^ grid.cols ^ (grid.rows << 8);
  for (let i = 0; i < grid.tiles.length; i++) {
    h ^= grid.tiles[i]! + i;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100003;
}

/** Number of floor tile variants (drawn by floor-layer.ts `drawFloorTile`). */
export const FLOOR_VARIANTS = 6;
/** Variant weights: plain, speckled, patch, crack, pebbles, theme accent. */
const VARIANT_WEIGHTS = [30, 24, 14, 8, 12, 12];
const VARIANT_TOTAL = VARIANT_WEIGHTS.reduce((a, b) => a + b, 0);

/** The variant a floor tile shows (0..FLOOR_VARIANTS-1), stable for a floor. */
export function floorVariant(x: number, y: number, signature: number): number {
  let r = decorHash(x, y, 101 + signature) * VARIANT_TOTAL;
  for (let v = 0; v < VARIANT_WEIGHTS.length; v++) {
    r -= VARIANT_WEIGHTS[v]!;
    if (r < 0) return v;
  }
  return 0;
}

function pick(set: readonly PropWeight[], roll: number): PropKind {
  const total = set.reduce((sum, p) => sum + p.weight, 0);
  let r = roll * total;
  for (const p of set) {
    r -= p.weight;
    if (r < 0) return p.kind;
  }
  return set[set.length - 1]!.kind;
}

const inRoom = (r: TileRect, x: number, y: number) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;

/** Where the floor's props stand (see the module note for the rules). */
export function floorProps(floor: ArtFloor, theme: ArtTheme): FloorProp[] {
  const set = THEME_SETS[theme];
  const sig = floorSignature(floor);
  const rooms = floor.rooms ?? [];
  const out: FloorProp[] = [];
  const centres = rooms.map((r) => ({ x: r.x + Math.floor(r.width / 2), y: r.y + Math.floor(r.height / 2) }));
  const wet = (x: number, y: number) => floor.water?.[y * floor.cols + x] === 1;
  const pooled = (x: number, y: number) => (floor.pools ?? []).some((p) => Math.hypot((x + 0.5) * TILE - p.x, (y + 0.5) * TILE - p.y) <= p.radius + TILE * 0.6);
  for (const room of rooms) {
    // Doorways: an edge tile with walkable ground just outside the room.
    const doors: TilePoint[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const outside = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ].filter(([nx, ny]) => !inRoom(room, nx!, ny!));
        if (outside.some(([nx, ny]) => !isWall(floor, nx!, ny!))) doors.push({ x, y });
      }
    }
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        const ring = x === room.x || y === room.y || x === room.x + room.width - 1 || y === room.y + room.height - 1;
        if (!ring || isWall(floor, x, y) || wet(x, y) || pooled(x, y)) continue;
        if (doors.some((d) => Math.abs(d.x - x) <= 1 && Math.abs(d.y - y) <= 1)) continue;
        if (centres.some((c) => Math.abs(c.x - x) <= 1 && Math.abs(c.y - y) <= 1)) continue;
        if (decorHash(x, y, 211 + sig) >= set.chance) continue;
        const walls = [isWall(floor, x - 1, y), isWall(floor, x + 1, y), isWall(floor, x, y - 1), isWall(floor, x, y + 1)].filter(Boolean).length;
        const choices = set.props.filter((p) => !p.corner || walls >= 2);
        out.push({ x, y, kind: pick(choices, decorHash(x, y, 223 + sig)), look: decorHash(x, y, 227 + sig) });
      }
    }
  }
  return out;
}
