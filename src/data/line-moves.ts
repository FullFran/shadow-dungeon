import { arc, dash, def, shot } from './tutor-moves';
import type { MoveDef } from './moves';

/**
 * Moves of the gacha's evolution lines that no other kit has
 * (odd/tasks/gacha-evolutions.md T3): the Water, Electric and Dragon basics.
 * Built like the tutor's moves, inside the original kits' budget (Básico:
 * tests/core/evolution.test.ts): their kits are as strong as a starter's.
 */
export const LINE_MOVE_IDS = ['water-gun', 'bubble-beam', 'surf', 'spark', 'dragon-claw', 'dragon-pulse', 'hyper-beam'] as const;

export type LineMoveId = (typeof LINE_MOVE_IDS)[number];

export const LINE_MOVES: Record<LineMoveId, MoveDef> = {
  // Piplup
  'water-gun': def('water-gun', 'fast', 'water', 40, [80, 60, 170], shot(230, 7, 800), 200, 20),
  'bubble-beam': def('bubble-beam', 'heavy', 'water', 65, [260, 60, 340], shot(180, 9, 2000), 360, 40),
  surf: def('surf', 'area', 'water', 90, [500, 120, 380], arc(62, 360), 380, 70, { staminaCost: 35, cooldownMs: 7600 }),
  // Shinx
  spark: def('spark', 'fast', 'electric', 65, [80, 140, 200], dash(70, 16), 260, 40),
  // Axew
  'dragon-claw': def('dragon-claw', 'fast', 'dragon', 80, [110, 80, 200], arc(36, 90), 260, 40),
  'dragon-pulse': def('dragon-pulse', 'heavy', 'dragon', 85, [300, 60, 420], shot(180, 10, 2200), 400, 60),
  // Chandelure's stage move (odd/tasks/roster-parity.md): a huge beam, then a long recharge.
  'hyper-beam': def('hyper-beam', 'heavy', 'normal', 150, [420, 60, 1000], shot(320, 12, 560, { wave: true }), 480, 80, { staminaCost: 35, juice: 'heavy' }),
};
