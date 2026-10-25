import { SPRITE_KEYS } from './sprites';

/**
 * The hub town, hand-authored (docs/gdd.md §11 meta). One character per
 * 32 px tile: `S` sky (not walkable, unused by the town today), `F` forest (not
 * walkable, drawn as trees), `.` grass, `,` dirt path. Props sit on top with
 * their top-left tile; their solid rows are at the bottom (the canopy or roof
 * above can be walked behind). Tiles come from Ninja Adventure (CC0, 16 px
 * drawn at 2x, see public/tiles/town/LICENSE.txt).
 */
export type TownPropKind =
  | 'stall'
  | 'house-shop'
  | 'house-stone'
  | 'house-wood'
  | 'notice-board'
  | 'tree-big'
  | 'tree-small'
  | 'bush'
  | 'stump'
  // Overworld props (src/data/world.ts).
  | 'crypt-gate'
  | 'grave'
  | 'statue'
  | 'pillar'
  | 'pillar-broken'
  | 'tower'
  | 'house-big'
  | 'house-moss'
  | 'trunk'
  | 'fence'
  | 'wall-ruin'
  | 'frog-idol'
  | 'flat-rocks'
  | 'big-bush'
  | 'rubble';

export interface TownPropSpec {
  /** Image in public/tiles/town/. */
  file: string;
  /** Size in tiles (source pixels / 16). */
  width: number;
  height: number;
  /** Solid rows counted from the bottom of the prop. */
  solidRows: number;
  /** Flat on the ground (no solid rows): drawn under every character and prop. */
  decal?: true;
}

export const TOWN_PROPS: Record<TownPropKind, TownPropSpec> = {
  stall: { file: 'stall.png', width: 3, height: 3, solidRows: 2 },
  'house-shop': { file: 'house-shop.png', width: 3, height: 3, solidRows: 2 },
  'house-stone': { file: 'house-stone.png', width: 4, height: 3, solidRows: 2 },
  'house-wood': { file: 'house-wood.png', width: 3, height: 3, solidRows: 2 },
  'notice-board': { file: 'notice-board.png', width: 2, height: 1, solidRows: 1 },
  'tree-big': { file: 'tree-big.png', width: 4, height: 3, solidRows: 1 },
  'tree-small': { file: 'tree-small.png', width: 2, height: 2, solidRows: 1 },
  bush: { file: 'bush.png', width: 1, height: 1, solidRows: 1 },
  stump: { file: 'stump.png', width: 1, height: 1, solidRows: 1 },
  // The ruined stone house again: its dark doorway is the Crypt's mouth.
  'crypt-gate': { file: 'house-stone.png', width: 4, height: 3, solidRows: 2 },
  grave: { file: 'grave.png', width: 3, height: 3, solidRows: 2 },
  statue: { file: 'statue.png', width: 2, height: 3, solidRows: 1 },
  pillar: { file: 'pillar.png', width: 1, height: 3, solidRows: 1 },
  'pillar-broken': { file: 'pillar-broken.png', width: 1, height: 3, solidRows: 1 },
  tower: { file: 'tower.png', width: 3, height: 5, solidRows: 2 },
  'house-big': { file: 'house-big.png', width: 4, height: 5, solidRows: 2 },
  'house-moss': { file: 'house-moss.png', width: 4, height: 5, solidRows: 2 },
  trunk: { file: 'trunk.png', width: 2, height: 3, solidRows: 1 },
  fence: { file: 'fence.png', width: 3, height: 2, solidRows: 1 },
  'wall-ruin': { file: 'wall-ruin.png', width: 3, height: 2, solidRows: 1 },
  'frog-idol': { file: 'frog-idol.png', width: 2, height: 2, solidRows: 1 },
  'flat-rocks': { file: 'flat-rocks.png', width: 3, height: 2, solidRows: 0, decal: true },
  'big-bush': { file: 'big-bush.png', width: 2, height: 2, solidRows: 1 },
  rubble: { file: 'rubble.png', width: 2, height: 1, solidRows: 1 },
};

/**
 * Ground sheets with the layout of ground.png (path patch at 0,0, grass at
 * 0,80, tufts as listed in TOWN_GROUND): the town's light grass, dark grass
 * and ash.
 */
export const GROUND_SHEETS = { light: 'ground.png', dark: 'ground-dark.png', ash: 'ground-ash.png' } as const;
export type GroundSheet = keyof typeof GROUND_SHEETS;

/** Grass-with-tufts cells per sheet: the dark and ash crops have path and an empty cell where the light one has tufts at y 64. */
export const GROUND_TUFTS: Record<GroundSheet, readonly { x: number; y: number }[]> = {
  light: [
    { x: 32, y: 64 },
    { x: 48, y: 64 },
    { x: 16, y: 80 },
    { x: 32, y: 80 },
    { x: 48, y: 80 },
    { x: 64, y: 80 },
  ],
  dark: [
    { x: 16, y: 80 },
    { x: 32, y: 80 },
    { x: 48, y: 80 },
    { x: 64, y: 80 },
  ],
  ash: [
    { x: 16, y: 80 },
    { x: 32, y: 80 },
    { x: 48, y: 80 },
    { x: 64, y: 80 },
  ],
};

