import { lineOf } from '../core/evolution';
import type { PullResult } from '../core/gacha';
import { hasShiny } from '../core/shiny';
import { GACHA, GACHA_POOL, type GachaRarity } from '../data/gacha';
import type { SpeciesId } from '../data/species';
import type { SaveData } from './save';

/**
 * The gacha page's pure model (odd/tasks/gacha-page.md): when each result of a pull is shown,
 * the pity counters, the collection strip and the price of a pull. The rules themselves stay
 * in core/gacha.ts and data/gacha.ts; this only decides what the page shows and when.
 */

/** One result on the reveal's timeline (times in ms from the start of the whole reveal). */
export interface RevealStep {
  index: number;
  result: PullResult;
  kind: 'new' | 'duplicate';
  /** The capsule starts to fall. */
  startMs: number;
  /** From the start to the crack (the anticipation); longer for a rare and longer still for a shiny. */
  crackMs: number;
  /** From the crack to the card standing still. */
  cardMs: number;
  endMs: number;
}

export interface RevealSummary {
  total: number;
  fresh: number;
  duplicates: number;
  refund: number;
  rares: number;
  shinies: number;
}

/** Anticipation before the crack: a lone pull gets the longer hold, a ten the shorter one (it is repeated). */
const HOLD = { single: 1000, many: 480 } as const;
/** Extra hold for a rare and for a shiny (the payoff is worth the wait, never a trap: skip is always there). */
const EXTRA = { rare: { single: 450, many: 320 }, shiny: { single: 800, many: 560 } } as const;
const CARD = { single: 420, many: 300 } as const;
/** Gap between a card landing and the next capsule falling in a ten. */
const GAP_MS = 90;

export function revealPlan(results: readonly PullResult[], reduced: boolean): { steps: RevealStep[]; totalMs: number; summary: RevealSummary } {
  const mode = results.length > 1 ? 'many' : 'single';
  let cursor = 0;
  const steps = results.map((result, index): RevealStep => {
    const hold = reduced ? 0 : HOLD[mode] + (result.shiny ? EXTRA.shiny[mode] : result.rarity === 'rare' ? EXTRA.rare[mode] : 0);
    const cardMs = reduced ? 0 : CARD[mode];
    const startMs = reduced ? 0 : cursor;
    const step: RevealStep = { index, result, kind: result.duplicate ? 'duplicate' : 'new', startMs, crackMs: hold, cardMs, endMs: startMs + hold + cardMs };
    cursor = step.endMs + GAP_MS;
    return step;
  });
  const summary: RevealSummary = {
    total: results.length,
    fresh: results.filter((r) => !r.duplicate).length,
    duplicates: results.filter((r) => r.duplicate).length,
    refund: results.reduce((sum, r) => sum + r.refund, 0),
    rares: results.filter((r) => r.rarity === 'rare').length,
    shinies: results.filter((r) => r.shiny).length,
  };
  return { steps, totalMs: Math.max(0, ...steps.map((s) => s.endMs)), summary };
}

export interface PityBar {
  filled: number;
  total: number;
  left: number;
  /** The very next pull is the sure one. */
  nextSure: boolean;
}

const bar = (since: number, total: number): PityBar => {
  const filled = Math.max(0, Math.min(total, since));
  return { filled, total, left: total - filled, nextSure: total - filled <= 1 };
};

/** The two real counters of the stall, shown flat (no streak, no nudge): pulls since the last rare and the last shiny. */
export const pityView = (save: Pick<SaveData, 'pity' | 'shinyPity'>): { rare: PityBar; shiny: PityBar } => ({
  rare: bar(save.pity ?? 0, GACHA.hardPity),
  shiny: bar(save.shinyPity ?? 0, GACHA.shinyPity),
});

/** Every line the stall sells: owned when any form of it is in the collection; its shiny skin when unlocked. */
export const collectionStrip = (save: Pick<SaveData, 'owned' | 'shinies'>): { species: SpeciesId; rarity: GachaRarity; owned: boolean; shiny: boolean }[] =>
  GACHA_POOL.map((entry) => ({
    species: entry.species,
    rarity: entry.rarity,
    owned: (save.owned ?? []).some((id) => lineOf(id) === entry.species),
    shiny: hasShiny(save, entry.species),
  }));

/** The price of `count` pulls and what the balance lacks. */
export function pullState(save: Pick<SaveData, 'coins'>, count: number): { cost: number; canPull: boolean; missing: number } {
  const cost = GACHA.cost * count;
  const missing = Math.max(0, cost - save.coins);
  return { cost, canPull: missing === 0, missing };
}
