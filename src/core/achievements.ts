import { ACHIEVEMENT_FAMILIES, ACHIEVEMENTS, type AchievementDef, type AchievementFamily } from '../data/achievements';
import { atLeast } from '../data/difficulty';
import { GACHA_POOL } from '../data/gacha';
import type { SpeciesId } from '../data/species';
import { lineOf, stageOf } from './evolution';
import type { RunReport } from './run-report';

/**
 * Achievements (data/achievements.ts), pure: evaluated once per run end
 * (from that peer's own report) and after a gacha pull or an evolution
 * (from the save), never per frame. The save keeps each unlocked id with
 * the UTC day it was unlocked.
 */
export type Unlocked = Readonly<Record<string, string>>;

/** The save's part the rules read. */
export interface ProgressSnapshot {
  owned?: readonly SpeciesId[];
  /** Awakening steps per species that never evolves. */
  awakened?: Readonly<Partial<Record<SpeciesId, number>>>;
  /** Lifetime Pokémonedas earned. */
  earned?: number;
  /** Lines with their shiny skin unlocked. */
  shinies?: readonly SpeciesId[];
}

/** Whether `def` holds for this run (null: no run, the save only) and save. */
export function achieved(def: AchievementDef, report: RunReport | null, save: ProgressSnapshot): boolean {
  const rule = def.rule;
  const won = report?.outcome === 'victory';
  const owned = save.owned ?? [];
  switch (rule.kind) {
    case 'clear':
      return won && report!.dungeon === rule.dungeon && atLeast(report!.difficulty, rule.tier);
    case 'flawless':
      return won && report!.dungeon === rule.dungeon && report!.guardianNoHit;
    case 'depth':
      return report !== null && report.dungeon === rule.dungeon && report.floor >= rule.floor;
    case 'species':
      return won && report!.species === rule.species;
    case 'evolve':
      return owned.some((id) => lineOf(id) === lineOf(rule.species) && stageOf(id) >= stageOf(rule.species));
    case 'awaken':
      return (save.awakened?.[rule.species] ?? 0) >= rule.step;
    case 'firstPull':
      return owned.length > 0;
    case 'collectAll':
      return GACHA_POOL.every((p) => owned.some((id) => lineOf(id) === lineOf(p.species)));
    case 'shiny':
      return (save.shinies ?? []).includes(rule.line);
    case 'coop':
      return won && report!.coop;
    case 'earned':
      return (save.earned ?? 0) >= rule.coins;
    case 'stumble':
      return report !== null && report.outcome === 'defeat' && report.floor <= 1;
  }
}

/** The achievements not yet in `unlocked` that this run and save earn, in list order. */
export const newlyUnlocked = (unlocked: Unlocked, report: RunReport | null, save: ProgressSnapshot, defs: readonly AchievementDef[] = ACHIEVEMENTS): AchievementDef[] =>
  defs.filter((def) => unlocked[def.id] === undefined && achieved(def, report, save));

/** `unlocked` with `defs` added on `dateKey` (a UTC day, YYYY-MM-DD). */
export function unlockAll(unlocked: Unlocked, defs: readonly AchievementDef[], dateKey: string): Record<string, string> {
  const next: Record<string, string> = { ...unlocked };
  for (const def of defs) next[def.id] ??= dateKey;
  return next;
}

/** Pokémonedas `defs` pay on unlock. */
export const rewardOf = (defs: readonly AchievementDef[]): number => defs.reduce((sum, d) => sum + d.reward, 0);

/** Unlocked over total, per family, in window order. */
export function familyProgress(unlocked: Unlocked, defs: readonly AchievementDef[] = ACHIEVEMENTS): { family: AchievementFamily; done: number; total: number }[] {
  return ACHIEVEMENT_FAMILIES.map((family) => {
    const mine = defs.filter((d) => d.family === family);
    return { family, done: mine.filter((d) => unlocked[d.id] !== undefined).length, total: mine.length };
  });
}

/** The save's part settling touches. */
export interface AchievementWallet extends ProgressSnapshot {
  coins: number;
  achievements?: Unlocked;
}

/**
 * Unlocks what this run (null: none) and save earn on `dateKey` and pays
 * their Pokémonedas into the balance and the lifetime count; a reward that
 * reaches a lifetime milestone unlocks it too. The same save comes back
 * when nothing unlocks.
 */
export const settleAchievements = <S extends AchievementWallet>(save: S, report: RunReport | null, dateKey: string, defs: readonly AchievementDef[] = ACHIEVEMENTS): { save: S; unlocked: AchievementDef[] } =>
  settleBy(save, (def, s) => achieved(def, report, s), dateKey, defs);

/**
 * The settling loop for any rule check (`holds`, read against the save as
 * it grows): unlock, pay, repeat until nothing more holds (a reward can reach
 * a lifetime milestone). The same save comes back when nothing unlocks.
 */
export function settleBy<S extends AchievementWallet>(save: S, holds: (def: AchievementDef, save: S) => boolean, dateKey: string, defs: readonly AchievementDef[] = ACHIEVEMENTS): { save: S; unlocked: AchievementDef[] } {
  let next = save;
  const unlocked: AchievementDef[] = [];
  const pending = (): AchievementDef[] => defs.filter((def) => next.achievements?.[def.id] === undefined && holds(def, next));
  for (let fresh = pending(); fresh.length > 0; fresh = pending()) {
    const paid = rewardOf(fresh);
    next = { ...next, achievements: unlockAll(next.achievements ?? {}, fresh, dateKey), coins: next.coins + paid, earned: (next.earned ?? 0) + paid };
    unlocked.push(...fresh);
  }
  return { save: next, unlocked };
}
