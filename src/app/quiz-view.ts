import type { NatureId, QuizQuestion, StarterId } from '../data/quiz';
import { SPECIES } from '../data/species';
import type { PokemonType } from '../data/types';
import { t } from '../i18n';
import { answerIconId } from '../ui/icons/onboarding-icons';
import { resultText, starterName } from './quiz-text';

/**
 * The questionnaire without the page (src/app/quiz-screen.ts draws it): what one question screen shows (text,
 * numbered answers with their icon, the rune rail), what a key means, and what the reveal shows. Scoring stays in
 * core/quiz.ts, untouched; every question and answer text is the existing i18n.
 */
export type RuneState = 'lit' | 'current' | 'dim';

export interface AnswerView {
  /** The number key that picks it (1-based). */
  key: number;
  text: string;
  /** Key into `ANSWER_ICONS`. */
  icon: string;
}

export interface QuestionView {
  id: string;
  /** 1-based position and the total (the rail's real length). */
  number: number;
  total: number;
  text: string;
  answers: AnswerView[];
  runes: RuneState[];
}

/** The progress rail of oath runes: those answered are lit, the one being asked is marked, the rest wait dim. */
export function runeRail(total: number, answered: number): RuneState[] {
  return Array.from({ length: total }, (_, i) => (i < answered ? 'lit' : i === answered ? 'current' : 'dim'));
}

/** One question screen: `index` is how many answers were already given. */
export function questionView(question: QuizQuestion, index: number, total: number): QuestionView {
  return {
    id: question.id,
    number: index + 1,
    total,
    text: t(`quiz.q.${question.id}`),
    answers: question.answers.map((_, i) => ({ key: i + 1, text: t(`quiz.q.${question.id}.a${i + 1}`), icon: answerIconId(question.id, i) })),
    runes: runeRail(total, index),
  };
}

export type QuizKeyAction = { kind: 'pick'; index: number } | { kind: 'move'; delta: 1 | -1 } | { kind: 'back' } | { kind: 'confirm' };

/** What a key (`KeyboardEvent.code`) means on a question screen; the pad sends these same keys. */
export function quizKeyAction(code: string, answerCount: number): QuizKeyAction | null {
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(code);
  if (digit) {
    const index = Number(digit[1]) - 1;
    return index < answerCount ? { kind: 'pick', index } : null;
  }
  if (code === 'ArrowDown' || code === 'ArrowRight' || code === 'KeyS' || code === 'KeyD') return { kind: 'move', delta: 1 };
  if (code === 'ArrowUp' || code === 'ArrowLeft' || code === 'KeyW' || code === 'KeyA') return { kind: 'move', delta: -1 };
  if (code === 'Escape' || code === 'Backspace') return { kind: 'back' };
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') return { kind: 'confirm' };
  return null;
}

/** The card focus moves to: wraps round; from no focus, forward lands on the first and back on the last. */
export function nextFocus(current: number, count: number, delta: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return delta === 1 ? 0 : count - 1;
  return (current + delta + count) % count;
}

export interface RevealView {
  name: string;
  types: readonly PokemonType[];
  /** "Eres de naturaleza Rara…", empty for a walker picked by hand. */
  nature: string;
  /** The nature's description, or the line for a hand-picked walker. */
  lore: string;
}

/** The reveal's text: the walker, its types and a lore line (the nature's own description; a hand-picked walker has no nature). */
export function revealView(starter: StarterId, nature: NatureId | null): RevealView {
  const types = SPECIES[starter].types;
  if (!nature) return { name: starterName(starter), types, nature: '', lore: t('onb.reveal.chosen') };
  const text = resultText(nature, starter);
  return { name: starterName(starter), types, nature: text.nature, lore: text.description };
}
