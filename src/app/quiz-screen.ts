import type { SheetStore } from '../adapters/assets';
import { answerQuiz, currentQuestion, quizDone, quizResult, startQuiz, undoAnswer, type QuizRun } from '../core/quiz';
import { STARTERS, type NatureId, type StarterId } from '../data/quiz';
import { SPECIES } from '../data/species';
import { t } from '../i18n';
import { ANSWER_ICONS, ONBOARDING_ICONS } from '../ui/icons/onboarding-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { portrait, typeBadge } from './loadout';
import { introLines, starterName } from './quiz-text';
import { nextFocus, questionView, quizKeyAction, revealView } from './quiz-view';
import '../styles/relic-controls.css';
import '../styles/sprite-fit.css';
import '../styles/onboarding.css';
import { deviceHint } from '../ui/device-hint';

/**
 * The personality questionnaire as onboarding (owner, 2026-11-04: "rediseñarse al completo acorde a lo que venimos
 * haciendo"): a voice, then one question per screen on a carved slab with the progress as a rail of oath runes and
 * the answers as large relic cards, each with its own pixel icon; then the walker's reveal on an altar. Scoring is
 * core/quiz.ts, untouched, and every question and answer text is the existing i18n. Keys: 1-3 pick, arrows move,
 * Enter acts, Esc or Backspace go back one step; the pad sends the same keys. Slides 180 ms between questions (none
 * under reduced motion). Every step reports its progress so a reload continues where the player was.
 */
export interface QuizProgress {
  step: 'quiz' | 'reveal';
  seed: number;
  picks: number[];
  /** The walker picked by hand on the reveal, else null. */
  starter: StarterId | null;
}

export interface QuizScreenOptions {
  seed: number;
  sheets: Promise<SheetStore>;
  touch: boolean;
  /** `onboarding`: the first run (the reveal ends in "Comenzar"); `retake`: from Settings (it ends in "Aceptar"). */
  mode: 'onboarding' | 'retake';
  /** Continue where a reload left off: the answers given and the hand-picked walker, if any. */
  resume?: { picks: readonly number[]; starter: StarterId | null };
  /** A fresh seed for "Repetir cuestionario". */
  newSeed(): number;
  onProgress?(progress: QuizProgress): void;
  onDone(starter: StarterId): void;
  /** Leaves the questionnaire from its first screen; absent in onboarding, where there is nowhere else to go. */
  onCancel?(): void;
}

type Dir = 'fwd' | 'back' | 'none';

