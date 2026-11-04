import type { KeyValueStore } from '../adapters/storage';
import { missionBoard } from '../core/missions';
import { MISSIONS } from '../data/missions';
import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { hallNav } from '../ui/hall-nav';
import { pixelIconSvg } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import { achievementToast } from './achievements';
import { boardCards, cardAction, fill, slotCards, type MissionCard } from './board-view';
import { coinText } from './coin-lines';
import { abandonAt, acceptAt, claimAt, missionsAt } from './progress';
import { loadSave } from './save';
import '../styles/hall.css';

export { missionText, missionTitle, rewardText, statusText } from './board-view';

/**
 * The town notice board (odd/tasks/achievements-missions.md; owner, 2026-11-04: "rediseña el
 * tablón"): three accepted slots on top, the posted missions as cards beside a large sheet with
 * the full condition, the difficulty required, the reward and one action (accept, claim or
 * abandon, which asks first). The only highlight is a mission ready to cash in. Data and texts
 * come from board-view.ts; accept limits, rewards and progress are the game's own (progress.ts).
 */
export interface BoardOptions {
  store: KeyValueStore;
  /** The clock (UTC ms): the board of its day and week. */
  now(): number;
  play?(sound: 'coin' | 'denied'): void;
  /** Opens the achievements window (in place of the board). */
  onAchievements(): void;
  onBack(): void;
}

