import { describe, expect, it } from 'vitest';
import { answerQuiz, currentQuestion, natureOf, pickQuestions, quizDone, quizResult, scoreAnswers, startQuiz, starterOf, undoAnswer } from '../../src/core/quiz';
import { NATURE_STARTER, NATURES, QUIZ_LENGTH, QUIZ_QUESTIONS, STARTERS, type NatureId, type QuizAnswer } from '../../src/data/quiz';

const answer = (points: Partial<Record<NatureId, number>>): QuizAnswer => ({ points });

describe('quiz data', () => {
  it('has 8 questions with 3 answers each and unique ids', () => {
    expect(QUIZ_QUESTIONS).toHaveLength(8);
    for (const q of QUIZ_QUESTIONS) expect(q.answers).toHaveLength(3);
    expect(new Set(QUIZ_QUESTIONS.map((q) => q.id)).size).toBe(QUIZ_QUESTIONS.length);
  });

  it('asks 6 questions per run, within the 5-6 range', () => {
    expect(QUIZ_LENGTH).toBeGreaterThanOrEqual(5);
    expect(QUIZ_LENGTH).toBeLessThanOrEqual(6);
  });

  it('gives every nature the same number of main (2-point) answers', () => {
    const main = Object.fromEntries(NATURES.map((n) => [n, 0])) as Record<NatureId, number>;
    for (const q of QUIZ_QUESTIONS) for (const a of q.answers) for (const [n, p] of Object.entries(a.points)) if (p === 2) main[n as NatureId]++;
    expect(new Set(Object.values(main)).size).toBe(1);
  });

  it('maps several natures to each starter and every nature to a starter', () => {
    for (const n of NATURES) expect(STARTERS).toContain(NATURE_STARTER[n]);
    for (const s of STARTERS) expect(NATURES.filter((n) => NATURE_STARTER[n] === s).length).toBeGreaterThanOrEqual(2);
  });
});

describe('pickQuestions', () => {
  it('is deterministic for a seed and picks distinct questions from the pool', () => {
    const a = pickQuestions(42);
    expect(pickQuestions(42).map((q) => q.id)).toEqual(a.map((q) => q.id));
    expect(a).toHaveLength(QUIZ_LENGTH);
    expect(new Set(a.map((q) => q.id)).size).toBe(QUIZ_LENGTH);
    for (const q of a) expect(QUIZ_QUESTIONS).toContain(q);
  });

  it('varies with the seed', () => {
    const runs = new Set(Array.from({ length: 20 }, (_, seed) => pickQuestions(seed).map((q) => q.id).join(',')));
    expect(runs.size).toBeGreaterThan(1);
  });

  it('clamps the count to the pool size', () => {
    expect(pickQuestions(1, QUIZ_QUESTIONS, 99)).toHaveLength(QUIZ_QUESTIONS.length);
  });
});

describe('scoring', () => {
  it('adds the points of every answer per nature', () => {
    const scores = scoreAnswers([answer({ brave: 2, hardy: 1 }), answer({ brave: 2, calm: 1 })]);
    expect(scores.brave).toBe(4);
    expect(scores.hardy).toBe(1);
    expect(scores.calm).toBe(1);
    expect(scores.timid).toBe(0);
  });

  it('picks the nature with the most points', () => {
    expect(natureOf([answer({ timid: 2 }), answer({ timid: 2, brave: 1 }), answer({ brave: 2 })])).toBe('timid');
  });

  it('breaks a tie with the latest answer that scored a tied nature', () => {
    expect(natureOf([answer({ brave: 2 }), answer({ calm: 2 })])).toBe('calm');
    expect(natureOf([answer({ calm: 2 }), answer({ brave: 2 })])).toBe('brave');
    // The latest answer favours its main nature among the tied ones.
    expect(natureOf([answer({ sassy: 2, jolly: 1 }), answer({ jolly: 2, sassy: 1 })])).toBe('jolly');
  });

  it('falls back to the nature list order with no answers', () => {
    expect(natureOf([])).toBe(NATURES[0]);
  });
});

describe('quizResult', () => {
  it('turns the picked answers into a nature and its starter', () => {
    const questions = pickQuestions(7);
    const picks = questions.map(() => 0);
    const result = quizResult(questions, picks);
    expect(result.nature).toBe(natureOf(questions.map((q) => q.answers[0]!)));
    expect(result.starter).toBe(starterOf(result.nature));
  });

  it('rejects out-of-range picks', () => {
    const questions = pickQuestions(7);
    expect(() => quizResult(questions, questions.map(() => 3))).toThrow();
  });

  it('can reach every nature and every starter', () => {
    const reached = new Set<NatureId>();
    for (let seed = 0; seed < 50; seed++) {
      const questions = pickQuestions(seed);
      for (let choice = 0; choice < 3; choice++) reached.add(quizResult(questions, questions.map(() => choice)).nature);
      // Each question's own main nature, answered everywhere it appears.
      for (const nature of NATURES) {
        const picks = questions.map((q) => Math.max(0, q.answers.findIndex((a) => a.points[nature] === 2)));
        reached.add(quizResult(questions, picks).nature);
      }
    }
    expect([...reached].sort()).toEqual([...NATURES].sort());
    expect(new Set([...reached].map(starterOf)).size).toBe(STARTERS.length);
  });
});

describe('a quiz run', () => {
  it('walks the seeded questions one answer at a time', () => {
    let run = startQuiz(3);
    expect(run.questions.map((q) => q.id)).toEqual(pickQuestions(3).map((q) => q.id));
    expect(currentQuestion(run)).toBe(run.questions[0]);
    run = answerQuiz(run, 2);
    expect(run.picks).toEqual([2]);
    expect(currentQuestion(run)).toBe(run.questions[1]);
    run = undoAnswer(run);
    expect(run.picks).toEqual([]);
    expect(undoAnswer(run).picks).toEqual([]);
  });

  it('ends after the last question and refuses more answers', () => {
    let run = startQuiz(3);
    while (!quizDone(run)) run = answerQuiz(run, 1);
    expect(run.picks).toHaveLength(QUIZ_LENGTH);
    expect(currentQuestion(run)).toBeNull();
    expect(() => answerQuiz(run, 0)).toThrow();
    expect(quizResult(run.questions, run.picks).starter).toBeDefined();
  });

  it('rejects an answer outside 0..2', () => {
    expect(() => answerQuiz(startQuiz(1), 3)).toThrow();
    expect(() => answerQuiz(startQuiz(1), -1)).toThrow();
  });
});
