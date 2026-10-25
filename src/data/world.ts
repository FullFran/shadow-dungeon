import { TOWN, type GroundSheet, type NpcSpecies, type TownNpc, type TownProp } from './town';

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
export type WorldMapId = 'refugio' | 'ruinas' | 'mirador' | 'crater' | 'lago';

/**
 * The endless dungeon under the crater (being added by another branch). Its
 * entrance stays sealed until a dungeon with this id is in the registry
 * (src/data/dungeons.ts).
 */
export const SIMA_DUNGEON_ID = 'sima-del-eclipse';

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

/**
 * A dungeon's mouth: stepping on these tiles asks "¿Entrar en …?" (or says
 * it is sealed); leaving the window puts the walker back on `back`.
 */
export interface DungeonEntrance extends TileRect {
  /** A dungeon id; it may not exist yet (checked against the registry at runtime). */
  dungeon: string;
  /** Name shown while the dungeon is not in the registry. */
  nameKey: string;
  back: { x: number; y: number };
}

/** A line of a lore point, shown once the dungeon `after` has been cleared on this device (always when absent). */
export interface LoreLine {
  key: string;
  after?: string;
}

/** Something to read in the world (a statue, a sign, an idol): its reading point in tiles and its lines. */
export interface LorePoint {
  id: string;
  nameKey: string;
  x: number;
  y: number;
  lines: readonly LoreLine[];
}

/** A harmless Pokémon that ambles around its home tile (no collision with the player, no combat). */
export interface Wanderer {
  id: string;
  species: NpcSpecies;
  x: number;
  y: number;
  /** How far from home (tiles) it picks its destinations. */
  radius: number;
}

/** Look of a map: ground sheet, eclipse light and ambience. */
export interface MapLook {
  ground: GroundSheet;
  /** Multiply tint at the top and the bottom of the view (the eclipse light). */
  tint: readonly [string, string];
  /** Size of the eclipse in the sky band (1 = the town's). */
  eclipse: number;
  /** Fog banks drifting over the map (0 none .. 1 thick). */
  fog?: number;
  /** Leaves falling from the trees. */
  leaves?: boolean;
  /** Birds gliding across the sky band. */
  birds?: number;
}

export interface WorldMap {
  id: WorldMapId;
  /** i18n key of the name shown on arrival. */
  nameKey: string;
  rows: readonly string[];
  props: readonly TownProp[];
  npcs: readonly TownNpc[];
  links: readonly MapLink[];
  entrances: readonly DungeonEntrance[];
  lore: readonly LorePoint[];
  wanderers: readonly Wanderer[];
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
const TOWN_LOOK: MapLook = { ground: 'light', tint: ['#ffc4b4', '#c47f86'], eclipse: 1, birds: 2 };

const CRYPT = 'crypt-of-the-sword-king';
const FOREST = 'misty-forest';

export const REFUGIO: WorldMap = {
  id: 'refugio',
  nameKey: 'world.map.refugio',
  rows: TOWN.rows,
  // The waystone by the east road (a signpost): quick travel, so a stream never has to walk.
  props: [...TOWN.props, { kind: 'notice-board', x: 28, y: 8 }],
  npcs: TOWN.npcs,
  links: [{ id: 'east', ...TOWN.exit, to: 'ruinas', toLink: 'west' }],
  entrances: [],
  lore: [],
  wanderers: [],
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
    [',', 0, 10, 40, 2],
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
    { kind: 'statue', x: 8, y: 13 },
    { kind: 'notice-board', x: 3, y: 8 },
    { kind: 'big-bush', x: 13, y: 14 },
    { kind: 'stump', x: 24, y: 14 },
    { kind: 'bush', x: 27, y: 16 },
  ],
  npcs: [],
  links: [
    { id: 'west', x: 0, y: 10, width: 1, height: 2, to: 'refugio', toLink: 'east' },
    { id: 'east', x: 39, y: 10, width: 1, height: 2, to: 'mirador', toLink: 'west' },
  ],
  entrances: [{ dungeon: CRYPT, nameKey: 'world.map.ruinas', x: 19, y: 7, width: 2, height: 1, back: { x: 19, y: 9 } }],
  lore: [
    { id: 'knight', nameKey: 'world.lore.knight.name', x: 9, y: 15.5, lines: [{ key: 'world.lore.knight.1' }, { key: 'world.lore.knight.2', after: CRYPT }, { key: 'world.lore.knight.3', after: FOREST }] },
    { id: 'road-sign', nameKey: 'world.lore.sign.name', x: 4, y: 8.5, lines: [{ key: 'world.lore.sign.1' }, { key: 'world.lore.sign.2', after: CRYPT }] },
  ],
  wanderers: [{ id: 'ruins-pumpkaboo', species: 'pumpkabooSmall', x: 27, y: 13, radius: 3 }],
  look: { ground: 'dark', tint: ['#f2b2b0', '#9c6a80'], eclipse: 1.3, fog: 0.5, leaves: true, birds: 1 },
};

