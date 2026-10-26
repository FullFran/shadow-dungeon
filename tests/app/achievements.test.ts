import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { achievementLine, achievementText, achievementTitle } from '../../src/app/achievements';
import { recordRun, recordSave } from '../../src/app/progress';
import { EMPTY_SAVE, loadSave, writeSave } from '../../src/app/save';
import { ACHIEVEMENT_FAMILIES, ACHIEVEMENTS } from '../../src/data/achievements';
import { catalog, LANGUAGES } from '../../src/i18n';

/** Achievements on screen and at the save (odd/tasks/achievements-missions.md T2). */
describe('achievement texts', () => {
  for (const language of LANGUAGES) {
    const tr = (key: string) => catalog(language)[key] ?? key;
    it(`"${language}" names every achievement and family from the content, with every placeholder filled`, () => {
      for (const family of ACHIEVEMENT_FAMILIES) expect(catalog(language)[`achievement.family.${family}`], family).toBeTruthy();
      for (const def of ACHIEVEMENTS) {
        for (const text of [achievementTitle(def, tr), achievementText(def, tr)]) {
          expect(text.startsWith('achievement.'), `${def.id}: ${text}`).toBe(false);
          expect(/[{}]/.test(text), `${def.id}: ${text}`).toBe(false);
          expect(/species\.|dungeon\.|difficulty\./.test(text), `${def.id}: ${text}`).toBe(false);
          expect(text.includes('—'), `${def.id}: ${text}`).toBe(false);
        }
      }
    });
  }

  it('a locked hidden achievement hides its name; an unlocked one shows it', () => {
    const tr = (key: string) => catalog('es')[key] ?? key;
    const secret = ACHIEVEMENTS.find((d) => d.hidden)!;
    expect(achievementLine(secret, undefined, tr).title).toBe('???');
    expect(achievementLine(secret, '2026-10-26', tr)).toMatchObject({ title: achievementTitle(secret, tr), done: true });
  });
});

describe('progress at the save', () => {
  it('a run end settles its achievements into the stored save once', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 5 });
    const report = { dungeon: 'crypt-of-the-sword-king', outcome: 'victory', floor: 5, difficulty: 'normal', species: 'zorua', coop: true, kills: {}, guardianNoHit: false } as const;
    const now = Date.UTC(2026, 9, 26, 12);
    const first = recordRun(store, report, now);
    expect(first.unlocked.map((d) => d.id)).toEqual(expect.arrayContaining(['clear-crypt-of-the-sword-king-easy', 'clear-crypt-of-the-sword-king-normal', 'species-zorua', 'coop-clear']));
    expect(loadSave(store).achievements!['coop-clear']).toBe('2026-10-26');
    expect(loadSave(store).coins).toBe(5 + first.unlocked.reduce((sum, d) => sum + d.reward, 0));
    expect(recordRun(store, report, now).unlocked).toEqual([]);
  });

  it('a change of the collection settles the achievements the save alone earns', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, owned: ['luxio'] });
    expect(recordSave(store, Date.UTC(2026, 9, 26)).unlocked.map((d) => d.id).sort()).toEqual(['evolve-luxio', 'gacha-first-pull']);
  });
});
