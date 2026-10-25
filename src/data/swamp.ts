/**
 * The Toxic Swamp's floor hazards (docs/gdd.md §3, Pantano Tóxico).
 * Provisional values.
 */

/**
 * Toxic pools (core/toxic.ts): bubbling sludge set into the floor of the
 * swamp's rooms. Wading in poisons; the poison bites a little at a time and
 * never takes the last HP. A roll across a pool (its i-frames) does not
 * poison, so the pools reward rolling, not walking.
 */
export const TOXIC = {
  /** Chance that a room (not the start room) gets pools, and how many. */
  roomChance: 0.75,
  perRoom: { min: 1, max: 2 },
  /** Pool radius in tiles, inclusive bounds. */
  radiusTiles: { min: 0.9, max: 1.6 },
  /** No pool centre this close (tiles) to the start or the stairs. */
  clearTiles: 2.5,
  /** The player's centre must be this far inside the edge to wade in (px), so brushing the rim is safe. */
  edgeMarginPx: 4,
  poison: {
    /** Poison lasts this long after the last contact. */
    durationMs: 3200,
    tickMs: 700,
    /** Damage per tick as a fraction of max HP (never below 1 HP). */
    tickFraction: 0.02,
  },
} as const;

/**
 * Gas tóxico, the swamp's urgent floor (core/gas.ts): after a short grace a
 * cloud of gas spreads from the entrance along the walking distances, slower
 * than the collapse, so it always reaches the stairs last. Breathing it
 * drains HP slowly (a roll does not help: it is in the air) and never takes
 * the last HP; it presses, it does not kill.
 */
export const GAS = {
  graceMs: 4000,
  frontTilesPerSecond: 1.0,
  /** The front reaches the stairs no sooner than this many times the straight walk to them (tests). */
  safetyFactor: 3,
  drainIntervalMs: 800,
  drainFraction: 0.03,
  /** The gas thickens over this many tiles behind its front (drawn as a gradient). */
  edgeTiles: 2,
} as const;
