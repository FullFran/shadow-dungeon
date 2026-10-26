import type { Difficulty } from './difficulty';
import type { MoveId } from './moves';
import type { SpeciesId } from './species';

/**
 * The gacha lines' evolutions (odd/tasks/gacha-evolutions.md T3), player
 * only (the enemies' own are data/evolutions.ts). Evolving `from` into `to`
 * costs Pokémonedas and `materials` of the line per tier (earned in its
 * challenge dungeon, one tier per difficulty: data/dungeons.ts); `to` keeps the kit, unlocks `move` and plays with `bonus`: its
 * total extra share of max HP and damage over the line's first form.
 * Provisional numbers, on the scale of the tutor's prices.
 */
export interface PlayerEvolution {
  from: SpeciesId;
  to: SpeciesId;
  coins: number;
  /** Materials needed per tier; a higher tier never stands in for a lower one. */
  materials: Readonly<Partial<Record<MaterialTier, number>>>;
  bonus: { hp: number; damage: number };
  move: MoveId;
}

/**
 * A material's tier is the difficulty its challenge was cleared on (Easy pays
 * none). User decision 2026-10-26: the final evolution needs Pesadilla
 * materials, so it cannot happen without clearing at the top difficulty.
 */
export type MaterialTier = Exclude<Difficulty, 'easy'>;
export const MATERIAL_TIERS: readonly MaterialTier[] = ['normal', 'hard', 'nightmare'];

const SECOND = { coins: 400, materials: { normal: 3, hard: 2 }, bonus: { hp: 0.06, damage: 0.06 } } as const;
const THIRD = { coins: 900, materials: { hard: 3, nightmare: 2 }, bonus: { hp: 0.12, damage: 0.12 } } as const;

export const PLAYER_EVOLUTIONS: readonly PlayerEvolution[] = [
  { from: 'abra', to: 'kadabra', ...SECOND, move: 'night-shade' },
  { from: 'kadabra', to: 'alakazam', ...THIRD, move: 'shadow-ball' },
  { from: 'piplup', to: 'prinplup', ...SECOND, move: 'brick-break' },
  { from: 'prinplup', to: 'empoleon', ...THIRD, move: 'ice-beam' },
  { from: 'shinx', to: 'luxio', ...SECOND, move: 'swift' },
  { from: 'luxio', to: 'luxray', ...THIRD, move: 'thunder' },
  { from: 'axew', to: 'fraxure', ...SECOND, move: 'x-scissor' },
  { from: 'fraxure', to: 'haxorus', ...THIRD, move: 'brick-break' },
];

/**
 * The hard ceiling of a stage bonus (HP and damage alike): solo, and lower
 * in a party (more than one player), where every evolved player adds up.
 */
export const STAGE_BONUS_CAP = { solo: 0.15, party: 0.08 } as const;
