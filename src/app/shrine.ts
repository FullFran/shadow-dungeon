import { gauntletStops, heraldStop, SHRINE_BOSSES, type BossStop } from '../core/shrine';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { dungeonById } from '../data/dungeons';
import { GAUNTLETS, type GauntletId } from '../data/shrine';
import { t } from '../i18n';
import type { BestiaryEntry } from '../town/bestiary';
import { gauntletReward, gauntletUnlocked, trialBest, type ShrineRecords, type TrialBest } from '../town/shrine-records';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import type { TrialSummary } from './game';

/**
 * Santuario de los Juramentos (docs/gdd.md §3): the shrine window and its
 * result screen. «Reflejos» lists the bosses beaten on this device (and the
 * heralds met, by seed); «Desafíos» the gauntlets, locked until every boss
 * of one fell. A tier row on top picks any tier. Solo only.
 */
export interface TrialRequest {
  kind: 'boss' | 'gauntlet' | 'herald';
  /** Boss species, gauntlet id, or the herald's seed as text. */
  id: string;
  stops: readonly BossStop[];
  difficulty: Difficulty;
}

export type ShrineView = 'main' | 'reflections' | 'gauntlets' | 'heralds';

export interface ShrineOptions {
  shrine: ShrineRecords;
  beaten: ReadonlySet<string>;
  heralds: readonly BestiaryEntry[];
  difficulty: Difficulty;
  /** The tier row changed (remembered as the player's tier). */
  onTier?(d: Difficulty): void;
  onFight(request: TrialRequest): void;
  onBack(): void;
  view?: ShrineView;
}

