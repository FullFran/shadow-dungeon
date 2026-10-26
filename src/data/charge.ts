import type { ChargeLevel } from './moves';

/** The charge levels every heavy move shares: a tap, then two holds. */
export const HEAVY_CHARGE: readonly ChargeLevel[] = [
  { holdMs: 0, damageMultiplier: 1, sizeMultiplier: 1, speedMultiplier: 1 },
  { holdMs: 450, damageMultiplier: 1.4, sizeMultiplier: 1.25, speedMultiplier: 1.3 },
  { holdMs: 900, damageMultiplier: 1.9, sizeMultiplier: 1.5, speedMultiplier: 1.6 },
];
