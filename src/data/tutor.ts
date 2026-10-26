import { BASE_MOVE_IDS, type MoveDef, type MoveId } from './moves';
import type { DungeonId } from './dungeons';
import type { StarterId } from './learnsets';

/**
 * The move tutor (Smeargle, "Maestro de movimientos", in the Refugio;
 * odd/tasks/movepools.md T3). Each starter starts with its original kit
 * (free, known) and can buy the rest of its canon learnset
 * (data/learnsets.ts) for Pokémonedas; the original kit's moves can be
 * ranked up twice ("Mejoras") so early picks stay viable.
 */

/** Moves the tutor teaches each starter, in shop order: fast, heavy, boost, area (moves of another kit count as new here). */
export const TUTOR_OFFER: Readonly<Record<StarterId, readonly MoveId[]>> = {
  mimikyu: ['astonish', 'slash', 'night-slash', 'x-scissor', 'leech-life', 'draining-kiss', 'drain-punch', 'wood-hammer', 'giga-drain', 'thunderbolt', 'take-down', 'hex', 'hone-claws', 'curse', 'bulk-up', 'will-o-wisp', 'phantom-force', 'burning-jealousy', 'dark-pulse', 'thunder'],
  zorua: ['shadow-claw', 'sucker-punch', 'knock-off', 'u-turn', 'lash-out', 'swift', 'sludge-bomb', 'shadow-ball', 'extrasensory', 'grass-knot', 'swords-dance', 'calm-mind', 'hone-claws', 'agility', 'hyper-voice', 'burning-jealousy'],
  litwick: ['night-shade', 'smog', 'clear-smog', 'flame-charge', 'shadow-ball', 'fire-blast', 'energy-ball', 'overheat', 'flare-blitz', 'poltergeist', 'psychic', 'solar-beam', 'temper-flare', 'calm-mind', 'curse', 'acid-armor', 'minimize', 'fire-spin', 'dark-pulse', 'burning-jealousy'],
  cubone: ['knock-off', 'fire-punch', 'thunder-punch', 'headbutt', 'low-kick', 'double-kick', 'mud-slap', 'double-edge', 'iron-head', 'earth-power', 'brick-break', 'scorching-sands', 'dig', 'focus-punch', 'swords-dance', 'focus-energy', 'belly-drum', 'iron-defense', 'rock-slide', 'ice-beam', 'flamethrower'],
};

/** Moves of the original kits the canon learnsets lack, kept so no save loses them (data/learnsets.ts). */
export const GRANDFATHERED: Readonly<Partial<Record<StarterId, readonly MoveId[]>>> = {
  mimikyu: ['shadow-force'],
  cubone: ['bulk-up'],
};

/**
 * Power tiers (odd/tasks/move-progression.md T1): Básico is the original
 * kit, which sets each slot's baseline; the tutor sells Avanzado moves (up to
 * ×1.2 the baseline's effective damage) and Maestro moves (up to ×1.4), and
 * anything above the baseline pays with real costs (core/move-power.ts).
 */
export type MoveTier = 'basic' | 'advanced' | 'master';
export const MOVE_TIERS: readonly MoveTier[] = ['basic', 'advanced', 'master'];

/** Effective damage budget per tier, as a multiple of the slot/shape baseline. */
export const TIER_BUDGET: Readonly<Record<MoveTier, number>> = { basic: 1, advanced: 1.2, master: 1.4 };

/**
 * The hard ceiling of any move at full investment (rank +2's damage and its
 * effects' expected extra damage included), against the baseline: player
 * damage only; enemy fairness (the one-hit cap, telegraphs) is untouched.
 */
export const HARD_CEILING = 1.75;

/**
 * The Maestro moves, each optionally unlocked only after clearing a dungeon
 * (its guardian beaten on this device), to pace progression.
 */
export const MASTER_MOVES: Readonly<Partial<Record<MoveId, { unlockedBy?: DungeonId }>>> = {
  // Mimikyu
  'wood-hammer': {},
  'phantom-force': { unlockedBy: 'crypt-of-the-sword-king' },
  thunder: { unlockedBy: 'misty-forest' },
  curse: {},
  // Zorua
  'sludge-bomb': {},
  'hyper-voice': { unlockedBy: 'misty-forest' },
  // Litwick
  'fire-blast': {},
  'flare-blitz': { unlockedBy: 'crypt-of-the-sword-king' },
  'fire-spin': { unlockedBy: 'misty-forest' },
  // Cubone
  'double-edge': {},
  'focus-punch': { unlockedBy: 'crypt-of-the-sword-king' },
  'ice-beam': { unlockedBy: 'misty-forest' },
  'belly-drum': {},
};

/** The tier of a move: the original kits are Básico, the Maestro list Maestro, every other tutor move Avanzado. */
export function moveTier(id: MoveId): MoveTier {
  if ((BASE_MOVE_IDS as readonly MoveId[]).includes(id)) return 'basic';
  return MASTER_MOVES[id] ? 'master' : 'advanced';
}

/** The dungeon whose guardian must fall before the tutor teaches `id`, if any. */
export const unlockOf = (id: MoveId): DungeonId | null => MASTER_MOVES[id]?.unlockedBy ?? null;

/** Maestro prices per slot: above every Avanzado price of the slot. */
export const MASTER_PRICES: Readonly<Record<MoveDef['slot'], number>> = { fast: 450, heavy: 800, boost: 600, area: 950 };

/**
 * A move's price in Pokémonedas, by tier, slot and power: stronger moves cost
 * more; a boost costs by its cooldown's rarity. Provisional, on the scale of
 * Poochyena's upgrades (60–550).
 */
export function movePrice(move: MoveDef): number {
  if (moveTier(move.id) === 'master') return MASTER_PRICES[move.slot];
  if (move.slot === 'boost') return 350;
  const tiers: Record<Exclude<MoveDef['slot'], 'boost'>, readonly [number, number, number]> = {
    fast: [120, 200, 300],
    heavy: [220, 380, 560],
    area: [300, 450, 650],
  };
  const [low, mid, high] = tiers[move.slot];
  const cut = move.slot === 'fast' ? [60, 75] : [80, 100];
  return move.power < cut[0]! ? low : move.power < cut[1]! ? mid : high;
}

/** Mejoras of the original kit's moves: the cost of each rank (rank 2 is the last, shown as "+"). */
export const RANK_COSTS: readonly number[] = [150, 350];
export const MAX_RANK = RANK_COSTS.length;

/** Per rank: +10 % damage, and boost/area cooldowns 10 % shorter. */
export const RANK_EFFECT = { damage: 0.1, cooldown: 0.1 } as const;

/**
 * The recommended build per starter (fast, heavy, boost, area), after its
 * competitive sets (data/learnsets.ts `COMPETITIVE_SOURCES`).
 */
export const RECOMMENDED_BUILD: Readonly<Record<StarterId, readonly MoveId[]>> = {
  mimikyu: ['shadow-sneak', 'play-rough', 'swords-dance', 'phantom-force'],
  zorua: ['knock-off', 'sludge-bomb', 'nasty-plot', 'dark-pulse'],
  litwick: ['ember', 'shadow-ball', 'calm-mind', 'flamethrower'],
  cubone: ['knock-off', 'bonemerang', 'swords-dance', 'earthquake'],
};
