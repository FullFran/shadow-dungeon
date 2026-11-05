import { describe, expect, it } from 'vitest';
import { answerQuiz, pickQuestions, quizDone, quizResult, startQuiz } from '../../src/core/quiz';
import { nextFocus, questionView, quizKeyAction, revealView, runeRail } from '../../src/app/quiz-view';
import { NATURES, NATURE_STARTER, QUIZ_LENGTH, QUIZ_QUESTIONS, STARTERS } from '../../src/data/quiz';
import { SPECIES } from '../../src/data/species';
import { LANGUAGES, setLanguage, t } from '../../src/i18n';
import { ANSWER_ICONS } from '../../src/ui/icons/onboarding-icons';

describe('questionView: every question and answer renders with an icon, in every language', () => {
  for (const language of LANGUAGES) {
    it(`"${language}": text, key and icon for all ${QUIZ_QUESTIONS.length} questions`, () => {
      setLanguage(language);
      for (const question of QUIZ_QUESTIONS) {
        const view = questionView(question, 0, QUIZ_LENGTH);
        expect(view.text, question.id).toBe(t(`quiz.q.${question.id}`));
        expect(view.text.length, question.id).toBeGreaterThan(10);
        expect(view.answers).toHaveLength(question.answers.length);
        view.answers.forEach((answer, i) => {
          expect(answer.key, question.id).toBe(i + 1);
          expect(answer.text, `${question.id}.a${i + 1}`).toBe(t(`quiz.q.${question.id}.a${i + 1}`));
          expect(answer.text.length).toBeGreaterThan(3);
          expect(ANSWER_ICONS[answer.icon], `${question.id}.a${i + 1} icon`).toBeTruthy();
        });
      }
      setLanguage('es');
    });
  }

  it('answer cards are 2 to 4 per question and every icon is used once', () => {
    const used = new Set<string>();
    for (const question of QUIZ_QUESTIONS) {
      const view = questionView(question, 2, QUIZ_LENGTH);
      expect(view.answers.length).toBeGreaterThanOrEqual(2);
      expect(view.answers.length).toBeLessThanOrEqual(4);
      for (const answer of view.answers) used.add(answer.icon);
    }
    expect(used.size).toBe(QUIZ_QUESTIONS.length * 3);
  });
});

describe('rune rail (Goal-Gradient, honest)', () => {
  it('lights the answered runes, marks the current one and leaves the rest dim', () => {
    expect(runeRail(6, 0)).toEqual(['current', 'dim', 'dim', 'dim', 'dim', 'dim']);
    expect(runeRail(6, 2)).toEqual(['lit', 'lit', 'current', 'dim', 'dim', 'dim']);
    expect(runeRail(6, 6)).toEqual(['lit', 'lit', 'lit', 'lit', 'lit', 'lit']);
  });

  it('the view numbers the question and counts the runes left', () => {
    const view = questionView(QUIZ_QUESTIONS[0]!, 3, QUIZ_LENGTH);
    expect(view.number).toBe(4);
    expect(view.total).toBe(QUIZ_LENGTH);
    expect(view.runes.filter((r) => r === 'lit')).toHaveLength(3);
    expect(view.runes.filter((r) => r === 'dim')).toHaveLength(QUIZ_LENGTH - 4);
  });
});

describe('keys', () => {
  it('1-4 pick an answer that exists; arrows and WASD move; Esc and Backspace go back; Enter confirms', () => {
    expect(quizKeyAction('Digit1', 3)).toEqual({ kind: 'pick', index: 0 });
    expect(quizKeyAction('Numpad3', 3)).toEqual({ kind: 'pick', index: 2 });
    expect(quizKeyAction('Digit4', 3)).toBeNull();
    expect(quizKeyAction('ArrowDown', 3)).toEqual({ kind: 'move', delta: 1 });
    expect(quizKeyAction('KeyW', 3)).toEqual({ kind: 'move', delta: -1 });
    expect(quizKeyAction('Escape', 3)).toEqual({ kind: 'back' });
    expect(quizKeyAction('Backspace', 3)).toEqual({ kind: 'back' });
    expect(quizKeyAction('Enter', 3)).toEqual({ kind: 'confirm' });
    expect(quizKeyAction('KeyQ', 3)).toBeNull();
  });

  it('focus wraps round the cards', () => {
    expect(nextFocus(0, 3, -1)).toBe(2);
    expect(nextFocus(2, 3, 1)).toBe(0);
    expect(nextFocus(-1, 3, 1)).toBe(0);
    expect(nextFocus(-1, 3, -1)).toBe(2);
  });
});

describe('scoring is unchanged', () => {
  const questions = pickQuestions(7);
  it('seed 7 picks the same six questions in the same order', () => {
    expect(questions.map((q) => q.id)).toEqual(['storm', 'voice', 'mask', 'friend', 'mirror', 'keepsake']);
  });

  it('fixed answer paths give the same nature and walker', () => {
    const outcome = (picks: number[]) => {
      const r = quizResult(questions, picks);
      return `${r.nature}/${r.starter}`;
    };
    expect(outcome([0, 0, 0, 0, 0, 0])).toBe('hardy/cubone');
    expect(outcome([1, 1, 1, 1, 1, 1])).toBe('timid/mimikyu');
    expect(outcome([2, 2, 2, 2, 2, 2])).toBe('lonely/mimikyu');
    expect(outcome([0, 1, 2, 0, 1, 2])).toBe('timid/mimikyu');
  });

  it('the distribution over all 3^6 answer paths of seed 7 is the same', () => {
    const counts: Record<string, number> = {};
    for (let n = 0; n < 3 ** questions.length; n++) {
      const picks = questions.map((_, i) => Math.floor(n / 3 ** i) % 3);
      const { starter } = quizResult(questions, picks);
      counts[starter] = (counts[starter] ?? 0) + 1;
    }
    expect(counts).toEqual({ cubone: 170, zorua: 238, mimikyu: 187, litwick: 134 });
  });

  it('answering through the run reaches the same result as scoring the picks directly', () => {
    let run = startQuiz(7);
    for (const pick of [2, 0, 1, 1, 0, 2]) run = answerQuiz(run, pick);
    expect(quizDone(run)).toBe(true);
    expect(quizResult(run.questions, run.picks).nature).toBe(quizResult(questions, [2, 0, 1, 1, 0, 2]).nature);
  });
});

describe('revealView', () => {
  for (const language of LANGUAGES) {
    it(`"${language}": every nature shows its walker, types and lore line`, () => {
      setLanguage(language);
      for (const nature of NATURES) {
        const starter = NATURE_STARTER[nature];
        const view = revealView(starter, nature);
        expect(view.name).toBe(t(`quiz.starter.${starter}`));
        expect(view.types).toEqual(SPECIES[starter].types);
        expect(view.nature).toBe(t('quiz.result.nature').replace('{nature}', t(`quiz.nature.${nature}`)));
        expect(view.lore).toBe(t(`quiz.nature.${nature}.text`));
      }
      setLanguage('es');
    });
  }

  it('a hand-picked walker has no nature line, only its own', () => {
    for (const starter of STARTERS) {
      const view = revealView(starter, null);
      expect(view.nature).toBe('');
      expect(view.lore).toBe(t('onb.reveal.chosen'));
      expect(view.types.length).toBeGreaterThan(0);
    }
  });
});
