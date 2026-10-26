import { describe, expect, it } from 'vitest';
import { achieved, familyProgress, newlyUnlocked, unlockAll } from '../../src/core/achievements';
import { lineOf, stageOf } from '../../src/core/evolution';
import type { RunReport } from '../../src/core/run-report';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENTS, achievementById, clearableDungeons, type AchievementDef } from '../../src/data/achievements';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { CHALLENGES, DUNGEONS, guardianOf } from '../../src/data/dungeons';
import { GACHA_POOL } from '../../src/data/gacha';
import { PLAYER_EVOLUTIONS } from '../../src/data/player-evolutions';
import { SIMA_BANDS } from '../../src/data/sima';
import { PLAYABLE_SPECIES } from '../../src/data/species';

/** Achievements (odd/tasks/achievements-missions.md T1): generated from the content lists, evaluated from run reports and the save. */
const report = (over: Partial<RunReport> = {}): RunReport => ({
  dungeon: 'crypt-of-the-sword-king',
  outcome: 'victory',
  floor: 5,
  difficulty: 'easy',
  species: 'mimikyu',
  coop: false,
  kills: {},
  guardianNoHit: false,
  ...over,
});

const ids = (defs: readonly AchievementDef[]) => defs.map((d) => d.id);

describe('achievements as data', () => {
  it('ids are unique and every achievement belongs to a listed family', () => {
    expect(new Set(ids(ACHIEVEMENTS)).size).toBe(ACHIEVEMENTS.length);
    for (const def of ACHIEVEMENTS) expect(ACHIEVEMENT_FAMILIES, def.id).toContain(def.family);
    for (const family of ACHIEVEMENT_FAMILIES) expect(ACHIEVEMENTS.some((d) => d.family === family), family).toBe(true);
  });

  it('every main and challenge dungeon with floors has a clear on every tier, and a flawless guardian one', () => {
    const clearable = [...DUNGEONS, ...CHALLENGES].filter((d) => !d.endless);
    expect(clearableDungeons().map((d) => d.id)).toEqual(clearable.map((d) => d.id));
    for (const d of clearable) {
      for (const tier of DIFFICULTIES) expect(ACHIEVEMENTS.some((a) => a.rule.kind === 'clear' && a.rule.dungeon === d.id && a.rule.tier === tier), `${d.id} ${tier}`).toBe(true);
      if (guardianOf(d)) expect(ACHIEVEMENTS.some((a) => a.rule.kind === 'flawless' && a.rule.dungeon === d.id), d.id).toBe(true);
    }
  });

  it('every stratum of the endless dungeon below the first is a depth achievement', () => {
    for (const d of DUNGEONS.filter((x) => x.endless)) {
      for (const band of SIMA_BANDS.slice(1)) expect(ACHIEVEMENTS.some((a) => a.rule.kind === 'depth' && a.rule.dungeon === d.id && a.rule.floor === band.fromFloor), `${d.id} ${band.id}`).toBe(true);
    }
  });

  it('every playable species has a clear-with achievement and every evolution an evolve one', () => {
    for (const s of PLAYABLE_SPECIES) expect(ACHIEVEMENTS.some((a) => a.rule.kind === 'species' && a.rule.species === s), s).toBe(true);
    for (const e of PLAYER_EVOLUTIONS) expect(ACHIEVEMENTS.some((a) => a.rule.kind === 'evolve' && a.rule.species === e.to), e.to).toBe(true);
  });

  it('rewards are small whole Pokémonedas (no power, no materials)', () => {
    for (const def of ACHIEVEMENTS) {
      expect(Number.isInteger(def.reward) && def.reward >= 0 && def.reward <= 200, def.id).toBe(true);
      expect(Object.keys(def).sort().filter((k) => !['id', 'family', 'rule', 'reward', 'hidden'].includes(k)), def.id).toEqual([]);
    }
  });

  it('looks achievements up by id', () => {
    for (const def of ACHIEVEMENTS) expect(achievementById(def.id)).toBe(def);
    expect(achievementById('nope')).toBeNull();
  });
});

