import type { NatureId, QuizQuestion, StarterId } from '../data/quiz';
import { t } from '../i18n';

/** Localised text of the personality quiz (the data only holds ids). */

/** The voice in the dark, before the first question ("…¿Me oyes?"). */
export const introLines = (): string[] => [t('quiz.intro.1'), t('quiz.intro.2'), t('quiz.intro.3')];

export function questionText(question: QuizQuestion): { question: string; answers: string[] } {
  return { question: t(`quiz.q.${question.id}`), answers: [1, 2, 3].map((n) => t(`quiz.q.${question.id}.a${n}`)) };
}

export const starterName = (starter: StarterId): string => t(`quiz.starter.${starter}`);

/** "Eres de naturaleza Rara…", the nature's description, "¡Eres un Zorua!". */
export function resultText(nature: NatureId, starter: StarterId): { nature: string; description: string; species: string } {
  return {
    nature: t('quiz.result.nature').replace('{nature}', t(`quiz.nature.${nature}`)),
    description: t(`quiz.nature.${nature}.text`),
    species: t('quiz.result.species').replace('{species}', starterName(starter)),
  };
}
