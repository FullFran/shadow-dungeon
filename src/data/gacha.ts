import type { SpeciesId } from './species';

/**
 * Phantump's stall, the gacha (odd/tasks/gacha-evolutions.md T2): one table
 * drives the pull (core/gacha.ts) and the stall's window. A pull costs
 * `cost` Pokémonedas and gives one first form of a line: a rare one with
 * `rareRate`, and surely by the `hardPity`-th pull since the last rare.
 * A species whose line is already owned refunds `duplicateRefund`.
 * Abra and Axew are rare (their lines end in the strongest forms); Piplup
 * and Shinx are common. Provisional numbers.
 */
export type GachaRarity = 'common' | 'rare';

export const GACHA = { cost: 100, rareRate: 0.15, hardPity: 10, duplicateRefund: 40 } as const;

export const GACHA_POOL: readonly { species: SpeciesId; rarity: GachaRarity }[] = [
  { species: 'piplup', rarity: 'common' },
  { species: 'shinx', rarity: 'common' },
  { species: 'abra', rarity: 'rare' },
  { species: 'axew', rarity: 'rare' },
];
