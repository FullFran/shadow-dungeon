import { COINS, type Difficulty } from '../data/coins';
import { CAPTURE } from '../data/cards';
import type { GameEvent, WorldState } from './state';

/**
 * Pokémonedas of one run (docs/gdd.md §11), pure. Each peer keeps its own
 * tally while it plays (guests too: nothing goes over the network):
 * `tallyStep` after every simulation step counts the enemies newly credited
 * on the floor (the same rule that pays experience, so a defeat is paid once
 * whoever landed it) and the simulated time; `tallyFloor` when the run goes
 * down records the floor cleared and, after a collapse, how long the escape
 * took. `coinBreakdown` turns the tally into the end screen's lines.
 */
export interface CoinTally {
  /** Depth of every floor cleared, in order. */
  floors: readonly number[];
  /** Depth at which every credited enemy fell. */
  enemies: readonly number[];
  /** Collapse escapes, in ms from entering the floor to taking the stairs. */
  escapes: readonly number[];
  /** Mid-boss floors cleared (their exit only opens once the mid-boss falls). */
  midbosses: number;
  /** Simulated play time (pauses excluded). */
  playedMs: number;
  /** Spell cards the local player captured, guardians' and heralds' alike (core/cards.ts `cardCaptured`, one event each); absent = none. */
  captures?: number;
}

export const emptyTally = (): CoinTally => ({ floors: [], enemies: [], escapes: [], midbosses: 0, playedMs: 0 });

/** After one step: enemies credited since `before` (same floor) at the world's depth, plus `dtMs` of play. */
export function tallyStep(tally: CoinTally, before: Pick<WorldState, 'credited'>, after: Pick<WorldState, 'credited' | 'depth'> & { events?: readonly GameEvent[] }, dtMs: number): CoinTally {
  const fresh = after.credited.filter((id) => !before.credited.includes(id)).length;
  const captured = after.events?.filter((e) => e.type === 'cardCaptured').length ?? 0;
  if (fresh === 0 && dtMs === 0 && captured === 0) return tally;
  const next = { ...tally, enemies: fresh > 0 ? [...tally.enemies, ...Array<number>(fresh).fill(after.depth)] : tally.enemies, playedMs: tally.playedMs + dtMs };
  return captured > 0 ? { ...next, captures: (tally.captures ?? 0) + captured } : next;
}

/** The run left floor `depth`; `escapeMs` is set when it was a collapse, `midboss` when it was a mid-boss arena (beaten to leave). */
export function tallyFloor(tally: CoinTally, depth: number, escapeMs: number | null, midboss = false): CoinTally {
  return {
    ...tally,
    floors: [...tally.floors, depth],
    escapes: escapeMs === null ? tally.escapes : [...tally.escapes, escapeMs],
    midbosses: tally.midbosses + (midboss ? 1 : 0),
  };
}

export interface CoinBreakdown {
  floors: number;
  enemies: number;
  escapes: number;
  /** The guardian on victory plus `COINS.midboss` per mid-boss beaten, plus `CAPTURE.coins` per spell card captured. */
  guardian: number;
  time: number;
  /** Sum of the lines above. */
  subtotal: number;
  /** Share kept (1, or `COINS.defeatShare` on defeat). */
  share: number;
  multiplier: number;
  /** floor(subtotal * share * multiplier). */
  total: number;
}

const escapeCoins = (ms: number): number => COINS.escapeTiers.find((tier) => ms <= tier.withinMs)?.coins ?? COINS.escapeSlow;

/** The coins of a tally: `outcome` null while the run is still going (the HUD's running count). */
export function coinBreakdown(tally: CoinTally, outcome: 'victory' | 'defeat' | 'eclipse' | null, difficulty: Difficulty = 'easy'): CoinBreakdown {
  const floors = COINS.perFloor * tally.floors.reduce((sum, depth) => sum + depth, 0);
  const enemies = Math.floor(tally.enemies.reduce((sum, depth) => sum + COINS.perEnemy * (1 + COINS.perEnemyDepth * Math.max(0, depth - 1)), 0));
  const escapes = tally.escapes.reduce((sum, ms) => sum + escapeCoins(ms), 0);
  const guardian = (outcome === 'victory' ? COINS.guardian : 0) + COINS.midboss * tally.midbosses + CAPTURE.coins * (tally.captures ?? 0);
  const time = COINS.perMinute * Math.floor(tally.playedMs / 60_000);
  const subtotal = floors + enemies + escapes + guardian + time;
  const share = outcome === 'defeat' ? COINS.defeatShare : 1;
  const multiplier = COINS.difficulty[difficulty];
  return { floors, enemies, escapes, guardian, time, subtotal, share, multiplier, total: Math.floor(subtotal * share * multiplier) };
}
