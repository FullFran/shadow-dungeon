/**
 * Pokémonedas earned in a run (docs/gdd.md §11). Every value is provisional.
 * The pay grows with what the run actually played (floors, enemies, minutes),
 * so a short easy run is never the best way to farm (GDD §9).
 */
import { DIFFICULTIES, TIERS, type Difficulty } from './difficulty';

export type { Difficulty };

export const COINS = {
  /** Per floor cleared, times its depth (floor 1 pays 6, floor 3 pays 18). */
  perFloor: 6,
  /**
   * Per enemy defeated: base * (1 + perEnemyDepth * (depth - 1)). Raised from
   * 1 with the encounter budget (data/encounters.ts): about 40 % fewer
   * enemies each pay more, so a floor pays about as much as before.
   */
  perEnemy: 1.65,
  perEnemyDepth: 0.5,
  /** Collapse floor escaped within `withinMs` (first matching tier), else `escapeSlow`. */
  escapeTiers: [
    { withinMs: 30_000, coins: 20 },
    { withinMs: 60_000, coins: 12 },
  ] as readonly { withinMs: number; coins: number }[],
  escapeSlow: 6,
  /** Beating the floor's guardian (the run's victory). */
  guardian: 50,
  /** Beating a mid-boss (Trevenant in the Misty Forest): half a guardian, kept even if the run is lost later. */
  midboss: 25,
  /** Per full minute of simulated play (pauses do not count). */
  perMinute: 2,
  /** Share kept on defeat (lo que llevas ganado se queda, con un recorte). */
  defeatShare: 0.75,
  /** Whole-run multiplier by difficulty tier (GDD §9, data/difficulty.ts `TIERS`): easy pays as the game always did. */
  difficulty: Object.fromEntries(DIFFICULTIES.map((d) => [d, TIERS[d].coins])) as Record<Difficulty, number>,
} as const;
