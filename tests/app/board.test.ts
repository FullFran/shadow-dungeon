import { describe, expect, it } from 'vitest';
import { missionText, missionTitle, rewardText, statusText } from '../../src/app/board';
import { utcDateKey } from '../../src/core/endless';
import { dailyMissions, weeklyMission } from '../../src/core/missions';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The notice board's missions on screen (odd/tasks/achievements-missions.md T4). */
const DAY = 86_400_000;
const missions = Array.from({ length: 120 }, (_, i) => utcDateKey(Date.UTC(2026, 0, 1) + i * DAY)).flatMap((d) => [...dailyMissions(d), weeklyMission(d)]);

describe('mission texts', () => {
  for (const language of LANGUAGES) {
    const tr = (key: string) => catalog(language)[key] ?? key;
    it(`"${language}" tells every kind of mission with the content's names and every placeholder filled`, () => {
      for (const m of missions) {
        for (const text of [missionTitle(m, tr), missionText(m, tr), rewardText(m.reward, tr)]) {
          expect(/[{}]/.test(text), `${m.id}: ${text}`).toBe(false);
          expect(/(^|\s)(mission|species|type|difficulty|dungeon)\./.test(text), `${m.id}: ${text}`).toBe(false);
          expect(text.includes('—'), `${m.id}: ${text}`).toBe(false);
        }
      }
      for (const status of ['open', 'done', 'claimed'] as const) expect(statusText(status, 0, 1, tr)).toBe(catalog(language)[`mission.status.${status}`]);
      expect(statusText('accepted', 3, 12, tr)).toBe('3/12');
    });
  }

  it('a reward names its materials and their tier', () => {
    const tr = (key: string) => catalog('es')[key] ?? key;
    expect(rewardText({ coins: 60, materials: { line: 'abra', tier: 'hard', count: 2 } }, tr)).toBe('60 P + 2 Esencias de Abra (Difícil)');
  });
});