/** A run report and a save that should unlock `def` (each rule's witness). */
function witness(def: AchievementDef): { report: RunReport | null; save: { owned?: string[]; earned?: number } } {
  const r = def.rule;
  switch (r.kind) {
    case 'clear':
      return { report: report({ dungeon: r.dungeon, difficulty: r.tier }), save: {} };
    case 'flawless':
      return { report: report({ dungeon: r.dungeon, guardianNoHit: true }), save: {} };
    case 'depth':
      return { report: report({ dungeon: r.dungeon, outcome: 'eclipse', floor: r.floor }), save: {} };
    case 'species':
      return { report: report({ species: r.species }), save: {} };
    case 'evolve':
      return { report: null, save: { owned: [r.species] } };
    case 'firstPull':
      return { report: null, save: { owned: [GACHA_POOL[0]!.species] } };
    case 'collectAll':
      return { report: null, save: { owned: GACHA_POOL.map((p) => p.species) } };
    case 'coop':
      return { report: report({ coop: true }), save: {} };
    case 'earned':
      return { report: null, save: { earned: r.coins } };
    case 'stumble':
      return { report: report({ outcome: 'defeat', floor: 1 }), save: {} };
  }
}

describe('evaluating achievements', () => {
  it('every achievement has a witness that unlocks it, and an empty save unlocks nothing', () => {
    for (const def of ACHIEVEMENTS) {
      const w = witness(def);
      expect(achieved(def, w.report, w.save as never), def.id).toBe(true);
      expect(achieved(def, null, {}), def.id).toBe(false);
    }
  });

  it('a clear on a tier counts for every lower tier of that dungeon, never a higher one or another dungeon', () => {
    const got = ids(newlyUnlocked({}, report({ dungeon: 'misty-forest', difficulty: 'hard' }), {}));
    expect(got).toEqual(expect.arrayContaining(['clear-misty-forest-easy', 'clear-misty-forest-normal', 'clear-misty-forest-hard']));
    expect(got).not.toContain('clear-misty-forest-nightmare');
    expect(got.some((id) => id.startsWith('clear-crypt'))).toBe(false);
  });

  it('a defeat clears nothing; the flawless guardian needs the no-hit flag', () => {
    expect(ids(newlyUnlocked({}, report({ outcome: 'defeat', floor: 4 }), {})).some((id) => id.startsWith('clear-'))).toBe(false);
    expect(ids(newlyUnlocked({}, report(), {}))).not.toContain('flawless-crypt-of-the-sword-king');
    expect(ids(newlyUnlocked({}, report({ guardianNoHit: true }), {}))).toContain('flawless-crypt-of-the-sword-king');
  });

  it('the Sima counts depth whatever the outcome; reaching a band unlocks the shallower ones too', () => {
    const got = ids(newlyUnlocked({}, report({ dungeon: 'eclipse-chasm', outcome: 'eclipse', floor: 25 }), {}));
    expect(got).toEqual(expect.arrayContaining(['depth-eclipse-chasm-11', 'depth-eclipse-chasm-21']));
    expect(got).not.toContain('depth-eclipse-chasm-31');
  });

  it('an evolved form also proves every earlier evolution of its line', () => {
    const got = ids(newlyUnlocked({}, null, { owned: ['alakazam'] }));
    expect(got).toEqual(expect.arrayContaining(['evolve-kadabra', 'evolve-alakazam', 'gacha-first-pull']));
    expect(got).not.toContain('evolve-luxio');
    for (const e of PLAYER_EVOLUTIONS) expect(lineOf(e.to) === lineOf(e.from) && stageOf(e.to) === stageOf(e.from) + 1).toBe(true);
  });

  it('already unlocked achievements are not returned again', () => {
    const first = newlyUnlocked({}, report(), {});
    const unlocked = unlockAll({}, first, '2026-10-26');
    expect(Object.values(unlocked).every((date) => date === '2026-10-26')).toBe(true);
    expect(newlyUnlocked(unlocked, report(), {})).toEqual([]);
  });

  it('family progress counts done over total for every family', () => {
    const unlocked = unlockAll({}, newlyUnlocked({}, report(), {}), '2026-10-26');
    const progress = familyProgress(unlocked);
    expect(progress.map((p) => p.family)).toEqual([...ACHIEVEMENT_FAMILIES]);
    expect(progress.reduce((sum, p) => sum + p.total, 0)).toBe(ACHIEVEMENTS.length);
    expect(progress.reduce((sum, p) => sum + p.done, 0)).toBe(Object.keys(unlocked).length);
  });
});
