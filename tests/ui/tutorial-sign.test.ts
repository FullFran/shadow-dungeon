import { describe, expect, it } from 'vitest';
import { signParts } from '../../src/ui/tutorial-sign';
import { TUTORIAL_HINTS, hintKey, type TutorialDevice } from '../../src/app/tutorial';
import { LANGUAGES, catalog } from '../../src/i18n';

// odd/tasks/menu-redesign.md T7: "hazlos mas bonitos": keys and buttons in [brackets] become carved keycaps.
describe('tutorial sign text', () => {
  it('splits [bracketed] keys from the words around them', () => {
    expect(signParts('[WASD] o [flechas] para moverte.')).toEqual([
      { key: true, text: 'WASD' },
      { key: false, text: ' o ' },
      { key: true, text: 'flechas' },
      { key: false, text: ' para moverte.' },
    ]);
    expect(signParts('Sin teclas.')).toEqual([{ key: false, text: 'Sin teclas.' }]);
  });

  it('every sign has a title and balanced brackets in both languages', () => {
    for (const language of LANGUAGES) {
      const texts = catalog(language);
      for (const hint of TUTORIAL_HINTS) {
        expect(texts[`tutorial.${hint}.title`], `${language} ${hint} title`).toBeTruthy();
        for (const device of ['keys', 'touch', 'pad'] as TutorialDevice[]) {
          const text = texts[hintKey(hint, device)]!;
          const opens = (text.match(/\[/g) ?? []).length;
          expect(opens, `${language} ${hint} ${device}`).toBe((text.match(/\]/g) ?? []).length);
          expect(signParts(text).map((p) => p.text).join(''), `${language} ${hint} ${device}`).not.toMatch(/[[\]]/);
        }
      }
      // Solo, a sign waits for a press and says how to go on, per device (odd/tasks/menu-redesign.md S13).
      for (const device of ['keys', 'touch', 'pad'] as TutorialDevice[]) {
        const line = texts[`tutorial.continue.${device}`];
        expect(line, `${language} continue ${device}`).toBeTruthy();
        expect(signParts(line!).map((p) => p.text).join('')).not.toMatch(/[[\]]/);
      }
    }
  });
});
