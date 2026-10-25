/**
 * Move slots. The layout (how many slots and of which kind) is data so a
 * boost slot, or up to four slots, can be added without touching the core.
 */
export type SlotKind = 'fast' | 'heavy' | 'boost';

/** M0: fast slot on left click / Q, heavy slot on right click / E. */
export const M0_SLOT_LAYOUT: readonly SlotKind[] = ['fast', 'heavy'];

export const MAX_SLOTS = 4;
