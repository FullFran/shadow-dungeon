/**
 * Move slots. The layout (how many slots and of which kind) is data so a
 * slot can be added without touching the core: fast (LMB / Q), heavy (RMB /
 * E, hold to charge), boost (R / 1: a self-buff on a cooldown) and area
 * (F / 2: a cone, ring or wave on a cooldown and stamina).
 */
export type SlotKind = 'fast' | 'heavy' | 'boost' | 'area';

/** M0: fast slot on left click / Q, heavy slot on right click / E. */
export const M0_SLOT_LAYOUT: readonly SlotKind[] = ['fast', 'heavy'];

/** The player's slots since four-slots: M0's two plus boost and area (either may stay empty). */
export const PLAYER_SLOT_LAYOUT: readonly SlotKind[] = ['fast', 'heavy', 'boost', 'area'];

export const MAX_SLOTS = 4;
