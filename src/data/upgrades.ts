/**
 * Permanent upgrades sold at Poochyena's stall (docs/gdd.md §11), bought with
 * Pokémonedas and applied at the start of every run, for every species.
 * Increments are small on purpose: the game stays hard. Provisional values.
 */
export const UPGRADE_IDS = ['vitality', 'stamina', 'respite', 'reflexes', 'insight'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

/** Owned level per upgrade (missing = 0). */
export type UpgradeLevels = Readonly<Partial<Record<UpgradeId, number>>>;

export interface UpgradeDef {
  /** Cost of each level in order: `costs[0]` buys level 1; the length is the max level. */
  costs: readonly number[];
  /** Effect per level, in the upgrade's own unit (see each entry). */
  perLevel: number;
  /** How the shop shows the bonus: plain points, a percentage of `perLevel` fractions, or milliseconds. */
  unit: 'points' | 'percent' | 'ms';
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  /** +max HP per level. */
  vitality: { costs: [60, 120, 220, 360, 550], perLevel: 4, unit: 'points' },
  /** +stamina regen per level (fraction: 0.05 = 5 % faster). */
  stamina: { costs: [80, 160, 300, 500], perLevel: 0.05, unit: 'percent' },
  /** +heal on entering a new floor per level (fraction of max HP, on top of the run's 25 %). */
  respite: { costs: [100, 220, 400], perLevel: 0.03, unit: 'percent' },
  /** +perfect-dodge window per level (ms, base 120). */
  reflexes: { costs: [120, 260, 480], perLevel: 8, unit: 'ms' },
  /** +experience per level (fraction). */
  insight: { costs: [90, 180, 320, 520], perLevel: 0.05, unit: 'percent' },
};
