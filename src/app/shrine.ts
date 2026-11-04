import { gauntletStops, heraldStop, SHRINE_BOSSES, type BossStop } from '../core/shrine';
import type { Difficulty } from '../data/difficulty';
import { DIFFICULTIES } from '../data/difficulty';
import { dungeonById } from '../data/dungeons';
import { GAUNTLETS, type GauntletId } from '../data/shrine';
import { SPECIES } from '../data/species';
import { t } from '../i18n';
import type { BestiaryEntry } from '../town/bestiary';
import { trialBest, type ShrineRecords, type TrialBest } from '../town/shrine-records';
import { cursorList } from '../ui/cursor-list';
import { hallNav } from '../ui/hall-nav';
import { pixelIconSvg } from '../ui/pixel-icons';
import { TYPE_COLORS } from '../ui/tokens';
import { h, mdWindow, statLine } from '../ui/window';
import type { SheetStore } from '../adapters/assets';
import { coinText } from './coin-lines';
import { portrait } from './loadout';
import type { TrialSummary } from './game';
import { hallCards, hallTabs, type HallInput, type HallTab, type OathCard } from './shrine-hall';
import '../styles/hall.css';

/**
 * Santuario de los Juramentos (docs/gdd.md §3): the shrine window and its
 * result screen. «Reflejos» lists the bosses beaten on this device (and the
 * heralds met, by seed); «Desafíos» the gauntlets, locked until every boss
 * of one fell. A tier row on top picks any tier. Solo, or the host of an
 * online room for the whole room (the bests «En grupo» are kept apart).
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
  /** The row to open on (a boss species, gauntlet id or herald seed): back from the loadout keeps the pick. */
  focus?: string;
  /** For the portrait of the species of a best time. */
  sheets?: Promise<SheetStore>;
  /** A line under the lists (an online room: who picks and who starts). */
  note?: string;
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

/** "1:23.4 · ✦3 · Zorua" (time, captures and the species of the time) for a best, "-" before the first clear. */
export function bestText(best: TrialBest | null): string {
  if (!best) return '-';
  return [trialTime(best.bestMs), `✦${best.captures}`, ...(best.species ? [t(`species.${best.species}`)] : [])].join(' · ');
}

const MAX_HERALDS = 8;

/** The cursor row of `focus` in a shrine view (row 0 is the tier row); undefined when it is not listed there. */
export function shrineFocus(view: ShrineView, focus: string | undefined, heralds: readonly BestiaryEntry[]): number | undefined {
  if (focus === undefined) return undefined;
  const ids: readonly string[] | null =
    view === 'reflections' ? SHRINE_BOSSES.map((b) => b.boss) : view === 'gauntlets' ? GAUNTLETS.map((g) => g.id) : view === 'heralds' ? heraldEntries(heralds, MAX_HERALDS).map((e) => String(e.seed)) : null;
  const at = ids?.indexOf(focus) ?? -1;
  return at < 0 ? undefined : at + 1;
}

/** The tab a legacy view name opens: the old menu's «main» is the first tab. */
const tabOf = (view: ShrineView, hasHeralds: boolean): HallTab => (view === 'gauntlets' ? 'gauntlets' : view === 'heralds' && hasHeralds ? 'heralds' : 'reflections');

/**
 * The hall of oaths (owner, 2026-11-04: "rediseña el santuario"): the trial kinds as large tabs
 * (progress and best time), the tier as a segmented row, a grid of oath cards beside a large sheet
 * (rules, record, reward and one ember «Jurar»). Fixed geometry, arrows across the grid, Enter
 * confirms, Esc or a press outside closes. Pure data comes from shrine-hall.ts.
 */
