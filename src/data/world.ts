import { TOWN, type GroundSheet, type TownNpc, type TownProp } from './town';

/**
 * The overworld (docs/gdd.md §11): small hand-authored maps joined at their
 * edges. Each map uses the town's row format (src/data/town.ts) plus these
 * ground characters: `~` water and `C` chasm (not walkable, drawn by code),
 * `=` bridge or pier (walkable), `#` rock (not walkable). The hub is the
 * town itself, "Refugio del Ocaso"; its route exit leads into the world.
 *
 * Links pair up both ways: leaving through link `A` of map `M` towards
 * `to`/`toLink` arrives one tile inside link `toLink` of map `to`, whose own
 * `to`/`toLink` point back at `M`/`A` (tests/town/world.test.ts).
 */
export type WorldMapId = 'refugio' | 'ruinas';

export interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A stretch of the map edge that leads to another map. */
export interface MapLink extends TileRect {
  id: string;
  to: WorldMapId;
  toLink: string;
}

/** Look of a map: ground sheet, eclipse light and ambience. */
export interface MapLook {
  ground: GroundSheet;
  /** Multiply tint at the top and the bottom of the view (the eclipse light). */
  tint: readonly [string, string];
  /** Size of the eclipse in the sky band (1 = the town's). */
  eclipse: number;
}

export interface WorldMap {
  id: WorldMapId;
  /** i18n key of the name shown on arrival. */
  nameKey: string;
  rows: readonly string[];
  props: readonly TownProp[];
  npcs: readonly TownNpc[];
  links: readonly MapLink[];
  look: MapLook;
  /** Where a new visit starts (the hub only). */
  spawn?: { x: number; y: number };
  /** The notice board's reading point, in tiles (the hub only). */
  board?: { x: number; y: number };
  /** The waystone's reading point, in tiles: quick travel to any open dungeon (the hub only). */
  waystone?: { x: number; y: number };
}

/** Rows of `fill`, then each stroke `[char, x, y, width, height]` painted over them in order. */
export function paintRows(cols: number, rows: number, fill: string, strokes: readonly (readonly [string, number, number, number, number])[]): string[] {
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));
  for (const [ch, x, y, width, height] of strokes) {
    for (let ty = y; ty < y + height; ty++) for (let tx = x; tx < x + width; tx++) if (grid[ty]?.[tx] !== undefined) grid[ty]![tx] = ch;
  }
  return grid.map((row) => row.join(''));
}

/** The town's own light: the multiply it has always used. */
const TOWN_LOOK: MapLook = { ground: 'light', tint: ['#ffc4b4', '#c47f86'], eclipse: 1 };

export const REFUGIO: WorldMap = {
  id: 'refugio',
  nameKey: 'world.map.refugio',
  rows: TOWN.rows,
  // The waystone by the east road (a signpost): quick travel, so a stream never has to walk.
  props: [...TOWN.props, { kind: 'notice-board', x: 28, y: 8 }],
  npcs: TOWN.npcs,
  links: [{ id: 'east', ...TOWN.exit, to: 'ruinas', toLink: 'west' }],
  look: TOWN_LOOK,
  spawn: TOWN.spawn,
  board: TOWN.board,
  waystone: { x: 29, y: 8.5 },
};

/** Camino de las Ruinas: graves and broken pillars around the Crypt's gate, north of the road. */
export const RUINAS: WorldMap = {
  id: 'ruinas',
  nameKey: 'world.map.ruinas',
  rows: paintRows(40, 20, '.', [
    ['F', 0, 0, 40, 2],
    ['F', 0, 18, 40, 2],
    ['F', 0, 0, 2, 20],
    ['F', 38, 0, 2, 20],
    ['F', 30, 15, 8, 3],
    ['F', 2, 2, 4, 3],
    [',', 0, 10, 38, 2],
    [',', 19, 7, 2, 3],
  ]),
  props: [
    { kind: 'crypt-gate', x: 18, y: 4 },
    { kind: 'grave', x: 12, y: 3 },
    { kind: 'grave', x: 25, y: 4 },
    { kind: 'pillar', x: 16, y: 5 },
    { kind: 'pillar-broken', x: 23, y: 5 },
    { kind: 'wall-ruin', x: 8, y: 6 },
    { kind: 'rubble', x: 29, y: 8 },
    { kind: 'flat-rocks', x: 17, y: 8 },
    { kind: 'tree-big', x: 33, y: 2 },
    { kind: 'tree-small', x: 3, y: 13 },
    { kind: 'big-bush', x: 13, y: 14 },
    { kind: 'stump', x: 24, y: 14 },
    { kind: 'bush', x: 27, y: 16 },
  ],
  npcs: [],
  links: [
    { id: 'west', x: 0, y: 10, width: 1, height: 2, to: 'refugio', toLink: 'east' },
  ],
  look: { ground: 'dark', tint: ['#f2b2b0', '#9c6a80'], eclipse: 1.3 },
};

export const WORLD: Readonly<Record<WorldMapId, WorldMap>> = { refugio: REFUGIO, ruinas: RUINAS };

export const HUB: WorldMapId = 'refugio';
