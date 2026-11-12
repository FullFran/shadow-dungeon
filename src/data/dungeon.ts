import type { Difficulty } from './difficulty';
import type { EncounterBudget } from './encounters';
import type { RoomId } from './rooms';
import type { SpeciesId } from './species';

/**
 * The shape of a generated floor (docs/gdd.md §3 "Plantas normales"). Sizes
 * are in tiles; the map is split into a grid of cells and each cell holds
 * one room or a corridor junction, Mystery Dungeon style.
 */
export interface FloorShape {
  /** Map size in tiles (the outer ring is always wall). */
  cols: number;
  rows: number;
  /** Cell grid laid over the map; every cell holds a room or a junction. */
  cellCols: number;
  cellRows: number;
  rooms: { min: number; max: number };
  /** Room size in tiles, inclusive bounds (capped by the cell). */
  roomWidth: { min: number; max: number };
  roomHeight: { min: number; max: number };
  /** Extra corridors on top of the spanning tree, inclusive bounds. */
  extraLoops: { min: number; max: number };
  /**
   * How much longer this shape's floors are to walk than Easy's (median
   * start-to-stairs walk over Easy's; tests/core/map-size.test.ts measures
   * it): the clocks that do not already follow the walking distance (the
   * fog's closing, the flood's rise, the Sima's descent bonus) stretch by it.
   */
  walkScale: number;
}

/**
 * Floors grow with the tier (owner request 2026-11-12, docs/research/map-size.md):
 * Easy keeps the original 40x28 floor, Normal is a little roomier, Hard and
 * Nightmare add a cell column and row (Nightmare is close to a Mystery
 * Dungeon floor, 56x32). Every tier keeps 4 to 6 rooms: the extra cells are
 * corridor junctions, so a floor is longer to walk but holds no more enemies
 * nor experience (more rooms raised the Nightmare boss margins; pending the
 * band's retune). The tier is the host's, so every co-op peer generates the
 * same floor from the same seed.
 */
export const FLOOR_SHAPES: Readonly<Record<Difficulty, FloorShape>> = {
  easy: { cols: 40, rows: 28, cellCols: 3, cellRows: 2, rooms: { min: 4, max: 6 }, roomWidth: { min: 5, max: 9 }, roomHeight: { min: 4, max: 8 }, extraLoops: { min: 1, max: 2 }, walkScale: 1 },
  normal: { cols: 44, rows: 30, cellCols: 3, cellRows: 2, rooms: { min: 4, max: 6 }, roomWidth: { min: 5, max: 10 }, roomHeight: { min: 4, max: 9 }, extraLoops: { min: 1, max: 2 }, walkScale: 1.15 },
  hard: { cols: 52, rows: 38, cellCols: 4, cellRows: 3, rooms: { min: 4, max: 6 }, roomWidth: { min: 5, max: 10 }, roomHeight: { min: 4, max: 9 }, extraLoops: { min: 2, max: 3 }, walkScale: 1.4 },
  nightmare: { cols: 58, rows: 40, cellCols: 4, cellRows: 3, rooms: { min: 4, max: 6 }, roomWidth: { min: 5, max: 11 }, roomHeight: { min: 4, max: 9 }, extraLoops: { min: 2, max: 3 }, walkScale: 1.55 },
};

/**
 * The wave room (salas de oleadas, core/sima-events.ts): a floor that will
 * hold one gets a hall at least this big (interior tiles, walls excluded),
 * never the start or the stairs room. Before 2026-11-12 any room could be
 * the wave room, down to 5x4 (players complained it was cramped).
 */
export const WAVE_ROOM = { minWidth: 11, minHeight: 9, maxWidth: 14, maxHeight: 10 } as const;

/** Floor generator constants shared by every shape. Values are provisional. */
export const DUNGEON = {
  tileSize: 32,
  /** Corridor width in tiles: 2 leaves room to roll. */
  corridorWidth: 2,
  spawns: {
    /** No spawn closer than this to the start (world px). */
    safeRadius: 192,
  },
  /** Sleeping enemies wake when the player enters their room or comes this close with line of sight (world px). */
  wakeRadius: 160,
} as const;

/**
 * One floor of a run: generated (seeded) or a fixed room. A fixed room is the
 * guardian's arena unless it says `midboss` (a fight that leads on through
 * the room's exit) or `echo` (the endless dungeon's scaled guardian echo,
 * whose way on opens at the top of the arena once it falls).
 */
