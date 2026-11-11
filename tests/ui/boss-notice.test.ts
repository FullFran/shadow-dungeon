import { afterEach, describe, expect, it } from 'vitest';
import { bossPhaseStance, bossSpecies } from '../../src/data/boss-lore';
import { catalog, LANGUAGES, setLanguage } from '../../src/i18n';
import { bossNotice, flashAlpha, takePhaseTip, NOTICE_MS, NOTICE_LIFE_MS, noticeAlpha } from '../../src/ui/boss-notice';
import '../../src/data/guardian-tricks';

describe('the large boss notice (phase change and final defeat)', () => {
  afterEach(() => setLanguage('es'));

  it('stays readable for about 3 seconds', () => {
    expect(NOTICE_MS.hold).toBeGreaterThanOrEqual(2500);
    expect(NOTICE_LIFE_MS).toBeGreaterThanOrEqual(3000);
    expect(NOTICE_LIFE_MS).toBeLessThanOrEqual(4000);
    expect(noticeAlpha(0)).toBe(0);
    expect(noticeAlpha(NOTICE_MS.enter + 100)).toBe(1);
    expect(noticeAlpha(NOTICE_MS.enter + NOTICE_MS.hold - 1)).toBe(1);
    expect(noticeAlpha(NOTICE_LIFE_MS + 1)).toBe(0);
  });

  it('flashes the screen at the start only', () => {
    expect(flashAlpha(0)).toBeGreaterThan(0.3);
    expect(flashAlpha(2000)).toBe(0);
  });

  it('every boss with a second phase announces it with a heading and the phase name, in both languages', () => {
    const phased = bossSpecies().filter((s) => bossPhaseStance(s) !== null);
    expect(phased.length).toBeGreaterThanOrEqual(4);
    for (const lang of LANGUAGES) {
      setLanguage(lang);
      for (const species of phased) {
        const notice = bossNotice({ kind: 'phase', species, stance: bossPhaseStance(species)! }, { showTip: false });
        expect(notice.heading, `${lang} ${species}`).toBe(catalog(lang)['boss.moment.phase']);
        expect(notice.name.length, `${lang} ${species}`).toBeGreaterThan(0);
        expect(notice.name).not.toMatch(/^(boss|species|spell)\./);
        expect(notice.tip).toBeNull();
      }
    }
  });

  it('every boss announces its final defeat with its own name, in both languages', () => {
    for (const lang of LANGUAGES) {
      setLanguage(lang);
      for (const species of bossSpecies()) {
        const notice = bossNotice({ kind: 'finale', species }, { showTip: true });
        expect(notice.heading, `${lang} ${species}`).toBe(catalog(lang)['boss.moment.finale']);
        expect(notice.name, `${lang} ${species}`).toBe(catalog(lang)[`species.${species}`]);
        // The tip is about phases: never on a final defeat.
        expect(notice.tip).toBeNull();
      }
    }
  });

  it('the one-time tip teaches what a phase change means, only when asked for', () => {
    const species = bossSpecies().find((s) => bossPhaseStance(s) !== null)!;
    const moment = { kind: 'phase' as const, species, stance: bossPhaseStance(species)! };
    for (const lang of LANGUAGES) {
      setLanguage(lang);
      expect(bossNotice(moment, { showTip: true }).tip).toBe(catalog(lang)['boss.moment.tip']);
      expect(bossNotice(moment, { showTip: false }).tip).toBeNull();
    }
    expect(catalog('es')['boss.moment.tip']).toBe('El jefe cambia de fase: recupera fuerzas y cambia sus ataques');
  });

  it('the tip is taken once and remembered; a run without a tip store never shows it', () => {
    let seen = false;
    const tip = { seen: () => seen, mark: () => void (seen = true) };
    expect(takePhaseTip(tip)).toBe(true);
    expect(seen).toBe(true);
    expect(takePhaseTip(tip)).toBe(false);
    expect(takePhaseTip(undefined)).toBe(false);
  });
});
