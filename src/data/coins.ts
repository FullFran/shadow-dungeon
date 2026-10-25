/**
 * Pokémonedas earned in a run (docs/gdd.md §11). Every value is provisional.
 * The pay grows with what the run actually played (floors, enemies, minutes),
 * so a short easy run is never the best way to farm (GDD §9).
 */
export type Difficulty = 'easy' | 'normal' | 'hard' | 'nightmare';

export const COINS = {
  /** Per floor cleared, times its depth (floor 1 pays 6, floor 3 pays 18). */
  perFloor: 6,
  /** Per enemy defeated: base * (1 + perEnemyDepth * (depth - 1)). */
  perEnemy: 1,
  perEnemyDepth: 0.5,
  /** Collapse floor escaped within `withinMs` (first matching tier), else `escapeSlow`. */
  escapeTiers: [
    { withinMs: 30_000, coins: 20 },
    { withinMs: 60_000, coins: 12 },
  ] as readonly { withinMs: number; coins: number }[],
  escapeSlow: 6,
  /** Beating the floor's guardian (the run's victory). */
  guardian: 50,
  /** Per full minute of simulated play (pauses do not count). */
  perMinute: 2,
  /** Share kept on defeat (lo que llevas ganado se queda, con un recorte). */
  defeatShare: 0.75,
  /** Whole-run multiplier by difficulty (GDD §9); the game runs on normal until difficulty is selectable. */
  difficulty: { easy: 0.5, normal: 1, hard: 2.5, nightmare: 5 } as Record<Difficulty, number>,
} as const;