/**
 * Paso del Mirador: a chasm splits the pass, one bridge crosses it. The
 * watchtower and a statue look at the eclipse, bigger here than anywhere;
 * north climbs to the crater, the southern treeline hides the Misty Forest.
 */
export const MIRADOR: WorldMap = {
  id: 'mirador',
  nameKey: 'world.map.mirador',
  rows: paintRows(44, 24, '.', [
    ['F', 0, 0, 44, 2],
    ['F', 0, 22, 44, 2],
    ['F', 0, 0, 2, 24],
    ['F', 42, 0, 2, 24],
    ['F', 2, 19, 18, 3],
    ['F', 24, 20, 18, 2],
    ['#', 14, 2, 6, 2],
    ['C', 20, 0, 4, 24],
    [',', 0, 11, 44, 2],
    ['=', 20, 11, 4, 2],
    [',', 32, 0, 2, 11],
    [',', 8, 13, 2, 6],
  ]),
  props: [
    { kind: 'statue', x: 16, y: 5 },
    { kind: 'tower', x: 37, y: 3 },
    { kind: 'trunk', x: 10, y: 16 },
    { kind: 'tree-big', x: 3, y: 15 },
    { kind: 'big-bush', x: 5, y: 5 },
    { kind: 'tree-small', x: 28, y: 3 },
    { kind: 'tree-small', x: 3, y: 2 },
    { kind: 'stump', x: 12, y: 8 },
    { kind: 'pillar-broken', x: 26, y: 6 },
    { kind: 'rubble', x: 35, y: 15 },
    { kind: 'bush', x: 27, y: 16 },
    { kind: 'tree-small', x: 30, y: 17 },
    { kind: 'flat-rocks', x: 12, y: 14 },
  ],
  npcs: [],
  links: [
    { id: 'west', x: 0, y: 11, width: 1, height: 2, to: 'ruinas', toLink: 'east' },
    { id: 'east', x: 43, y: 11, width: 1, height: 2, to: 'lago', toLink: 'west' },
    { id: 'north', x: 32, y: 0, width: 2, height: 1, to: 'crater', toLink: 'south' },
  ],
  entrances: [{ dungeon: FOREST, nameKey: 'world.map.mirador', x: 8, y: 18, width: 2, height: 1, back: { x: 8, y: 16 } }],
  lore: [{ id: 'lookout', nameKey: 'world.lore.view.name', x: 17, y: 7.5, lines: [{ key: 'world.lore.view.1' }, { key: 'world.lore.view.2', after: CRYPT }, { key: 'world.lore.view.3', after: FOREST }] }],
  wanderers: [
    { id: 'pass-hoothoot', species: 'hoothoot', x: 29, y: 8, radius: 4 },
    { id: 'pass-foongus', species: 'foongus', x: 14, y: 16, radius: 2 },
  ],
  look: { ground: 'dark', tint: ['#ffb4a4', '#8e5a74'], eclipse: 2.4, fog: 0.35, leaves: true, birds: 3 },
};