export function missionBoardWindow(options: BoardOptions): { element: HTMLElement; dispose(): void } {
  const tr = (key: string): string => t(key);
  let focused: string | undefined;
  let note = '';
  let cards: MissionCard[] = [];
  let cardEls: HTMLButtonElement[] = [];
  let slotEls: HTMLButtonElement[] = [];

  const state = () => missionsAt(loadSave(options.store), options.now());

  const saldo = h('div', { className: 'bd-saldo' });
  const slots = h('div', { className: 'bd-slots' });
  slots.setAttribute('aria-label', t('mission.slots'));
  const grid = h('div', { className: 'hl-grid bd-grid' });
  grid.setAttribute('aria-label', t('mission.title'));

  const stage = h('div', { className: 'hl-stage bd-stage' });
  const name = h('h2', { className: 'hl-name' });
  const chips = h('div', { className: 'hl-chips' });
  const info = h('div', { className: 'hl-rules' });
  const progress = h('div', { className: 'hl-record' });
  const cta = h('button', { className: 'hl-cta', type: 'button' });
  const sheet = h('section', { className: 'hl-sheet' }, [stage, name, chips, info, progress, cta]);
  const back = h('button', { className: 'hl-back', type: 'button', textContent: t('menu.back') });
  const logros = h('button', { className: 'hl-back', type: 'button', textContent: t('title.achievements') });
  back.addEventListener('click', () => options.onBack());
  logros.addEventListener('click', () => options.onAchievements());
  const hint = h('p', { className: 'hl-hint', textContent: t('mission.hint') });

  const bar = (share: number, label: string): HTMLElement => {
    const fillBar = h('i');
    fillBar.style.width = `${Math.round(share * 100)}%`;
    const el = h('span', { className: 'hl-bar' }, [fillBar]);
    el.setAttribute('role', 'progressbar');
    el.setAttribute('aria-valuemin', '0');
    el.setAttribute('aria-valuemax', '100');
    el.setAttribute('aria-valuenow', String(Math.round(share * 100)));
    el.setAttribute('aria-label', label);
    return el;
  };
  const line = (label: string, value: string): HTMLElement => h('p', { className: 'hl-line' }, [h('span', { className: 'hl-line-label', textContent: label }), h('span', { className: 'hl-line-value', textContent: value })]);
  const current = (): MissionCard | undefined => cards.find((c) => c.id === focused) ?? cards[0];
  const full = (): boolean => state().accepted.length >= MISSIONS.maxAccepted;

  const show = (card: MissionCard | undefined): void => {
    if (!card) {
      name.textContent = t('mission.title');
      info.replaceChildren(h('p', { textContent: t('mission.reset') }));
      return;
    }
    focused = card.id;
    stage.replaceChildren(h('div', { className: 'hl-stage-glow' }), h('div', { className: 'hl-stage-art' }, [pixelIconSvg(card.icon, 'px-icon hl-stage-icon')]), h('div', { className: 'hl-stage-sign' }));
    name.textContent = card.title;
    chips.replaceChildren(
      h('span', { className: `hl-chip ${card.weekly ? 'is-weekly' : ''}`, textContent: card.weekly ? `★ ${tr('mission.period.weekly')}` : tr('mission.period.daily') }),
      ...(card.ready ? [h('span', { className: 'hl-chip is-ready', textContent: tr('mission.ready') })] : []),
    );
    info.replaceChildren(
      h('h3', { textContent: tr('mission.condition') }),
      h('p', { textContent: card.text }),
      line(tr('mission.requires'), tr(`difficulty.${card.tier}`)),
      line(tr('mission.requester'), card.requester),
    );
    const coin = pixelIconSvg('coin', 'px-icon hl-coin');
    const reward = h('p', { className: 'hl-line' }, [h('span', { className: 'hl-line-label', textContent: tr('mission.reward').replace(/:$/, '') }), h('span', { className: 'hl-line-value' }, [coin, card.reward])]);
    progress.replaceChildren(
      h('h3', { textContent: tr('mission.progress') }),
      bar(card.share, tr('mission.progress')),
      h('p', { className: 'hl-line-value hl-count', textContent: card.status === 'claimed' ? tr('mission.status.claimed') : `${card.progress}/${card.target}` }),
      reward,
      ...(note ? [h('p', { className: 'hl-note', textContent: note })] : []),
    );
    const action = cardAction(card.status, full());
    const label = { accept: 'mission.action.accept', full: 'mission.action.full', claim: 'mission.action.claim', abandon: 'mission.action.abandon', none: 'mission.action.claimed' }[action];
    cta.replaceChildren(pixelIconSvg(action === 'claim' ? 'coin' : action === 'abandon' ? 'lock' : 'play', 'px-icon'), h('span', { textContent: tr(label) }));
    cta.dataset.action = action;
    cta.classList.toggle('is-quiet', action === 'abandon' || action === 'full' || action === 'none');
    cta.setAttribute('aria-disabled', String(action === 'full' || action === 'none'));
    for (const el of cardEls) el.classList.toggle('is-focused', el.dataset.mission === card.id);
  };

  const act = async (): Promise<void> => {
    const card = current();
    if (!card) return;
    const now = options.now();
    const action = cardAction(card.status, full());
    note = '';
    if (action === 'accept') {
      if (acceptAt(options.store, card.id, now)) options.play?.('coin');
      else options.play?.('denied');
    } else if (action === 'claim') {
      const claimed = claimAt(options.store, card.id, now);
      if (claimed) {
        options.play?.('coin');
        note = fill(tr('mission.claimed'), { reward: card.reward });
        achievementToast(claimed.unlocked, tr);
      }
    } else if (action === 'abandon') {
      const ok = await confirmDialog({ title: tr('mission.abandon.title'), body: fill(tr('mission.abandon.body'), { title: card.title }), confirmLabel: tr('mission.abandon.confirm') });
      if (!ok) return;
      abandonAt(options.store, card.id, now);
    } else {
      options.play?.('denied');
      if (action === 'full') note = fill(tr('mission.full'), { max: String(MISSIONS.maxAccepted) });
    }
    refresh();
  };
  cta.addEventListener('click', () => void act());

  function refresh(): void {
    const board = missionBoard(options.now());
    const s = state();
    cards = boardCards(board, s, tr);
    saldo.replaceChildren(pixelIconSvg('coin', 'px-icon'), h('span', { className: 'bd-saldo-label', textContent: tr('screen.coins.balance') }), h('b', { textContent: coinText(loadSave(options.store).coins, tr) }));
    slotEls = slotCards(board, s, tr).map((slot) => {
      if (!slot) {
        const empty = h('span', { className: 'bd-slot is-empty' }, [h('span', { className: 'bd-slot-title', textContent: tr('mission.slot.empty') })]);
        return empty as unknown as HTMLButtonElement;
      }
      const b = h('button', { className: `bd-slot${slot.ready ? ' is-ready' : ''}`, type: 'button' }, [
        pixelIconSvg(slot.icon, 'px-icon bd-slot-icon'),
        h('span', { className: 'bd-slot-text' }, [h('span', { className: 'bd-slot-title', textContent: slot.title }), bar(slot.share, slot.title)]),
        h('span', { className: 'bd-slot-count', textContent: slot.ready ? tr('mission.ready') : `${slot.progress}/${slot.target}` }),
      ]);
      b.addEventListener('click', () => {
        focused = slot.id;
        show(current());
        cardEls.find((c) => c.dataset.mission === slot.id)?.focus({ preventScroll: true });
      });
      return b;
    });
    slots.replaceChildren(...slotEls);
    cardEls = cards.map((card) => {
      const coin = pixelIconSvg('coin', 'px-icon hl-coin');
      const el = h('button', { className: `hl-card bd-card is-${card.status}${card.ready ? ' is-ready' : ''}${card.weekly ? ' is-weekly' : ''}`, type: 'button' }, [
        h('span', { className: 'hl-card-art' }, [pixelIconSvg(card.icon, 'px-icon hl-card-icon')]),
        h('span', { className: 'hl-card-name', textContent: card.title }),
        h('span', { className: 'hl-card-sub' }, [coin, `${card.coins}`, h('em', { textContent: tr(`difficulty.${card.tier}`) })]),
        card.status === 'accepted' ? bar(card.share, card.title) : card.ready ? h('span', { className: 'hl-card-state is-ready', textContent: tr('mission.ready') }) : card.status === 'claimed' ? h('span', { className: 'hl-card-state', textContent: tr('mission.status.claimed') }) : null,
        card.weekly ? pixelIconSvg('star', 'px-icon bd-star') : null,
      ]);
      el.dataset.mission = card.id;
      el.setAttribute('aria-label', `${card.title}, ${card.requester}, ${tr(`difficulty.${card.tier}`)}, ${card.reward}`);
      el.addEventListener('mouseenter', () => {
        note = '';
        show(card);
      });
      el.addEventListener('focus', () => {
        if (focused !== card.id) note = '';
        show(card);
      });
      el.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' && focused !== card.id) {
          note = '';
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
        void act();
      });
      return el;
    });
    grid.replaceChildren(...cardEls);
    show(current());
    if (document.activeElement === document.body || !document.activeElement?.isConnected) cardEls.find((c) => c.dataset.mission === focused)?.focus({ preventScroll: true });
  }

  refresh();
  const win = mdWindow({ title: t('mission.title'), className: 'bd-window hl-window' }, [
    h('div', { className: 'bd-top' }, [slots, saldo]),
    h('div', { className: 'hl-body' }, [sheet, grid]),
    h('div', { className: 'hl-foot' }, [h('div', { className: 'hl-foot-btns' }, [back, logros]), hint]),
  ]);
  const stopNav = hallNav(win, {
    controls: () => [...slotEls.filter((s) => s instanceof HTMLButtonElement), ...cardEls, cta, back, logros],
    start: () => cardEls.find((c) => c.dataset.mission === focused) ?? cardEls.find((c) => c.classList.contains('is-ready')) ?? cardEls[0],
    onBack: options.onBack,
  });
  return { element: win, dispose: stopNav };
}