export type FloorPlan = { kind: 'generated' } | { kind: 'room'; room: RoomId; role?: 'midboss' | 'echo' };

/** One species of a dungeon's enemy pool: its weight by floor (index 0 is floor 1, deeper floors use the last entry). */
export interface SpawnEntry {
  species: SpeciesId;
  weights: readonly number[];
  /** Swarmers: one pick places up to this many in the room (default 1). */
  pack?: number;
  /** A mixed pack: after the pick (and its pack), up to `count` of another species on the next tiles. */
  escort?: { species: SpeciesId; count: number };
  /** Only runs at this tier or harder draw it (core/difficulty.ts `tieredSpawns`): Hard and Nightmare meet a species or two more. */
  minDifficulty?: Difficulty;
  /** A rare spawn: a low weight (at most 0.25) and an arrival cue when the floor holds one (core/dungeon.ts `rareOnFloor`). */
  rare?: true;
}

/** Enemies of a dungeon's generated floors. */
export interface SpawnTuning {
  /** Enemies per room on floor 1, plus `perDepth` (rounded down) per deeper floor, plus up to `jitter` more. */
  base: number;
  perDepth: number;
  jitter: number;
  maxPerRoom: number;
  pool: readonly SpawnEntry[];
  /**
   * Encounters with a meaning (data/encounters.ts): when set, each room
   * spends this threat budget on roles instead of drawing `base`..`jitter`
   * enemies (the count fields then only feed the legacy `spawnsPerRoom`).
   */
  budget?: EncounterBudget;
}

/**
 * The Crypt's enemies (docs/gdd.md §3, Cripta), by floor 1..5 (floor 3 is
 * Sableye's vault; its entry keeps the tables aligned). Floor 1 is the M2
 * floor 1 exactly (Poochyena 3, Gastly 2, one or two per room; the new
 * species weigh 0 there and come after, so the same seed draws the same
 * enemies). Duskull and the Pawniard pairs join on floor 2, Golett on 4.
 * The second wave (odd/tasks/enemy-variety-crypt.md, data/crypt-enemies.ts):
 * Honedge from floor 1 (taking some of Poochyena's weight), Bronzor and the
 * disguised Yamask from 2, Murkrow from 4 on Normal and up, and Klefki, a
 * rare spawn, from 4 on Hard and Nightmare only.
 */
export const CRYPT_SPAWNS: SpawnTuning = {
  base: 1,
  perDepth: 0.5,
  jitter: 1,
  maxPerRoom: 4,
  budget: { base: 2, perDepth: 1, jitter: 1, maxEnemies: 3, rest: [0.15, 0.25, 0.25, 0.2, 0.2], repeatWeight: 0.4, leaders: { fromFloor: 2, start: 0.3, perFloor: 0.1, max: 0.6 } },
  pool: [
    { species: 'poochyena', weights: [2, 2, 2, 2, 2] },
    { species: 'honedge', weights: [1, 1, 1, 1, 2] },
    { species: 'gastly', weights: [2, 2, 2, 2, 2] },
    { species: 'duskull', weights: [0, 1, 1, 2, 2] },
    { species: 'pawniard', weights: [0, 1, 1, 2, 2], pack: 2 },
    { species: 'golett', weights: [0, 0, 0, 1, 2] },
    { species: 'bronzor', weights: [0, 1, 1, 1, 1] },
    { species: 'yamask', weights: [0, 1, 1, 1, 2] },
    { species: 'murkrow', weights: [0, 0, 0, 1, 1], minDifficulty: 'normal' },
    { species: 'klefki', weights: [0, 0, 0, 0.2, 0.2], rare: true, minDifficulty: 'hard' },
    // Evolved forms on the floors after the vault (data/evolutions.ts): Mightyena with a Poochyena at its
    // side, Bisharp with a Pawniard, Gengar (floor 5) with a Gastly; each the room's leader when it has one.
    { species: 'mightyena', weights: [0, 0, 0, 1, 2], escort: { species: 'poochyena', count: 1 } },
    { species: 'haunter', weights: [0, 0, 0, 1, 1] },
    { species: 'dusclops', weights: [0, 0, 0, 1, 1] },
    { species: 'bisharp', weights: [0, 0, 0, 1, 2], escort: { species: 'pawniard', count: 1 } },
    { species: 'gengar', weights: [0, 0, 0, 0, 1], escort: { species: 'gastly', count: 1 } },
  ],
};