/** Cráter del Eclipse: ash and rock around a pit right under the eclipse; the Sima opens at its rim. */
export const CRATER: WorldMap = {
  id: 'crater',
  nameKey: 'world.map.crater',
  rows: paintRows(32, 26, '.', [
    ['#', 0, 0, 32, 2],
    ['#', 0, 24, 32, 2],
    ['#', 0, 0, 2, 26],
    ['#', 30, 0, 2, 26],
    ['#', 4, 8, 3, 3],
    ['#', 25, 6, 2, 2],
    ['#', 24, 18, 3, 2],
    ['#', 5, 19, 2, 2],
    ['#', 2, 2, 28, 2],
    ['C', 11, 8, 10, 6],
    ['C', 13, 7, 6, 1],
    ['C', 12, 14, 8, 1],
    ['C', 10, 9, 1, 4],
    ['C', 21, 9, 1, 4],
    [',', 15, 15, 2, 11],
  ]),
  props: [
    { kind: 'statue', x: 23, y: 11 },
    { kind: 'pillar-broken', x: 8, y: 13 },
    { kind: 'pillar', x: 21, y: 16 },
    { kind: 'rubble', x: 9, y: 21 },
    { kind: 'flat-rocks', x: 18, y: 20 },
  ],
  npcs: [],
  links: [{ id: 'south', x: 15, y: 25, width: 2, height: 1, to: 'mirador', toLink: 'north' }],
  entrances: [{ dungeon: SIMA_DUNGEON_ID, nameKey: 'world.sima.name', x: 15, y: 15, width: 2, height: 1, back: { x: 15, y: 17 } }],
  lore: [{ id: 'burnt-statue', nameKey: 'world.lore.crater.name', x: 24, y: 13.5, lines: [{ key: 'world.lore.crater.1' }, { key: 'world.lore.crater.2', after: CRYPT }, { key: 'world.lore.crater.3', after: FOREST }] }],
  wanderers: [],
  look: { ground: 'ash', tint: ['#ffa898', '#7a3e52'], eclipse: 3.4, fog: 0.6 },
};

/**
 * Aldea del Lago Negro: the second settlement, fishers' houses by a lake
 * that no longer reflects the sky; a pier runs into the black water.
 */
export const LAGO: WorldMap = {
  id: 'lago',
  nameKey: 'world.map.lago',
  rows: paintRows(36, 22, '.', [
    ['F', 0, 0, 36, 2],
    ['F', 0, 20, 36, 2],
    ['F', 0, 0, 2, 22],
    ['F', 34, 0, 2, 22],
    ['~', 22, 2, 12, 11],
    ['~', 26, 13, 8, 5],
    [',', 0, 11, 22, 2],
    [',', 10, 7, 8, 9],
    [',', 21, 13, 4, 1],
    ['=', 23, 5, 2, 8],
  ]),
  props: [
    { kind: 'house-big', x: 3, y: 2 },
    { kind: 'house-moss', x: 12, y: 2 },
    { kind: 'house-wood', x: 4, y: 14 },
    { kind: 'house-wood', x: 13, y: 16 },
    { kind: 'fence', x: 18, y: 3 },
    { kind: 'frog-idol', x: 19, y: 15 },
    { kind: 'big-bush', x: 8, y: 17 },
    { kind: 'stump', x: 28, y: 19 },
    { kind: 'bush', x: 25, y: 18 },
    { kind: 'tree-small', x: 30, y: 18 },
    { kind: 'stall', x: 6, y: 8 },
    { kind: 'flat-rocks', x: 12, y: 12 },
    { kind: 'pillar-broken', x: 10, y: 6 },
    { kind: 'rubble', x: 15, y: 15 },
  ],
  npcs: [
    { id: 'fisher', role: 'fisher', species: 'cubone', x: 24, y: 5, lines: ['world.npc.fisher.1', 'world.npc.fisher.2'] },
    { id: 'keeper', role: 'keeper', species: 'litwick', x: 16, y: 9, lines: ['world.npc.keeper.1', 'world.npc.keeper.2', 'world.npc.keeper.3', 'world.npc.keeper.4'], rotate: true },
    { id: 'oracle', role: 'oracle', species: 'phantump', x: 7, y: 11, lines: ['world.npc.oracle.1', 'town.soon', 'world.npc.oracle.2'] },
  ],
  links: [{ id: 'west', x: 0, y: 11, width: 1, height: 2, to: 'mirador', toLink: 'east' }],
  entrances: [],
  lore: [{ id: 'idol', nameKey: 'world.lore.idol.name', x: 20, y: 16.5, lines: [{ key: 'world.lore.idol.1' }, { key: 'world.lore.idol.2', after: CRYPT }, { key: 'world.lore.idol.3', after: FOREST }] }],
  wanderers: [{ id: 'lake-spinarak', species: 'spinarak', x: 27, y: 19, radius: 2 }],
  look: { ground: 'dark', tint: ['#e8b0b8', '#6a5a80'], eclipse: 1.1, fog: 0.8, birds: 1 },
};

export const WORLD: Readonly<Record<WorldMapId, WorldMap>> = { refugio: REFUGIO, ruinas: RUINAS, mirador: MIRADOR, crater: CRATER, lago: LAGO };

export const HUB: WorldMapId = 'refugio';
