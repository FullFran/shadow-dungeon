import { describe, expect, it } from 'vitest';
import { introLines, questionText, resultText } from '../../src/app/quiz-text';
import { NATURES, QUIZ_QUESTIONS, STARTERS } from '../../src/data/quiz';
import { catalog, LANGUAGES, setLanguage } from '../../src/i18n';

describe('quiz strings', () => {
  const keys = [
    ...QUIZ_QUESTIONS.flatMap((q) => [`quiz.q.${q.id}`, `quiz.q.${q.id}.a1`, `quiz.q.${q.id}.a2`, `quiz.q.${q.id}.a3`]),
    ...NATURES.flatMap((n) => [`quiz.nature.${n}`, `quiz.nature.${n}.text`]),
    ...STARTERS.map((s) => `quiz.starter.${s}`),
    'quiz.result.nature',
    'quiz.result.species',
    'quiz.title',
    'quiz.begin',
    'quiz.accept',
    'quiz.choose',
    'quiz.chooseTitle',
    'quiz.retake',
  ];
  for (const language of LANGUAGES) {
    it(`"${language}" has every question, answer, nature and starter`, () => {
      expect(keys.filter((key) => !(key in catalog(language)))).toEqual([]);
    });
  }
});

describe('quiz text', () => {
  it('opens with the voice asking "¿Me oyes?"', () => {
    setLanguage('es');
    expect(introLines()[0]).toMatch(/¿Me oyes\?/);
    setLanguage('en');
    expect(introLines()[0]).toMatch(/hear me\?/i);
  });

  it('reads the result as "Eres de naturaleza X… ¡Eres un Y!"', () => {
    setLanguage('es');
    const es = resultText('quirky', 'zorua');
    expect(es.nature).toBe('Eres de naturaleza Rara…');
    expect(es.species).toBe('¡Eres un Zorua!');
    expect(es.description.length).toBeGreaterThan(0);
    setLanguage('en');
    const en = resultText('brave', 'cubone');
    expect(en.nature).toBe('Your nature is Brave…');
    expect(en.species).toBe("You're a Cubone!");
  });

  it('gives a question with its three answers', () => {
    setLanguage('es');
    const q = questionText(QUIZ_QUESTIONS[0]!);
    expect(q.answers).toHaveLength(3);
    expect(q.question).not.toMatch(/^quiz\./);
  });
});
