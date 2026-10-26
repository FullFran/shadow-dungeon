import type { AchievementDef, AchievementRule } from '../data/achievements';
import { ACHIEVEMENTS } from '../data/achievements';
import { atLeast, type Difficulty } from '../data/difficulty';
import { MOVES, type MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { movePrice, RANK_COSTS_BY_TIER } from '../data/tutor';
import { UPGRADE_IDS, UPGRADES, type UpgradeLevels } from '../data/upgrades';
import { achieved, settleBy, type AchievementWallet } from './achievements';

/**
 * Retroactive achievements (odd/tasks/progress-continuity.md), pure:
 * achievements arrived after players had already cleared dungeons, gone
 * deep into the Sima and built a collection. What persisted state proves is
 * unlocked once, through the same settling as a run end (each reward paid
 * once: the unlocked id is kept). The app builds the history from the notice
 * board records and the Sima leaderboard (app/progress.ts `recordPast`).
 */
export interface PastProgress {
  /** Per dungeon id, the highest tier a run of it was won on. */
  cleared: Readonly<Partial<Record<string, Difficulty>>>;
  /** Per endless dungeon id, the deepest floor a run reached. */
  deepest: Readonly<Partial<Record<string, number>>>;
}

export const NO_PAST: PastProgress = { cleared: {}, deepest: {} };

/** Rules only a run report can prove: no record keeps a guardian's no-hit floor, the species of every win, co-op wins or a first-floor fall. */
export const RUN_ONLY_RULES: readonly AchievementRule['kind'][] = ['flawless', 'species', 'coop', 'stumble'];

/** The save's part the retroactive pass reads. */
export interface PastWallet extends AchievementWallet {
  upgrades: UpgradeLevels;
  learned?: Readonly<Partial<Record<SpeciesId, readonly MoveId[]>>>;
  ranks?: Readonly<Partial<Record<SpeciesId, Readonly<Partial<Record<MoveId, number>>>>>>;
}

/** Whether history and save prove `def` (a run-only rule never holds here). */
export function achievedInPast(def: AchievementDef, past: PastProgress, save: AchievementWallet): boolean {
  const rule = def.rule;
  if (RUN_ONLY_RULES.includes(rule.kind)) return false;
  if (rule.kind === 'clear') {
    const best = past.cleared[rule.dungeon];
    return best !== undefined && atLeast(best, rule.tier);
  }
  if (rule.kind === 'depth') return (past.deepest[rule.dungeon] ?? 0) >= rule.floor;
  return achieved(def, null, save);
}

const CHEAPEST_MOVE = Math.min(...Object.values(MOVES).map(movePrice).filter((p) => p > 0));
const CHEAPEST_RANKS = Object.values(RANK_COSTS_BY_TIER).reduce((low, costs) => low.map((c, i) => Math.min(c, costs[i] ?? c)));

/**
 * A lower bound of the Pokémonedas a save has earned in its lifetime: its
 * balance plus what its upgrades, tutor moves and Mejoras cost, each at the
 * cheapest price any move or tier has (prices of older builds can only be
 * matched or exceeded). Gacha pulls and evolutions are left out (a pull's
 * refund is smaller than its cost, so the bound holds).
 */
export function earnedAtLeast(save: PastWallet): number {
  let total = save.coins;
  for (const id of UPGRADE_IDS) total += UPGRADES[id].costs.slice(0, save.upgrades[id] ?? 0).reduce((a, b) => a + b, 0);
  for (const moves of Object.values(save.learned ?? {})) total += (moves?.length ?? 0) * CHEAPEST_MOVE;
  for (const table of Object.values(save.ranks ?? {})) for (const rank of Object.values(table ?? {})) total += CHEAPEST_RANKS.slice(0, rank ?? 0).reduce((a, b) => a + b, 0);
  return Math.min(Number.MAX_SAFE_INTEGER, total);
}

/**
 * Unlocks on `dateKey` every achievement history and save prove that is not
 * unlocked yet, and pays its reward (core/achievements.ts `settleBy`). A save
 * from before the lifetime count gets its lower bound first (never lowered).
 * The same save comes back when nothing changes, so running it on every load
 * is harmless.
 */
export function settlePast<S extends PastWallet>(save: S, past: PastProgress, dateKey: string, defs: readonly AchievementDef[] = ACHIEVEMENTS): { save: S; unlocked: AchievementDef[] } {
  const floor = earnedAtLeast(save);
  const counted = floor > (save.earned ?? 0) ? { ...save, earned: floor } : save;
  const settled = settleBy(counted, (def, s) => achievedInPast(def, past, s), dateKey, defs);
  return settled.unlocked.length === 0 ? { save: counted, unlocked: [] } : settled;
}
