import type { MoveDef, MoveId } from './moves';
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
 * A move's price in Pokémonedas, by slot and power: stronger moves cost
 * more; a boost costs by its cooldown's rarity. Provisional, on the scale of
 * Poochyena's upgrades (60–550).
 */
export function movePrice(move: MoveDef): number {
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