/** Ground sheet (ground.png) cells in source pixels: a 3x3 path patch at 0,0 and grass below. */
export const TOWN_GROUND = {
  file: 'ground.png',
  /** Top-left of the 3x3 path patch (edges and corners towards grass). */
  path: { x: 0, y: 0 },
  grass: { x: 0, y: 80 },
  /** Grass with small tufts, mixed in by a per-tile hash. */
  grassTufts: [
    { x: 32, y: 64 },
    { x: 48, y: 64 },
    { x: 16, y: 80 },
    { x: 32, y: 80 },
    { x: 48, y: 80 },
    { x: 64, y: 80 },
  ],
} as const;

export interface TownProp {
  kind: TownPropKind;
  x: number;
  y: number;
}

export type TownNpcRole = 'gacha' | 'shop' | 'storyteller' | 'fisher' | 'keeper' | 'oracle';

/** Species an NPC or a wandering Pokémon can use: any existing sprite (public/sprites). */
export type NpcSpecies = keyof typeof SPRITE_KEYS;

export interface TownNpc {
  id: string;
  role: TownNpcRole;
  /** Placeholder species from the existing sprite sheets (public/sprites); no new sprites. */
  species: NpcSpecies;
  /** Standing tile; it is solid. */
  x: number;
  y: number;
  /** i18n keys of the dialog lines, in order (all of them per talk, or one per talk in turn when `rotate`). */
  lines: readonly string[];
  /** One line per talk, in turn, instead of all of them. */
  rotate?: boolean;
  /** A window opens when the dialog ends (Poochyena's upgrade shop). */
  opens?: 'shop';
}

export interface TownMap {
  rows: readonly string[];
  props: readonly TownProp[];
  npcs: readonly TownNpc[];
  /** The notice board's reading spot: the point (in tiles) the player must stand near. */
  board: { x: number; y: number };
  spawn: { x: number; y: number };
  /** Route out to the dungeons: stepping on these tiles opens the destination window. */
  exit: { x: number; y: number; width: number; height: number };
}

const FOREST = 'F'.repeat(32);
const GRASS = `FF${'.'.repeat(28)}FF`;

export const TOWN: TownMap = {
  rows: [
    FOREST, FOREST,
    GRASS, GRASS, GRASS, GRASS,
    'FF....,,......,,......,,......FF',
    'FF....,,......,,......,,......FF',
    'FF....,,......,,......,,......FF',
    'FF....,,......,,......,,......FF',
    'FF....,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'FF....,,,,,,,,,,,,,,,,,,,,,,,,,,',
    'FF..........,,,,,,,,..........FF',
    'FF..........,,,,,,,,..........FF',
    GRASS, GRASS, GRASS, GRASS, GRASS, GRASS,
    FOREST, FOREST,
  ],
  props: [
    { kind: 'stall', x: 5, y: 3 },
    { kind: 'house-shop', x: 13, y: 3 },
    { kind: 'notice-board', x: 10, y: 7 },
    { kind: 'tree-big', x: 21, y: 2 },
    { kind: 'stump', x: 26, y: 6 },
    { kind: 'stump', x: 25, y: 7 },
    { kind: 'tree-small', x: 27, y: 3 },
    { kind: 'tree-small', x: 2, y: 3 },
    { kind: 'house-stone', x: 3, y: 13 },
    { kind: 'house-wood', x: 8, y: 14 },
    { kind: 'house-wood', x: 24, y: 13 },
    { kind: 'tree-big', x: 18, y: 15 },
    { kind: 'tree-small', x: 13, y: 16 },
    { kind: 'tree-small', x: 27, y: 16 },
    { kind: 'bush', x: 12, y: 18 },
    { kind: 'bush', x: 23, y: 18 },
    { kind: 'bush', x: 28, y: 7 },
    { kind: 'bush', x: 3, y: 9 },
  ],
  npcs: [
    { id: 'gacha', role: 'gacha', species: 'mimikyu', x: 8, y: 6, lines: ['town.gacha.1', 'town.soon'] },
    { id: 'shop', role: 'shop', species: 'poochyena', x: 16, y: 6, lines: ['town.shop.1', 'town.shop.open'], opens: 'shop' },
    { id: 'storyteller', role: 'storyteller', species: 'gastly', x: 24, y: 6, lines: ['town.story.1', 'town.story.2', 'town.story.3', 'town.story.4'], rotate: true },
  ],
  board: { x: 11, y: 7.5 },
  spawn: { x: 15, y: 9 },
  exit: { x: 31, y: 10, width: 1, height: 2 },
};
