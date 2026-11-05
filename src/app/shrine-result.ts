import type { BossStop } from '../core/shrine';
import type { Difficulty } from '../data/difficulty';
import type { SpeciesId } from '../data/species';
import { coinText } from './coin-lines';
import type { EndCard, EndDelta, EndLine, EndView } from './end-model';

/**
 * The shrine's result screen as data (owner, 2026-11-04), pure: the outcome, the boss to draw,
 * the time against the previous best, the Pokémonedas and the (at most two) actions.
 */
export interface ResultInput {
  request: { kind: 'boss' | 'gauntlet' | 'herald'; id: string; stops: readonly BossStop[]; difficulty: Difficulty };
  victory: boolean;
  trial: { stops: readonly BossStop[]; beaten: number; ms: number; captures: number; noHit: boolean };
  /** The best before this trial on its tier (null: none). */
  before: { bestMs: number } | null;
  coins: number;
  balance: number;
  /** The flow offers a retry (an online room goes back to its town instead). */
  canRetry: boolean;
}

export interface ResultModel {
  outcome: 'victory' | 'defeat';
  /** The creature shown: the boss, the herald, or the last stop of a gauntlet. */
  species: SpeciesId;
  difficulty: Difficulty;
  timeMs: number;
  /** A win that is the first record on the tier or faster than the previous one. */
  newBest: boolean;
  previousMs: number | null;
  /** How much faster than the previous best (null unless a new best beat one). */
  gainMs: number | null;
  /** This win's time minus the previous best (negative: faster; null for a defeat or a first clear). */
  deltaMs: number | null;
  captures: number;
  noHit: boolean;
  /** Bosses beaten of the stops (null for a single boss). */
  progress: { beaten: number; total: number } | null;
  reward: { coins: number; balance: number } | null;
  /** The primary first; at most two (Hick). */
  actions: ('back' | 'retry')[];
}

export function resultModel(input: ResultInput): ResultModel {
  const { request, victory, trial, before } = input;
  const previousMs = before?.bestMs ?? null;
  const newBest = victory && (previousMs === null || trial.ms < previousMs);
  return {
    outcome: victory ? 'victory' : 'defeat',
    species: request.stops[request.stops.length - 1]!.boss,
    difficulty: request.difficulty,
    timeMs: trial.ms,
    newBest,
    previousMs,
    gainMs: newBest && previousMs !== null ? previousMs - trial.ms : null,
    deltaMs: victory && previousMs !== null ? trial.ms - previousMs : null,
    captures: trial.captures,
    noHit: victory && trial.noHit,
    progress: trial.stops.length > 1 ? { beaten: trial.beaten, total: trial.stops.length } : null,
    reward: input.coins > 0 ? { coins: input.coins, balance: input.balance } : null,
    actions: input.canRetry ? ['back', 'retry'] : ['back'],
  };
}

/** The keys the result view reads besides the boss and gauntlet names (a test checks both languages). */
export const SHRINE_RESULT_KEYS = [
  'shrine.title',
  'shrine.won',
  'shrine.lost',
  'shrine.time',
  'shrine.newBest',
  'shrine.back',
  'shrine.room.back',
  'shrine.best',
  'shrine.beaten',
  'shrine.captures',
  'shrine.noHit',
  'shrine.reward',
  'shrine.result.previous',
  'shrine.result.first',
  'shrine.result.faster',
  'shrine.result.slower',
  'shrine.record',
  'hud.coins',
  'screen.retry',
  'screen.coins.balance',
  'difficulty.label',
] as const;

/** «+16.7 s» (slower, red) or «−16.7 s» (faster, green) against the previous best, in seconds with a decimal. */
export function timeDelta(deltaMs: number, tr: (key: string) => string): EndDelta {
  const seconds = `${(Math.abs(deltaMs) / 1000).toFixed(1)} s`;
  if (Math.round(deltaMs / 100) === 0) return { tone: 'even', text: '0.0 s', caption: seconds };
  if (deltaMs < 0) return { tone: 'faster', text: `−${seconds}`, caption: tr('shrine.result.faster').replace('{time}', seconds) };
  return { tone: 'slower', text: `+${seconds}`, caption: tr('shrine.result.slower').replace('{time}', seconds) };
}

/** The result as an end view (the shared relic end screen): the record card, the reward card and at most two actions. */
export function shrineEndView(input: ResultInput, name: string, tr: (key: string) => string, time: (ms: number) => string): EndView {
  const m = resultModel(input);
  const best = m.newBest ? tr(m.previousMs === null ? 'shrine.result.first' : 'shrine.newBest') : null;
  const timeLine: EndLine = { label: tr('shrine.time'), value: time(m.timeMs), icon: 'clock', ...(best ? { tone: 'best' as const, badge: best } : {}), ...(m.deltaMs !== null ? { delta: timeDelta(m.deltaMs, tr) } : {}) };
  const lines: EndLine[] = [
    timeLine,
    ...(m.previousMs !== null ? [{ label: tr('shrine.result.previous'), value: time(m.previousMs), icon: 'crown' as const }] : []),
    { label: tr('difficulty.label'), value: tr(`difficulty.${m.difficulty}`), icon: 'skull' },
    { label: tr('shrine.captures'), value: String(m.captures), icon: 'card' },
    ...(m.progress ? [{ label: tr('shrine.beaten'), value: `${m.progress.beaten}/${m.progress.total}`, icon: 'sword' as const }] : []),
    ...(m.noHit ? [{ label: tr('shrine.noHit'), value: '✓', icon: 'shield' as const }] : []),
  ];
  const cards: EndCard[] = [{ id: 'record', title: tr('shrine.record'), lines }];
  if (m.reward) {
    cards.push({
      id: 'reward',
      title: tr('shrine.reward'),
      lines: [
        { label: tr('shrine.reward'), value: coinText(m.reward.coins, tr), tone: 'coin', icon: 'coin', amount: m.reward.coins },
        { label: tr('screen.coins.balance'), value: coinText(m.reward.balance, tr), tone: 'balance', icon: 'coin', amount: m.reward.balance },
      ],
    });
  }
  const back = { id: 'back' as const, label: tr(input.canRetry ? 'shrine.back' : 'shrine.room.back') };
  return { outcome: m.outcome, title: tr(m.outcome === 'victory' ? 'shrine.won' : 'shrine.lost'), subtitle: `${name} · ${tr(`difficulty.${m.difficulty}`)}`, notes: [], species: m.species, cards, seal: best, actions: m.actions.includes('retry') ? [back, { id: 'retry' as const, label: tr('screen.retry') }] : [back] };
}
