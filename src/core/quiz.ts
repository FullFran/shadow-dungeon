import { NATURE_STARTER, NATURES, QUIZ_LENGTH, QUIZ_QUESTIONS, type NatureId, type QuizAnswer, type QuizQuestion, type StarterId } from '../data/quiz';
import { nextRandom, seedRng } from './rng';

/**
 * Personality quiz rules, pure: seeded question picks, nature scoring with a
 * deterministic tie-break, and the nature -> starter mapping.
 */

/** `count` distinct questions from `pool` in a seeded random order (Fisher-Yates over mulberry32). */
export function pickQuestions(seed: number, pool: readonly QuizQuestion[] = QUIZ_QUESTIONS, count = QUIZ_LENGTH): QuizQuestion[] {
  const order = [...pool];
  let state = seedRng(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const roll = nextRandom(state);
    state = roll.state;
    const j = Math.floor(roll.value * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order.slice(0, Math.max(0, Math.min(count, order.length)));
}

export function scoreAnswers(answers: readonly QuizAnswer[]): Record<NatureId, number> {
  const scores = Object.fromEntries(NATURES.map((n) => [n, 0])) as Record<NatureId, number>;
  for (const answer of answers) for (const nature of NATURES) scores[nature] += answer.points[nature] ?? 0;
  return scores;
}

/**
 * The nature with the most points. A tie goes to the latest answer that
 * scored one of the tied natures (the one it scored highest; list order
 * if equal), so the last thing you said weighs most. No answers: the first
 * nature of the list.
 */
export function natureOf(answers: readonly QuizAnswer[]): NatureId {
  const scores = scoreAnswers(answers);
  const best = Math.max(...NATURES.map((n) => scores[n]));
  const tied = NATURES.filter((n) => scores[n] === best);
  if (tied.length === 1) return tied[0]!;
  for (let i = answers.length - 1; i >= 0; i--) {
    const points = answers[i]!.points;
    let pick: NatureId | null = null;
    for (const nature of tied) if ((points[nature] ?? 0) > 0 && (pick === null || points[nature]! > points[pick]!)) pick = nature;
    if (pick) return pick;
  }
  return tied[0]!;
}

export const starterOf = (nature: NatureId): StarterId => NATURE_STARTER[nature];

export interface QuizResult {
  nature: NatureId;
  starter: StarterId;
  scores: Record<NatureId, number>;
}

/** The result of answering `questions` with `picks` (answer index 0..2 per question). */
export function quizResult(questions: readonly QuizQuestion[], picks: readonly number[]): QuizResult {
  const answers = questions.map((q, i) => {
    const answer = q.answers[picks[i] ?? -1];
    if (!answer) throw new RangeError(`quiz: no answer ${picks[i]} for question ${q.id}`);
    return answer;
  });
  const nature = natureOf(answers);
  return { nature, starter: starterOf(nature), scores: scoreAnswers(answers) };
}
