import { answerQuiz, currentQuestion, quizResult, startQuiz, undoAnswer, type QuizRun } from '../core/quiz';
import { STARTERS, type StarterId } from '../data/quiz';
import { SPECIES } from '../data/species';
import { SPRITE_KEYS } from '../data/sprites';
import type { SheetStore } from '../adapters/assets';
import { idlePortrait } from '../adapters/portrait';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { introLines, questionText, resultText, starterName } from './quiz-text';

/**
 * The personality quiz screen: a black screen where a voice speaks
 * ("…¿Me oyes?"), then one MD-style window per question with a ▶ cursor list
 * of its three answers, each phase fading in slowly. The result shows the
 * nature, the starter's idle sprite and two choices: accept it or pick a
 * starter by hand. Esc takes the last answer back (on the first question and
 * the voice it leaves the quiz). All four starters are playable; the chosen
 * one becomes the `species` setting.
 */
export interface QuizScreenOptions {
  seed: number;
  sheets: Promise<SheetStore>;
  onDone(starter: StarterId): void;
  onCancel(): void;
}

/** Sprite folder of a starter: from its species data when it exists, else a sprite key named after it. */
function starterSprite(starter: StarterId): string | null {
  const species = (SPECIES as Partial<Record<string, { sprite: string }>>)[starter];
  return (SPRITE_KEYS as Record<string, string>)[species?.sprite ?? starter] ?? null;
}

export function quizScreen(options: QuizScreenOptions): HTMLElement[] {
  const stage = h('div', { className: 'quiz-stage' });
  let run: QuizRun = startQuiz(options.seed);

  const phase = (children: (Node | null)[]) => stage.replaceChildren(h('div', { className: 'quiz-phase' }, children));

  const intro = () =>
    phase([
      h('div', { className: 'quiz-voice' }, introLines().map((line) => h('p', { textContent: line }))),
      mdWindow({ className: 'narrow' }, [cursorList({ items: [{ label: t('quiz.begin'), onConfirm: ask }], onBack: options.onCancel, label: t('quiz.title') }).element]),
    ]);

  function ask(): void {
    const question = currentQuestion(run);
    if (!question) return result();
    const text = questionText(question);
    const list = cursorList({
      label: text.question,
      items: text.answers.map((answer, i) => ({
        label: answer,
        onConfirm: () => {
          run = answerQuiz(run, i);
          ask();
        },
      })),
      onBack: () => {
        if (run.picks.length === 0) return intro();
        run = undoAnswer(run);
        ask();
      },
    });
    phase([
      h('p', { className: 'quiz-count', textContent: `${run.picks.length + 1} / ${run.questions.length}` }),
      mdWindow({ className: 'quiz-window' }, [h('p', { className: 'quiz-question', textContent: text.question }), list.element]),
    ]);
  }

  function result(): void {
    const { nature, starter } = quizResult(run.questions, run.picks);
    const text = resultText(nature, starter);
    show(starter, [h('p', { textContent: text.nature }), h('p', { className: 'dim', textContent: text.description })], text.species, () => {
      run = undoAnswer(run);
      ask();
    });
  }

  /** The result (or a hand-picked starter) with its sprite, Accept and Choose. */
  function show(starter: StarterId, lines: HTMLElement[], species: string, back: () => void): void {
    phase([
      mdWindow({ className: 'quiz-result' }, [
        ...lines,
        h('div', { className: 'quiz-portrait portrait-frame' }, [idlePortrait(starterSprite(starter), options.sheets)]),
        h('p', { className: 'quiz-species', textContent: species }),
        cursorList({
          items: [
            { label: t('quiz.accept'), className: 'start-row', onConfirm: () => options.onDone(starter) },
            { label: t('quiz.choose'), onConfirm: () => choose(() => show(starter, lines, species, back)) },
          ],
          onBack: back,
          label: t('quiz.title'),
        }).element,
      ]),
    ]);
  }

  /** Picking a starter by hand. */
  function choose(back: () => void): void {
    phase([
      mdWindow({ title: t('quiz.chooseTitle'), className: 'narrow' }, [
        cursorList({
          items: STARTERS.map((starter) => ({
            label: starterName(starter),
            onConfirm: () => show(starter, [], t('quiz.result.species').replace('{species}', starterName(starter)), () => choose(back)),
          })),
          onBack: back,
          label: t('quiz.chooseTitle'),
        }).element,
      ]),
    ]);
  }

  intro();
  return [h('div', { className: 'quiz-black' }), stage];
}
