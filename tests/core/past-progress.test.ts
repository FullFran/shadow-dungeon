import { describe, expect, it } from 'vitest';
import { achieved } from '../../src/core/achievements';
import { achievedInPast, earnedAtLeast, NO_PAST, RUN_ONLY_RULES, settlePast, type PastProgress } from '../../src/core/past-progress';
import type { SaveData } from '../../src/app/save';
import { ACHIEVEMENTS, type AchievementDef } from '../../src/data/achievements';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { GACHA_POOL } from '../../src/data/gacha';
import { RANK_COSTS_BY_TIER } from '../../src/data/tutor';
import { UPGRADES } from '../../src/data/upgrades';

/** Retroactive achievements (odd/tasks/progress-continuity.md T2): what persisted history proves, unlocked once. */
const save = (over: Partial<SaveData> = {}): SaveData => ({ version: 4, coins: 0, upgrades: {}, ...over });

/** A history and save that prove `def` without a run report, or null for the rules only a run can prove. */
function pastWitness(def: AchievementDef): { past: PastProgress; save: SaveData } | null {
  const r = def.rule;
  switch (r.kind) {
    case 'clear':
      return { past: { cleared: { [r.dungeon]: r.tier }, deepest: {} }, save: save() };
    case 'depth':
      return { past: { cleared: {}, deepest: { [r.dungeon]: r.floor } }, save: save() };
    case 'evolve':
      return { past: NO_PAST, save: save({ owned: [r.species] }) };
    case 'awaken':
      return { past: NO_PAST, save: save({ awakened: { [r.species]: r.step } }) };
    case 'firstPull':
      return { past: NO_PAST, save: save({ owned: [GACHA_POOL[0]!.species] }) };
    case 'collectAll':
      return { past: NO_PAST, save: save({ owned: GACHA_POOL.map((p) => p.species) }) };
    case 'shiny':
      return { past: NO_PAST, save: save({ shinies: [r.line] }) };
    case 'earned':
      return { past: NO_PAST, save: save({ earned: r.coins }) };
    case 'flawless':
    case 'species':
    case 'coop':
    case 'stumble':
      return null;
  }
}

describe('retroactive achievements', () => {
  it('every achievement a history can prove unlocks through the retroactive pass; the run-only ones never do', () => {
    for (const def of ACHIEVEMENTS) {
      const w = pastWitness(def);
      expect(RUN_ONLY_RULES.includes(def.rule.kind), def.id).toBe(w === null);
      if (!w) {
        // Nothing persisted can stand in for these: a fully played history still leaves them to a run.
        const everything: PastProgress = { cleared: Object.fromEntries(ACHIEVEMENTS.flatMap((d) => (d.rule.kind === 'clear' ? [[d.rule.dungeon, 'nightmare']] : []))), deepest: { 'eclipse-chasm': 999 } };
        expect(achievedInPast(def, everything, save()), def.id).toBe(false);
        continue;
      }
      expect(achievedInPast(def, w.past, w.save), def.id).toBe(true);
      expect(achievedInPast(def, NO_PAST, save()), def.id).toBe(false);
      expect(settlePast(w.save, w.past, '2026-10-26').unlocked.map((d) => d.id), def.id).toContain(def.id);
    }
  });

  it('a clear on a tier credits every lower tier of that dungeon only', () => {
    const past: PastProgress = { cleared: { 'misty-forest': 'hard' }, deepest: {} };
    const got = settlePast(save(), past, '2026-10-26').unlocked.map((d) => d.id);
    for (const tier of DIFFICULTIES) expect(got.includes(`clear-misty-forest-${tier}`), tier).toBe(tier !== 'nightmare');
    expect(got.some((id) => id.startsWith('clear-crypt'))).toBe(false);
  });

  it('pays each reward once and is idempotent', () => {
    const past: PastProgress = { cleared: { 'crypt-of-the-sword-king': 'nightmare' }, deepest: { 'eclipse-chasm': 25 } };
    const first = settlePast(save({ coins: 100 }), past, '2026-10-26');
    const paid = first.unlocked.reduce((sum, d) => sum + d.reward, 0);
    expect(paid).toBeGreaterThan(0);
    expect(first.save.coins).toBe(100 + paid);
    const again = settlePast(first.save, past, '2026-10-27');
    expect(again.unlocked).toEqual([]);
    expect(again.save).toBe(first.save);
  });

  it('agrees with the run-end rules for the save-only achievements', () => {
    const s = save({ owned: ['kadabra', 'piplup'], awakened: { mimikyu: 1 }, shinies: ['zorua'], earned: 5000 });
    for (const def of ACHIEVEMENTS.filter((d) => !RUN_ONLY_RULES.includes(d.rule.kind) && d.rule.kind !== 'clear' && d.rule.kind !== 'depth')) {
      expect(achievedInPast(def, NO_PAST, s), def.id).toBe(achieved(def, null, s));
    }
  });
});

describe('lifetime Pokémonedas of a save from before the count', () => {
  it('is at least the balance plus what the upgrades, tutor moves and Mejoras cost at their cheapest', () => {
    const s = save({ coins: 1000, upgrades: { vitality: 2, insight: 1 }, learned: { cubone: ['knock-off', 'headbutt'] }, ranks: { cubone: { 'bone-club': 2 } } });
    const upgrades = UPGRADES.vitality.costs[0]! + UPGRADES.vitality.costs[1]! + UPGRADES.insight.costs[0]!;
    const ranks = RANK_COSTS_BY_TIER.basic[0]! + RANK_COSTS_BY_TIER.basic[1]!;
    expect(earnedAtLeast(s)).toBeGreaterThanOrEqual(1000 + upgrades + ranks + 2);
    expect(earnedAtLeast(save())).toBe(0);
  });

  it('never lowers a lifetime count already kept', () => {
    const s = save({ coins: 10, earned: 999_999 });
    expect(settlePast(s, NO_PAST, '2026-10-26').save.earned).toBe(999_999);
  });

  it('a pre-v4 balance alone reaches the first milestone', () => {
    const { unlocked } = settlePast(save({ coins: 4321 }), NO_PAST, '2026-10-26');
    expect(unlocked.map((d) => d.id)).toContain('earned-1000');
  });
});
