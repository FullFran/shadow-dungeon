import { describe, expect, it } from 'vitest';
import { QUIZ_QUESTIONS } from '../../src/data/quiz';
import { ACCOUNT_ICONS } from '../../src/ui/icons/account-icons';
import { ANSWER_ICONS, ONBOARDING_ICONS, answerIconId } from '../../src/ui/icons/onboarding-icons';
import { PIXEL_ICONS } from '../../src/ui/pixel-icons';

const all = { ...ANSWER_ICONS, ...ONBOARDING_ICONS };

describe('onboarding icons', () => {
  it('has one icon per quiz answer, named question.n', () => {
    const expected = QUIZ_QUESTIONS.flatMap((q) => q.answers.map((_, i) => answerIconId(q.id, i)));
    expect(Object.keys(ANSWER_ICONS).sort()).toEqual([...expected].sort());
    expect(expected).toHaveLength(24);
  });

  it('also holds the welcome, rune and altar marks', () => {
    expect(Object.keys(ONBOARDING_ICONS).sort()).toEqual(['device', 'runeDim', 'runeLit']);
  });

  it('every icon is 16x16, draws only with its palette, 3 to 8 colours, with the ink outline', () => {
    for (const [id, icon] of Object.entries(all)) {
      expect(icon.rows.length, id).toBe(16);
      for (const row of icon.rows) expect(row.length, id).toBe(16);
      const used = new Set(icon.rows.join('').replaceAll('.', ''));
      for (const ch of used) expect(icon.palette[ch], `${id} uses "${ch}"`).toBeTruthy();
      expect(Object.keys(icon.palette).length, id).toBeGreaterThanOrEqual(3);
      expect(Object.keys(icon.palette).length, id).toBeLessThanOrEqual(8);
      expect(Object.values(icon.palette), id).toContain('#140c11');
    }
  });

  it('draws something substantial, never twice the same, never a hub or account icon', () => {
    const taken = new Set([...Object.values(PIXEL_ICONS), ...Object.values(ACCOUNT_ICONS)].map((i) => i.rows.join('')));
    const seen = new Set<string>();
    for (const [id, icon] of Object.entries(all)) {
      const flat = icon.rows.join('');
      expect(flat.replaceAll('.', '').length, id).toBeGreaterThan(id.startsWith('rune') ? 40 : 70);
      expect(taken.has(flat), id).toBe(false);
      seen.add(flat);
    }
    expect(seen.size).toBe(Object.keys(all).length);
  });

  it('the lit rune is warmer than the dim one: more ember colour', () => {
    expect(ONBOARDING_ICONS.runeLit.palette).not.toEqual(ONBOARDING_ICONS.runeDim.palette);
  });
});