/** "1:23.4" (minutes, seconds and tenths); "-" for none. */
export function trialTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return '-';
  const tenths = Math.floor(ms / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

/** The herald entries: the last met first, at most `max`. */
export const heraldEntries = (heralds: readonly BestiaryEntry[], max = 8): BestiaryEntry[] => [...heralds].reverse().slice(0, max);

const bossName = (boss: string): string => t(`species.${boss}`);
const gauntletName = (id: GauntletId): string => t(`shrine.gauntlet.${id}`);

/** "1:23.4 · ✦3" (time and captures) for a best, "-" before the first clear. */
function bestText(best: TrialBest | null): string {
  if (!best) return '-';
  return `${trialTime(best.bestMs)} · ✦${best.captures}`;
}

const MAX_HERALDS = 8;

export function shrineWindow(options: ShrineOptions): { element: HTMLElement; dispose(): void } {
  let view: ShrineView = options.view ?? 'main';
  let tier = options.difficulty;
  const about = h('div', { className: 'shrine-about' });
  const lines = (...nodes: (Node | string)[]) => about.replaceChildren(...nodes.map((n) => (typeof n === 'string' ? h('p', { textContent: n }) : n)));
  const reflections = SHRINE_BOSSES.filter((b) => options.beaten.has(b.boss));

  const tierRow = (): ListItem => ({
    label: t('difficulty.label'),
    value: t(`difficulty.${tier}`),
    onAdjust: (delta) => {
      tier = DIFFICULTIES[(DIFFICULTIES.indexOf(tier) + delta + DIFFICULTIES.length) % DIFFICULTIES.length]!;
      options.onTier?.(tier);
      refresh();
    },
    onConfirm: () => {
      tier = DIFFICULTIES[(DIFFICULTIES.indexOf(tier) + 1) % DIFFICULTIES.length]!;
      options.onTier?.(tier);
      refresh();
    },
  });
  const back = (to: ShrineView | null): ListItem => ({ label: t('menu.back'), onConfirm: () => (to ? go(to) : options.onBack()) });
  const fight = (kind: TrialRequest['kind'], id: string, stops: readonly BossStop[]) => options.onFight({ kind, id, stops, difficulty: tier });

  /** One description per row of the current view (index-aligned with `items()`). */
  let describeRow: (() => void)[] = [];

  function items(): ListItem[] {
    if (view === 'main') {
      const open = GAUNTLETS.filter((g) => gauntletUnlocked(g.id, options.beaten)).length;
      describeRow = [
        () => lines(t('shrine.reflections.text'), t('shrine.count').replace('{open}', String(reflections.length)).replace('{total}', String(SHRINE_BOSSES.length))),
        () => lines(t('shrine.gauntlets.text'), t('shrine.gauntlets.open').replace('{open}', String(open)).replace('{total}', String(GAUNTLETS.length))),
        () => lines(t('shrine.text')),
      ];
      return [
        { label: t('shrine.reflections'), value: `${reflections.length}/${SHRINE_BOSSES.length}`, disabled: reflections.length === 0 && options.heralds.length === 0, onConfirm: () => go('reflections') },
        { label: t('shrine.gauntlets'), value: `${open}/${GAUNTLETS.length}`, onConfirm: () => go('gauntlets') },
        back(null),
      ];
    }
    if (view === 'reflections') {
      const rows: ListItem[] = SHRINE_BOSSES.map((stop) => {
        const known = options.beaten.has(stop.boss);
        return { label: known ? bossName(stop.boss) : '???', value: known ? trialTime(trialBest(options.shrine, 'boss', stop.boss, tier)?.bestMs) : '', disabled: !known, onConfirm: () => fight('boss', stop.boss, [stop]) };
      });
      describeRow = [
        () => lines(t(`difficulty.${tier}.hint`)),
        ...SHRINE_BOSSES.map((stop) => () => {
          const best = trialBest(options.shrine, 'boss', stop.boss, tier);
          lines(
            t(`shrine.role.${stop.role}`).replace('{dungeon}', t(dungeonById(stop.dungeon).lore.nameKey)),
            statLine(t('shrine.best'), bestText(best)),
            statLine(t('shrine.clears'), String(best?.clears ?? 0)),
            statLine(t('shrine.noHit'), best?.noHit ? '✓' : '-'),
          );
        }),
        ...(options.heralds.length > 0 ? [() => lines(t('shrine.heralds.text'))] : []),
        () => lines(t('shrine.reflections.text')),
      ];
      return [
        tierRow(),
        ...rows,
        ...(options.heralds.length > 0 ? [{ label: t('shrine.heralds'), value: String(options.heralds.length), onConfirm: () => go('heralds') }] : []),
        back('main'),
      ];
    }
    if (view === 'heralds') {
      const met = heraldEntries(options.heralds, MAX_HERALDS);
      describeRow = [() => lines(t(`difficulty.${tier}.hint`)), ...met.map((e) => () => lines(t('shrine.herald.seed').replace('{seed}', String(e.seed)))), () => lines(t('shrine.heralds.text'))];
      return [tierRow(), ...met.map((e): ListItem => ({ label: e.name, onConfirm: () => fight('herald', String(e.seed), [heraldStop(e.seed)]) })), back('reflections')];
    }
    describeRow = [
      () => lines(t(`difficulty.${tier}.hint`)),
      ...GAUNTLETS.map((g) => () => {
        const unlocked = gauntletUnlocked(g.id, options.beaten);
        const best = trialBest(options.shrine, 'gauntlet', g.id, tier);
        const missing = g.bosses.filter((b) => !options.beaten.has(b));
        lines(
          unlocked ? g.bosses.map(bossName).join(' → ') : t('shrine.locked').replace('{count}', String(missing.length)),
          statLine(t('shrine.best'), bestText(best)),
          statLine(t('shrine.noHit'), best?.noHit ? '✓' : '-'),
          statLine(t('shrine.reward'), best ? t('shrine.reward.taken') : coinText(gauntletReward(g.id, tier), (key) => t(key))),
          t('shrine.carry'),
        );
      }),
      () => lines(t('shrine.gauntlets.text')),
    ];
    return [
      tierRow(),
      ...GAUNTLETS.map((g): ListItem => {
        const unlocked = gauntletUnlocked(g.id, options.beaten);
        return { label: unlocked ? gauntletName(g.id) : `${gauntletName(g.id)} 🔒`, value: unlocked ? trialTime(trialBest(options.shrine, 'gauntlet', g.id, tier)?.bestMs) : '', disabled: !unlocked, onConfirm: () => fight('gauntlet', g.id, gauntletStops(g.id)) };
      }),
      back('main'),
    ];
  }

  const describe = (index: number) => describeRow[index]?.();
  const list = cursorList({ items: items(), onBack: () => (view === 'main' ? options.onBack() : go(view === 'heralds' ? 'reflections' : 'main')), onCursor: describe, label: t('shrine.title'), className: 'shrine-list' });
  const heading = h('h3', { className: 'dim' });

  function refresh(): void {
    list.setItems(items());
    heading.textContent = view === 'main' ? t('shrine.subtitle') : t(`shrine.${view}`);
    describe(list.index());
  }

  function go(next: ShrineView): void {
    view = next;
    refresh();
  }

  refresh();
  const element = mdWindow({ title: t('shrine.title'), className: 'shrine wide' }, [
    heading,
    h('div', { className: 'shrine-body' }, [list.element, about]),
    h('p', { className: 'dim shrine-solo', textContent: t('shrine.solo') }),
  ]);
  return { element, dispose: () => list.dispose() };
}

export interface ShrineResultOptions {
  request: TrialRequest;
  victory: boolean;
  trial: TrialSummary;
  /** The best before this trial on its tier (null: none). */
  before: TrialBest | null;
  /** Pokémonedas paid (a gauntlet's first clear on its tier), else 0. */
  coins: number;
  balance: number;
  onRetry(): void;
  onBack(): void;
}

/** The title of a request: the boss, the herald or the gauntlet. */
export function requestName(request: TrialRequest, heraldName?: string): string {
  if (request.kind === 'gauntlet') return gauntletName(request.id as GauntletId);
  if (request.kind === 'herald') return heraldName ?? bossName('sima-herald');
  return bossName(request.id);
}

/** The shrine's end screen: the trial, its time, captures and «Sin rasguños», a new best, the coins, then retry or back. */
export function shrineResultScreen(options: ShrineResultOptions, heraldName?: string): HTMLElement {
  const { trial, victory, before } = options;
  const newBest = victory && (before === null || trial.ms < before.bestMs);
  const list = cursorList({
    items: [
      { label: t('screen.retry'), onConfirm: options.onRetry },
      { label: t('shrine.back'), onConfirm: options.onBack },
    ],
    onBack: options.onBack,
    label: t('shrine.title'),
    className: 'result-actions',
  });
  return mdWindow({ title: t('shrine.title'), className: `result ${victory ? 'victory' : 'defeat'} shrine-result` }, [
    h('h1', { textContent: t(victory ? 'shrine.won' : 'shrine.lost') }),
    h('p', { textContent: `${requestName(options.request, heraldName)} · ${t(`difficulty.${options.request.difficulty}`)}` }),
    statLine(t('shrine.time'), trialTime(trial.ms)),
    ...(trial.stops.length > 1 ? [statLine(t('shrine.beaten'), `${trial.beaten}/${trial.stops.length}`)] : []),
    statLine(t('shrine.captures'), String(trial.captures)),
    ...(victory && trial.noHit ? [statLine(t('shrine.noHit'), '✓')] : []),
    ...(newBest ? [h('p', { className: 'shrine-new', textContent: t('shrine.newBest') })] : before ? [statLine(t('shrine.best'), trialTime(before.bestMs))] : []),
    ...(options.coins > 0 ? [statLine(t('shrine.reward'), coinText(options.coins, (key) => t(key))), statLine(t('screen.coins.balance'), coinText(options.balance, (key) => t(key)))] : []),
    list.element,
  ]);
}
