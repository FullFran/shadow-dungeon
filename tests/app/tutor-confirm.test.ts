import { describe, expect, it, vi } from 'vitest';
import { confirmCopy, spendAfterConfirm, tutorCards } from '../../src/app/tutor';
import { setLanguage, t } from '../../src/i18n';

describe('tutor confirmation before spending', () => {
  setLanguage('es');
  const card = (kind: 'learn' | 'rank') => tutorCards({ coins: 99999, cleared: ['misty-forest'] }, 'mimikyu', 'all').find((c) => c.action === kind)!;

  it('does not spend when the player cancels', async () => {
    const spend = vi.fn(() => true);
    const done = await spendAfterConfirm(() => Promise.resolve(false), spend);
    expect(spend).not.toHaveBeenCalled();
    expect(done).toBe(false);
  });

  it('spends once, only after the player confirms', async () => {
    let answer!: (v: boolean) => void;
    const spend = vi.fn(() => true);
    const pending = spendAfterConfirm(() => new Promise<boolean>((r) => (answer = r)), spend);
    await Promise.resolve();
    expect(spend).not.toHaveBeenCalled();
    answer(true);
    expect(await pending).toBe(true);
    expect(spend).toHaveBeenCalledTimes(1);
  });

  it('copy: learning and ranking each get a title, one sentence naming the move, a button and the price', () => {
    for (const kind of ['learn', 'rank'] as const) {
      const c = card(kind);
      const copy = confirmCopy(c);
      expect(copy.title.length).toBeGreaterThan(0);
      expect(copy.body).toContain(t(`move.${c.move}`));
      expect(copy.confirmLabel.length).toBeGreaterThan(0);
      expect(copy.cost).toBe(c.cost);
      expect(copy.body).not.toMatch(/\{|\}|—/);
    }
    expect(confirmCopy(card('learn')).title).not.toBe(confirmCopy(card('rank')).title);
  });
});
