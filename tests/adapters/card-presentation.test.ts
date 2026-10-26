import { describe, expect, it } from 'vitest';
import { soundFor } from '../../src/adapters/audio';
import { DECLARE, declareAlpha, spellAlpha } from '../../src/adapters/intro-card';
import { catalog, LANGUAGES } from '../../src/i18n';
// Every card fight registers its cards when its data loads (the game loads them all).
import '../../src/data/guardian-tricks';

/**
 * The card presentation pass ("Touhou inside, souls/MD outside", user
 * decision 2026-10-26 B): a declaration has its own sting and a short,
 * dramatic hold; a boss's own moves keep their stance sound; a capture says
 * "¡Técnica dominada!" with its flourish; "tu turno" has a soft cue.
 */
describe('card presentation', () => {
  it('a card declaration stings; a hosted boss announcing its own move does not', () => {
    expect(soundFor({ type: 'bossStance', enemyId: 'e', stance: 'sc-aeg-walls' })).toBe('cardDeclare');
    expect(soundFor({ type: 'bossStance', enemyId: 'e', stance: 'sc-dhe-kelp' })).toBe('cardDeclare');
    expect(soundFor({ type: 'bossStance', enemyId: 'e', stance: 'kelp' })).toBe('stance');
    expect(soundFor({ type: 'bossStance', enemyId: 'e', stance: 'herald0' })).toBe('cardDeclare');
  });

  it('a capture has its flourish and "tu turno" its soft cue', () => {
    expect(soundFor({ type: 'cardCaptured', enemyId: 'e', card: 'sc-aeg-walls', heal: 12 })).toBe('cardCapture');
    expect(soundFor({ type: 'bossTurn', enemyId: 'e', durationMs: 1000 })).toBe('turnOpen');
  });

  it('the declaration holds the screen about as long as the break, shorter than the old strip', () => {
    const total = DECLARE.fadeInMs + DECLARE.holdMs + DECLARE.fadeOutMs;
    expect(total).toBeGreaterThanOrEqual(1200);
    expect(total).toBeLessThanOrEqual(2000);
    expect(declareAlpha({ shownAtMs: 0 }, DECLARE.fadeInMs + 10)).toBe(1);
    expect(declareAlpha({ shownAtMs: 0 }, total + 10)).toBe(0);
    expect(spellAlpha({ shownAtMs: 0 }, total + 10)).toBeGreaterThan(0);
  });

  it('says "¡Técnica dominada!" and its reward in every language', () => {
    expect(catalog('es')['card.mastered']).toBe('¡Técnica dominada!');
    for (const lang of LANGUAGES) {
      expect(catalog(lang)['card.mastered']).toBeTruthy();
      expect(catalog(lang)['card.reward']).toContain('{coins}');
      expect(catalog(lang)['card.reward']).toContain('{heal}');
    }
  });
});