export function quizScreen(options: QuizScreenOptions): { element: HTMLElement; dispose(): void } {
  let seed = options.seed;
  let run: QuizRun = startQuiz(seed);
  for (const pick of options.resume?.picks ?? []) if (!quizDone(run)) run = answerQuiz(run, pick);
  /** The answer just taken back, so stepping back shows what you had chosen (Error prevention). */
  let previous: number | null = null;
  let handPicked: StarterId | null = options.resume?.starter ?? null;
  /** What the keys do on the screen now. */
  let keys: (code: string) => boolean = () => false;
  let timer = 0;

  const stage = h('div', { className: 'ob-stage' });
  const rail = h('div', { className: 'ob-rail' });
  rail.setAttribute('role', 'group');
  const header = h('div', { className: 'ob-head' }, [h('p', { className: 'ob-kicker', textContent: t('quiz.title') }), rail]);
  const element = h('div', { className: 'ob ob-quiz-screen' }, [h('div', { className: 'ob-quiz' }, [header, stage])]);

  const progress = (step: QuizProgress['step']): void => options.onProgress?.({ step, seed, picks: [...run.picks], starter: handPicked });

  /** Swaps the screen with the 180 ms slide (instant under reduced motion, in the stylesheet). */
  function view(children: Node[], dir: Dir, railOn: boolean): HTMLElement {
    const el = h('div', { className: 'ob-view' }, children);
    if (dir !== 'none') el.dataset.dir = dir;
    stage.replaceChildren(el);
    header.hidden = !railOn;
    return el;
  }

  const backLink = (run_: () => void, label = t('menu.back')): HTMLButtonElement => {
    const el = h('button', { type: 'button', className: 'rk-link', textContent: label });
    el.addEventListener('click', run_);
    return el;
  };

  /** Focus once the screen is on the page (the first one is built before it is attached). */
  const focus = (el: HTMLElement | undefined): void => queueMicrotask(() => el?.focus({ preventScroll: true }));

  const hint = (key: string): HTMLElement => deviceHint('ob-hint', key);

  // ---- the voice
  function intro(dir: Dir = 'fwd'): void {
    const begin = h('button', { type: 'button', className: 'rk-btn rk-ember rk-wide' }, [h('span', { textContent: t('quiz.begin') })]);
    begin.addEventListener('click', () => ask('fwd'));
    const foot = options.onCancel ? [h('div', { className: 'ob-foot' }, [backLink(() => options.onCancel?.())])] : [];
    view([h('div', { className: 'ob-question-slab ob-slab' }, [h('div', { className: 'ob-voice' }, introLines().map((line) => h('p', { textContent: line }))), begin]), ...foot], dir, false);
    focus(begin);
    keys = (code) => {
      if (code === 'Escape' || code === 'Backspace') {
        options.onCancel?.();
        return !!options.onCancel;
      }
      return false;
    };
  }

  // ---- a question
  function ask(dir: Dir = 'fwd'): void {
    const question = currentQuestion(run);
    if (!question) return reveal('fwd');
    progress('quiz');
    const v = questionView(question, run.picks.length, run.questions.length);
    const cards = v.answers.map((answer, i) => {
      const el = h('button', { type: 'button', className: `ob-answer${previous === i ? ' is-prev' : ''}` }, [
        h('span', { className: 'ob-answer-key', textContent: String(answer.key) }),
        pixelSvgOf(ANSWER_ICONS[answer.icon]!, 'px-icon'),
        h('span', { className: 'ob-answer-text', textContent: answer.text }),
      ]);
      el.dataset.answer = String(i);
      el.addEventListener('click', () => {
        previous = null;
        run = answerQuiz(run, i);
        ask('fwd');
      });
      return el;
    });
    const stepBack = (): void => {
      if (run.picks.length === 0) return intro('back');
      previous = run.picks[run.picks.length - 1] ?? null;
      run = undoAnswer(run);
      ask('back');
    };
    const answers = h('div', { className: 'ob-answers' }, cards);
    answers.setAttribute('role', 'group');
    answers.setAttribute('aria-label', v.text);
    // The rail: lit runes for the answered, the one being asked marked, the rest waiting.
    rail.replaceChildren(
      h(
        'ol',
        { className: 'ob-runes' },
        v.runes.map((state, n) => {
          const li = h('li', { className: `ob-rune is-${state}` }, [pixelSvgOf(state === 'dim' ? ONBOARDING_ICONS.runeDim : ONBOARDING_ICONS.runeLit, 'px-icon')]);
          if (state === 'current') li.setAttribute('aria-current', 'step');
          li.setAttribute('aria-label', `${n + 1}`);
          return li;
        }),
      ),
      h('span', { className: 'ob-count', textContent: `${v.number} / ${v.total}` }),
    );
    rail.setAttribute('aria-label', t('onb.quiz.progress').replace('{n}', String(v.number)).replace('{total}', String(v.total)));
    view(
      [h('div', { className: 'ob-question-slab ob-slab' }, [h('h2', { className: 'ob-question', textContent: v.text }), answers]), h('div', { className: 'ob-foot' }, [backLink(stepBack), hint('onb.quiz.hint')])],
      dir,
      true,
    );
    const start = previous !== null && cards[previous] ? previous : 0;
    focus(cards[start]);
    keys = (code) => {
      const action = quizKeyAction(code, cards.length);
      if (!action) return false;
      const at = cards.indexOf(document.activeElement as HTMLButtonElement);
      if (action.kind === 'pick') cards[action.index]?.click();
      else if (action.kind === 'move') cards[nextFocus(at, cards.length, action.delta)]?.focus({ preventScroll: true });
      else if (action.kind === 'back') stepBack();
      else if (at >= 0) cards[at]!.click();
      else return false;
      return true;
    };
  }

  // ---- the reveal
  function reveal(dir: Dir = 'fwd'): void {
    let nature: NatureId | null = null;
    let starter: StarterId;
    if (handPicked) starter = handPicked;
    else {
      const result = quizResult(run.questions, run.picks);
      nature = result.nature;
      starter = result.starter;
    }
    progress('reveal');
    const v = revealView(starter, nature);
    const species = SPECIES[starter];
    rail.replaceChildren();
    const sprite = h('div', { className: 'ob-altar-sprite sprite-box' }, [portrait(options.sheets, starter, 4)]);
    const altar = h('div', { className: 'ob-altar' }, [h('div', { className: 'ob-altar-glow' }), embers(), sprite, h('div', { className: 'ob-altar-stone' }, [h('span', { className: 'ob-altar-rune' })])]);
    // The silhouette lights up a beat after arriving (instant under reduced motion).
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) altar.classList.add('is-lit');
    else {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => altar.classList.add('is-lit'), 450);
    }
    const start = h('button', { type: 'button', className: 'rk-btn rk-ember ob-start' }, [h('span', { textContent: t(options.mode === 'onboarding' ? 'onb.reveal.start' : 'quiz.accept') })]);
    start.addEventListener('click', () => options.onDone(starter));
    const retake = h('button', { type: 'button', className: 'rk-link', textContent: t('onb.reveal.retake') });
    retake.addEventListener('click', () => {
      seed = options.newSeed();
      run = startQuiz(seed);
      previous = null;
      handPicked = null;
      ask('back');
    });
    const choose = h('button', { type: 'button', className: 'rk-link', textContent: t('quiz.choose') });
    choose.addEventListener('click', () => pick(() => reveal('back')));
    const stepBack = (): void => {
      // A hand-picked walker goes back to the answers' own result (or to the questions when none were given); else to the last question.
      if (handPicked) {
        handPicked = null;
        return quizDone(run) ? reveal('back') : ask('back');
      }
      previous = run.picks[run.picks.length - 1] ?? null;
      run = undoAnswer(run);
      ask('back');
    };
    const who = h('div', { className: 'ob-who' }, [
      h('p', { className: 'ob-kicker', textContent: t('onb.reveal.kicker') }),
      h('h2', { className: 'ob-name', textContent: v.name }),
      h('div', { className: 'ob-types' }, species.types.map(typeBadge)),
      ...(v.nature ? [h('p', { className: 'ob-nature', textContent: v.nature })] : []),
      h('p', { className: 'ob-lore', textContent: v.lore }),
      h('div', { className: 'ob-actions' }, [start, h('div', { className: 'ob-quiet' }, [retake, choose, backLink(stepBack)])]),
    ]);
    const reveal_ = view([h('div', { className: 'ob-reveal' }, [altar, who])], dir, false);
    reveal_.setAttribute('aria-live', 'polite');
    focus(start);
    keys = (code) => {
      if (code === 'Escape' || code === 'Backspace') {
        stepBack();
        return true;
      }
      return false;
    };
  }

  /** Picking a walker by hand: the four starters as cards. */
  function pick(back: () => void): void {
    const cards = STARTERS.map((starter) => {
      const el = h('button', { type: 'button', className: 'ob-pick-card' }, [
        h('span', { className: 'ob-pick-art sprite-box' }, [portrait(options.sheets, starter, 3)]),
        h('strong', { textContent: starterName(starter) }),
        h('span', { className: 'ob-types' }, SPECIES[starter].types.map(typeBadge)),
      ]);
      el.addEventListener('click', () => {
        handPicked = starter;
        reveal('fwd');
      });
      return el;
    });
    const grid = h('div', { className: 'ob-pick-grid' }, cards);
    const done = view([h('div', { className: 'ob-pick ob-slab' }, [h('h2', { textContent: t('quiz.chooseTitle') }), grid, h('div', { className: 'ob-foot' }, [backLink(back)])])], 'fwd', false);
    done.setAttribute('aria-label', t('quiz.chooseTitle'));
    focus(cards[Math.max(0, STARTERS.indexOf(handPicked ?? STARTERS[0]!))]);
    keys = (code) => {
      if (code === 'Escape' || code === 'Backspace') {
        back();
        return true;
      }
      const delta = code === 'ArrowRight' || code === 'ArrowDown' ? 1 : code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 0;
      if (delta !== 0) {
        cards[nextFocus(cards.indexOf(document.activeElement as HTMLButtonElement), cards.length, delta)]?.focus({ preventScroll: true });
        return true;
      }
      const at = cards.indexOf(document.activeElement as HTMLButtonElement);
      if ((code === 'Enter' || code === 'Space') && at >= 0) {
        cards[at]!.click();
        return true;
      }
      return false;
    };
  }

  function onKey(e: KeyboardEvent): void {
    // The page moved on (show() replaced the screen): the listener leaves with it.
    if (!element.isConnected) return dispose();
    if (e.ctrlKey || e.altKey || e.metaKey || document.querySelector('.drawer-veil, .rc-veil, .town-shop')) return;
    if (keys(e.code)) return e.preventDefault();
    // A pad sends synthetic keys, which never click on their own: Enter on a focused button presses it.
    const on = document.activeElement;
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && on instanceof HTMLButtonElement && element.contains(on)) {
      e.preventDefault();
      on.click();
    }
  }
  function dispose(): void {
    window.removeEventListener('keydown', onKey);
    window.clearTimeout(timer);
  }
  window.addEventListener('keydown', onKey);

  // Where to start: a finished run or a hand-picked walker is the reveal; answers given are the next question; else the voice.
  if (handPicked || quizDone(run)) reveal('none');
  else if (run.picks.length > 0) ask('none');
  else intro('none');

  return { element, dispose };
}

/** A few ember points rising from the altar; their spread is fixed so a redraw never jumps. */
function embers(): HTMLElement {
  const layer = h('div', { className: 'ob-embers' });
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 14; i++) {
    const ember = h('span', { className: 'ob-ember' });
    ember.style.cssText = `--x:${8 + ((i * 37) % 84)}%;--s:${i % 3 === 0 ? 4 : 3}px;--d:${3.2 + (i % 5) * 0.7}s;--delay:${-((i * 0.9) % 4)}s;--drift:${((i * 13) % 40) - 20}px`;
    layer.append(ember);
  }
  return layer;
}