export function shrineWindow(options: ShrineOptions): { element: HTMLElement; dispose(): void } {
  let tier = options.difficulty;
  let tab: HallTab = tabOf(options.view ?? 'main', options.heralds.length > 0);
  let focused: string | undefined = options.focus;
  let cards: OathCard[] = [];
  const hall = (): HallInput => ({ shrine: options.shrine, beaten: options.beaten, heralds: options.heralds, tier });

  const tabBar = h('div', { className: 'oa-tabs' });
  tabBar.setAttribute('role', 'tablist');
  const tierBar = h('div', { className: 'oa-tier' }, [h('span', { className: 'oa-tier-label', textContent: t('difficulty.label') })]);
  const tierButtons = DIFFICULTIES.map((d) => {
    const b = h('button', { className: 'oa-tier-btn', type: 'button', textContent: t(`difficulty.${d}`) });
    b.addEventListener('click', () => {
      tier = d;
      options.onTier?.(d);
      render();
    });
    return b;
  });
  tierBar.append(...tierButtons);

  const stage = h('div', { className: 'hl-stage oa-stage' });
  const name = h('h2', { className: 'hl-name' });
  const state = h('div', { className: 'hl-chips' });
  const rules = h('div', { className: 'hl-rules' });
  const record = h('div', { className: 'hl-record' });
  const swear = h('button', { className: 'hl-cta', type: 'button' }, [pixelIconSvg('play', 'px-icon'), h('span', { textContent: t('shrine.swear') })]);
  const sheet = h('section', { className: 'hl-sheet' }, [stage, name, state, rules, record, swear]);
  const grid = h('div', { className: 'hl-grid oa-grid' });
  grid.setAttribute('aria-label', t('shrine.title'));
  const back = h('button', { className: 'hl-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());
  const foot = h('div', { className: 'hl-foot' }, [back, h('p', { className: 'hl-hint', textContent: options.note ?? t('hub.hint') })]);

  const line = (label: string, value: string | Node): HTMLElement => h('p', { className: 'hl-line' }, [h('span', { className: 'hl-line-label', textContent: label }), typeof value === 'string' ? h('span', { className: 'hl-line-value', textContent: value }) : value]);
  const chip = (text: string, cls: string): HTMLElement => h('span', { className: `hl-chip ${cls}`, textContent: text });

  const current = (): OathCard | undefined => cards.find((c) => c.id === focused) ?? cards[0];

  const show = (card: OathCard | undefined): void => {
    if (!card) return;
    focused = card.id;
    const sealed = card.state === 'locked';
    const title = card.kind === 'herald' ? (options.heralds.find((e) => String(e.seed) === card.id)?.name ?? bossName('sima-herald')) : card.kind === 'gauntlet' ? gauntletName(card.id as GauntletId) : bossName(card.id);
    const glow = card.species ? TYPE_COLORS[SPECIES[card.species].types[0]!].core : null;
    if (glow) stage.style.setProperty('--hl-glow', glow);
    else stage.style.removeProperty('--hl-glow');
    stage.replaceChildren(
      h('div', { className: 'hl-stage-glow' }),
      h('div', { className: 'hl-stage-art' }, [card.species && options.sheets ? portrait(options.sheets, card.species, 4) : pixelIconSvg(card.icon, 'px-icon hl-stage-icon')]),
      h('div', { className: 'hl-stage-sign' }),
    );
    name.textContent = sealed ? t('shrine.sealed.name') : title;
    state.replaceChildren(chip(t(`shrine.state.${card.state}`), `is-${card.state}`), ...(card.best?.noHit ? [chip(t('shrine.noHit'), 'is-nohit')] : []));
    const stop = card.stops[0];
    const rule: (Node | string)[] = [];
    if (card.kind === 'boss') {
      rule.push(sealed ? t('shrine.sealed.boss') : t(`shrine.role.${stop!.role}`).replace('{dungeon}', t(dungeonById(stop!.dungeon).lore.nameKey)), t('shrine.reflections.text'));
    } else if (card.kind === 'gauntlet') {
      rule.push(sealed ? t('shrine.locked').replace('{count}', String(card.missing)) : t('shrine.gauntlets.text'), t('shrine.carry'));
    } else rule.push(t('shrine.heralds.text'), t('shrine.herald.seed').replace('{seed}', card.id));
    rules.replaceChildren(h('h3', { textContent: t('shrine.rules') }), ...rule.map((r) => (typeof r === 'string' ? h('p', { textContent: r }) : r)));
    if (card.kind === 'gauntlet' && !sealed) {
      rules.append(h('p', { className: 'hl-order', textContent: `${t('shrine.gauntlet.order')}: ${card.stops.map((s) => bossName(s.boss)).join(' → ')}` }));
    }
    const rows: HTMLElement[] = [];
    if (card.kind === 'herald') rows.push(line(t('shrine.best'), '-'));
    else if (sealed) rows.push(h('p', { className: 'hl-none', textContent: t('shrine.noRecord') }));
    else if (!card.best) rows.push(h('p', { className: 'hl-none', textContent: t('shrine.noRecord') }));
    else {
      const bestValue = h('span', { className: 'hl-line-value', textContent: bestText(card.best) });
      rows.push(line(t('shrine.best'), bestValue), line(t('shrine.clears'), String(card.best.clears)));
    }
    if (card.group) rows.push(line(t('shrine.group'), bestText(card.group)));
    if (card.kind === 'gauntlet') rows.push(line(t('shrine.reward'), card.rewardTaken ? t('shrine.reward.taken') : coinText(card.reward ?? 0, (key) => t(key))));
    else if (card.kind === 'boss' && !sealed) rows.push(line(t('shrine.reward'), t('shrine.reward.none')));
    record.replaceChildren(h('h3', { textContent: t('shrine.record') }), ...rows);
    swear.toggleAttribute('data-locked', sealed);
    swear.setAttribute('aria-disabled', String(sealed));
    for (const c of cardEls) c.classList.toggle('is-focused', c.dataset.oath === card.id);
  };

  const fight = (card: OathCard): void => {
    if (card.state === 'locked') return;
    options.onFight({ kind: card.kind, id: card.id, stops: card.stops, difficulty: tier });
  };
  swear.addEventListener('click', () => {
    const card = current();
    if (card) fight(card);
  });

  let cardEls: HTMLButtonElement[] = [];
  const buildCards = (): void => {
    cardEls = cards.map((card) => {
      const sealed = card.state === 'locked';
      const label = sealed ? t('shrine.sealed.name') : card.kind === 'herald' ? (options.heralds.find((e) => String(e.seed) === card.id)?.name ?? '') : card.kind === 'gauntlet' ? gauntletName(card.id as GauntletId) : bossName(card.id);
      const art = h('span', { className: 'hl-card-art' }, [card.species && options.sheets ? portrait(options.sheets, card.species, 2) : pixelIconSvg(card.icon, 'px-icon hl-card-icon')]);
      const sub = sealed
        ? card.kind === 'gauntlet'
          ? t('shrine.locked').replace('{count}', String(card.missing))
          : t('shrine.state.locked')
        : card.best
          ? trialTime(card.best.bestMs)
          : card.kind === 'gauntlet' && card.reward !== null
            ? coinText(card.reward, (key) => t(key))
            : t(`shrine.state.${card.state}`);
      const el = h('button', { className: `hl-card is-${card.state}`, type: 'button' }, [art, h('span', { className: 'hl-card-name', textContent: label }), h('span', { className: 'hl-card-sub', textContent: sub }), h('span', { className: `hl-card-state is-${card.state}`, textContent: t(`shrine.state.${card.state}`) })]);
      el.dataset.oath = card.id;
      el.setAttribute('aria-label', `${label}, ${t(`shrine.state.${card.state}`)}${card.best ? `, ${trialTime(card.best.bestMs)}` : ''}`);
      el.addEventListener('mouseenter', () => show(card));
      el.addEventListener('focus', () => show(card));
      el.addEventListener('pointerdown', (e) => {
        // Touch has no hover: the first tap reads the card, the next one swears.
        if (e.pointerType === 'touch' && focused !== card.id) {
          show(card);
          el.dataset.fresh = '1';
        }
      });
      el.addEventListener('click', () => {
        if (el.dataset.fresh) {
          delete el.dataset.fresh;
          return;
        }
        show(card);
        fight(card);
      });
      return el;
    });
    grid.replaceChildren(...cardEls);
  };

  const tabEls = new Map<HallTab, HTMLButtonElement>();
  function render(): void {
    const input = hall();
    const infos = hallTabs(input);
    if (!infos.some((i) => i.id === tab)) tab = 'reflections';
    for (const [i, b] of tierButtons.entries()) {
      const on = DIFFICULTIES[i] === tier;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    for (const info of infos) {
      let b = tabEls.get(info.id);
      if (!b) {
        b = h('button', { className: 'oa-tab', type: 'button' });
        b.setAttribute('role', 'tab');
        b.addEventListener('click', () => {
          tab = info.id;
          focused = undefined;
          render();
        });
        tabEls.set(info.id, b);
        tabBar.append(b);
      }
      b.classList.toggle('is-on', info.id === tab);
      b.setAttribute('aria-selected', String(info.id === tab));
      b.replaceChildren(
        pixelIconSvg(info.icon, 'px-icon oa-tab-icon'),
        h('span', { className: 'oa-tab-text' }, [
          h('span', { className: 'oa-tab-name', textContent: t(`shrine.${info.id}`) }),
          h('span', { className: 'oa-tab-meta', textContent: t('shrine.tab.open').replace('{open}', String(info.open)).replace('{total}', String(info.total)) }),
          h('span', { className: 'oa-tab-meta', textContent: info.bestMs === null ? t('shrine.noRecord') : t('shrine.tab.best').replace('{time}', trialTime(info.bestMs)) }),
        ]),
      );
    }
    cards = hallCards(tab, input);
    buildCards();
    show(current());
  }

  render();
  const win = mdWindow({ title: t('shrine.title'), className: 'oa-window hl-window' }, [h('div', { className: 'oa-top' }, [tabBar, tierBar]), h('div', { className: 'hl-body' }, [sheet, grid]), foot]);
  const stopNav = hallNav(win, {
    controls: () => [...tabEls.values(), ...tierButtons, ...cardEls, swear, back],
    start: () => cardEls.find((c) => c.dataset.oath === focused) ?? cardEls.find((c) => c.classList.contains('is-beaten') || c.classList.contains('is-sworn')) ?? cardEls[0],
    onBack: options.onBack,
  });
  return { element: win, dispose: stopNav };
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
  /** Absent in an online room (the host starts the next one from the altar). */
  onRetry?(): void;
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
      ...(options.onRetry ? [{ label: t('screen.retry'), onConfirm: options.onRetry }] : []),
      { label: t(options.onRetry ? 'shrine.back' : 'shrine.room.back'), onConfirm: options.onBack },
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
