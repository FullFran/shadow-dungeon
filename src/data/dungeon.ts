import type { RoomId } from './rooms';
import type { SpeciesId } from './species';

/**
 * Floor generator tuning (docs/gdd.md §3 "Plantas normales"). Sizes are in
 * tiles; the map is split into a grid of cells and each cell holds one room
 * or a corridor junction, Mystery Dungeon style. Values are provisional.
 */
export const DUNGEON = {
  tileSize: 32,
  /** Map size in tiles (the outer ring is always wall). */
  cols: 40,
  rows: 28,
  /** Cell grid laid over the map; every cell holds a room or a junction. */
  cellCols: 3,
  cellRows: 2,
  rooms: { min: 4, max: 6 },
  /** Room size in tiles, inclusive bounds. */
  roomWidth: { min: 5, max: 9 },
  roomHeight: { min: 4, max: 8 },
  /** Corridor width in tiles: 2 leaves room to roll. */
  corridorWidth: 2,
  /** Extra corridors on top of the spanning tree, inclusive bounds. */
  extraLoops: { min: 1, max: 2 },
  spawns: {
    /** Enemies per room on floor 1, plus `perDepth` per deeper floor, plus up to `jitter` more. */
    base: 1,
    perDepth: 1,
    jitter: 1,
    maxPerRoom: 5,
    /** No spawn closer than this to the start (world px). */
    safeRadius: 192,
    /** Species weights for regular enemies. */
    species: [
      { species: 'poochyena', weight: 3 },
      { species: 'gastly', weight: 2 },
    ] as readonly { species: SpeciesId; weight: number }[],
  },
  /** Sleeping enemies wake when the player enters their room or comes this close with line of sight (world px). */
  wakeRadius: 160,
} as const;

/** One floor of a run: generated (seeded) or a fixed room such as the boss arena. */
export type FloorPlan = { kind: 'generated' } | { kind: 'room'; room: RoomId };

/** The MVP run (docs/gdd.md §3): three generated floors, then the Aegislash arena. */
export const RUN_PLAN: readonly FloorPlan[] = [{ kind: 'generated' }, { kind: 'generated' }, { kind: 'generated' }, { kind: 'room', room: 'boss' }];

export const RUN = {
  /** Fraction of max HP healed on entering each floor after the first. */
  floorHeal: 0.25,
} as const;

/** A generated floor is normal or urgent (docs/gdd.md §3 "Plantas con prisa"); the MVP has the collapse only. */
export type FloorKind = 'normal' | 'collapse';

/**
 * Urgent floor weights by depth. Index 0 is floor 1 (never urgent); deeper
 * floors than the table use its last entry. Provisional.
 */
export const URGENT = {
  collapseChance: [0, 0.25, 0.4] as readonly number[],
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