/**
 * The Crypt run (docs/gdd.md §3, provisional): two generated floors, Sableye's
 * vault (a mid-boss with an exit), two more generated floors, then the
 * Aegislash arena.
 */
export const RUN_PLAN: readonly FloorPlan[] = [
  { kind: 'generated' },
  { kind: 'generated' },
  { kind: 'room', room: 'vault', role: 'midboss' },
  { kind: 'generated' },
  { kind: 'generated' },
  { kind: 'room', room: 'boss' },
];

export const RUN = {
  /** Fraction of max HP healed on entering each floor after the first. */
  floorHeal: 0.25,
} as const;

/** A generated floor is normal or urgent (docs/gdd.md §3 "Plantas con prisa"): the collapse, the forest's fog (Niebla), the caves' flood (Inundación) or the swamp's gas (Gas tóxico). */
export type FloorKind = 'normal' | 'collapse' | 'fog' | 'flood' | 'gas';

/**
 * Urgent floor weights by depth. Index 0 is floor 1 (never urgent); deeper
 * floors than the table use its last entry. Provisional.
 */
export const URGENT = {
  /** The Crypt's collapse by floor 1..5 (floor 3 is the vault, never urgent). */
  collapseChance: [0, 0.25, 0, 0.35, 0.45] as readonly number[],
} as const;

/**
 * The collapse (docs/gdd.md §3): the ceiling falls from the start along the
 * walking distance field towards the stairs. Provisional values.
 */
export const COLLAPSE = {
  /** Time after entering before the front starts moving. */
  graceMs: 5000,
  /** Front speed along the walking distance field. */
  frontTilesPerSecond: 1.5,
  /**
   * The front must reach the stairs no sooner than this many times the
   * straight walking time to them (after the grace delay); asserted by tests.
   */
  safetyFactor: 1.8,
  /** Standing on collapsed ground hurts once per interval (roll i-frames skip a tick). */
  damageIntervalMs: 500,
  /** Damage per tick as a fraction of max HP. */
  damageFraction: 0.06,
  /** Collapsed ground pushes the player towards the nearest standing ground (px/s). */
  pushSpeed: 110,
  /** The push aims this many tiles past the front, so it does not drop the player right where the next tiles fall. */
  pushMarginTiles: 1.5,
  /** The rumble (sound and screen shake) is felt within this many tiles of the front. */
  rumbleTiles: 6,
} as const;

/** Niebla (core/fog.ts): the vision closes in until you find the stairs. Provisional values. */
export const FOG = {
  /** Vision radius on arrival and once fully closed, in tiles. */
  startTiles: 7,
  minTiles: 2.5,
  graceMs: 3000,
  /** Time from the end of the grace to the minimum radius. */
  closeMs: 50000,
  /** Once closed: a chill of this fraction of max HP every interval (never below 1 HP). */
  chillFraction: 0.03,
  chillIntervalMs: 1500,
  /** Soft edge of the fog, in tiles (drawn as a gradient). */
  edgeTiles: 1.5,
} as const;

/**
 * Inundación (core/flood.ts), the Flooded Caves' urgent floor: the water
 * rises over the whole floor and slows every player who is not a Water type
 * more and more; once it has fully risen the cold water bites a little at a
 * time (never below 1 HP). Provisional values.
 */
export const FLOOD = {
  graceMs: 4000,
  /** Time from the end of the grace to the full level. */
  riseMs: 45000,
  /** Walking speed lost at the full level (a share of the normal speed) by a non-Water player. */
  maxSlow: 0.45,
  /** Once risen: a chill of this fraction of max HP every interval (never below 1 HP; Water types are spared). */
  chillFraction: 0.02,
  chillIntervalMs: 2000,
} as const;

/** Shallow water pools of the Flooded Caves' floors (core/water.ts). Provisional values. */
export interface WaterTuning {
  /** Chance that a room other than the start one holds a pool. */
  poolChance: number;
}

export const WATER = {
  /** Walking speed of a non-Water walker in shallow water (player or enemy). */
  shallowFactor: 0.7,
  /** The combined slow (pool and flood) never goes below this. */
  minFactor: 0.4,
} as const;
