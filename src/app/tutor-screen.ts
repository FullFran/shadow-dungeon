import { rosterOf } from '../core/collection';
import { MOVES, type MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { MAX_RANK } from '../data/tutor';
import type { PokemonType } from '../data/types';
import type { SheetStore } from '../adapters/assets';
import type { KeyValueStore } from '../adapters/storage';
import { isTouchUi } from '../adapters/touch-mode';
import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { TUTOR_ICONS } from '../ui/icons/tutor-icons';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { TYPE_COLORS } from '../ui/tokens';
import { h, mdWindow } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave } from './save';
import { createMovePreview, type MovePreview } from './move-preview-view';
import { buildHint, cardBlock, confirmCopy, nextRankText, paidText, SLOT_FILTERS, spendAfterConfirm, tierName, tutorCards, tutorPurchase, type MoveCard, type SlotFilter } from './tutor';
import { hubStep } from './title-hub';
import '../styles/tutor.css';

/**
 * Smeargle's move tutor as a screen, the Pokémon picker's pattern
 * (src/app/species-picker.ts; owner, 2026-11-03: "lo mismo ... para Maestro"):
 * the Pokémon as portrait chips and the balance on top, the slot filter as tabs,
 * a grid of quiet move cards beside one sheet for the card in focus: a live preview
 * of the move cast by the chosen Pokémon (move-preview.ts), its name, three big
 * numbers, what it does, what the next rank adds and one primary action. Learning
 * or ranking up asks first (the shared confirmation) and spends only on a yes.
 * Arrows move across the grid, Enter or a click acts (on touch: the first tap
 * shows, the second acts), Q E switch Pokémon, Esc goes back. Fixed geometry:
 * nothing resizes with the content (long grids scroll inside).
 */

export interface TutorOptions {
  store: KeyValueStore;
  /** The player's starter: the tutor opens on it. */
  species: SpeciesId;
  /** Dungeons cleared on this device: some Maestro moves wait for one. */
  cleared?: Iterable<string>;
  /** A species' idle animation (no art when absent). */
  portrait?(id: SpeciesId, scale: number): HTMLElement;
  /** The sprite sheets: the live move preview needs them (no preview when absent). */
  sheets?: Promise<SheetStore>;
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

const typeBadge = (type: PokemonType): HTMLElement => h('span', { className: `type-badge type-${type}`, textContent: t(`type.${type}`) });
const tierBadge = (card: Pick<MoveCard, 'tier'>): HTMLElement => h('span', { className: `tier-badge tier-${card.tier}`, textContent: tierName(card.tier) });
const icon = (id: string): SVGSVGElement => pixelSvgOf(TUTOR_ICONS[id]!, 'px-icon');
const fillText = (key: string, values: Record<string, string | number>): string => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, String(v)), t(key));
const secs = (ms: number): string => String(Math.round(ms / 100) / 10);

/** The rank pips of a known move: filled for each owned rank. */
const pips = (rank: number): HTMLElement => {
  const out = h('span', { className: 'tu-pips' }, Array.from({ length: MAX_RANK }, (_, i) => h('i', { className: i < rank ? 'is-on' : '' })));
  out.setAttribute('role', 'img');
  out.setAttribute('aria-label', fillText('tutor.pips', { n: rank, max: MAX_RANK }));
  return out;
};

const KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };

export function tutorWindow(options: TutorOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  let species = options.species;
  let filter: SlotFilter = 'all';
  let cards: MoveCard[] = [];
  let focused: MoveId | null = null;
  /** The confirmation is open: nothing else acts meanwhile. */
  let asking = false;
  /** What the preview shows now, so a refresh of the same move does not restart it. */
  let previewKey = '';
  const cleared = (): string[] => [...(options.cleared ?? [])];
  const wallet = () => ({ ...save, cleared: cleared() });
  const roster = (): SpeciesId[] => {
    const all = rosterOf(save);
    return all.includes(species) ? all : [species, ...all];
  };

  // Top: back, Pokémon chips and balance.
  const back = h('button', { className: 'tu-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());
  const prev = h('button', { className: 'tu-step', type: 'button', textContent: '◀' });
  const next = h('button', { className: 'tu-step', type: 'button', textContent: '▶' });
  prev.setAttribute('aria-label', t('tutor.prev'));
  next.setAttribute('aria-label', t('tutor.next'));
  const strip = h('div', { className: 'tu-species' });
  const balance = h('div', { className: 'tu-balance' });
  balance.setAttribute('aria-live', 'polite');
  const chips = new Map<SpeciesId, HTMLButtonElement>();
  for (const id of roster()) {
    const chip = h('button', { className: 'tu-chip', type: 'button' }, [
      h('span', { className: 'tu-chip-art' }, options.portrait ? [options.portrait(id, 1)] : []),
      h('span', { className: 'tu-chip-name', textContent: t(`species.${id}`) }),
    ]);
    chip.setAttribute('aria-label', t(`species.${id}`));
    chip.addEventListener('click', () => switchTo(id));
    chips.set(id, chip);
    strip.append(chip);
  }
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

  // Slot filter tabs.
  const tabs = new Map<SlotFilter, HTMLButtonElement>();
  const tabRow = h('div', { className: 'tu-tabs' });
  tabRow.setAttribute('role', 'group');
  tabRow.setAttribute('aria-label', t('tutor.filters'));
  for (const f of SLOT_FILTERS) {
    const tab = h('button', { className: 'tu-tab', type: 'button' }, [icon(f), h('span', { textContent: t(f === 'all' ? 'tutor.filter.all' : `slot.${f}`) })]);
    tab.addEventListener('click', () => {
      filter = f;
      refresh();
    });
    tabs.set(f, tab);
    tabRow.append(tab);
  }

  // Sheet: preview, name and badges, three numbers, description, one note, the action.
  const preview: MovePreview | null = options.sheets ? createMovePreview({ sheets: options.sheets }) : null;
  const sName = h('h2', { className: 'tu-name' });
  const sBadges = h('div', { className: 'tu-badges' });
  const sStats = h('div', { className: 'tu-stats' });
  const sDesc = h('p', { className: 'tu-desc' });
  const sNote = h('p', { className: 'tu-note' });
  const actLabel = h('span');
  const actIcon = h('span', { className: 'tu-act-icon' });
  const act = h('button', { className: 'tu-act', type: 'button' }, [actIcon, actLabel]);
  act.addEventListener('click', () => void perform(current()));
  const sheet = h('section', { className: 'tu-sheet' }, [...(preview ? [preview.element] : []), h('div', { className: 'tu-sheet-head' }, [sName, sBadges]), sStats, sDesc, sNote, act]);

  const stat = (label: string, value: string): HTMLElement => h('div', { className: 'tu-stat' }, [h('span', { className: 'tu-stat-value', textContent: value }), h('span', { className: 'tu-stat-label', textContent: label })]);

  const current = (): MoveCard | null => cards.find((c) => c.move === focused) ?? null;

  const showSheet = (card: MoveCard | null): void => {
    sheet.classList.toggle('is-empty', card === null);
    if (!card) {
      sName.textContent = t('tutor.empty');
      for (const part of [sBadges, sStats, sDesc, sNote]) part.replaceChildren();
      act.hidden = true;
      return;
    }
    act.hidden = false;
    focused = card.move;
    const def = MOVES[card.move];
    sheet.style.setProperty('--tu-edge', TYPE_COLORS[card.type].core);
    const key = `${species}:${card.move}:${card.rank}`;
    if (preview && key !== previewKey) {
      previewKey = key;
      preview.show(species, card.move, card.rank);
    }
    sName.textContent = t(`move.${card.move}`);
    sBadges.replaceChildren(typeBadge(card.type), tierBadge(card), h('span', { className: 'tu-slot' }, [icon(card.slot), h('span', { textContent: t(`slot.${card.slot}`) })]), ...(card.known ? [pips(card.rank)] : []));
    sStats.replaceChildren(
      stat(t('loadout.power'), def.power > 0 ? String(def.power) : '-'),
      stat(t('tutor.stat.stamina'), def.staminaCost > 0 ? String(def.staminaCost) : '-'),
      stat(t('tutor.stat.cooldown'), def.cooldownMs ? `${secs(def.cooldownMs)} s` : '-'),
    );
    sDesc.textContent = t(`move.${card.move}.description`);
    const block = cardBlock(card, save.coins);
    const rank = nextRankText(card);
    const note = block ? (block.kind === 'locked' ? fillText('tutor.locked', { dungeon: block.dungeon }) : fillText('tutor.reason.coins', { n: block.missing })) : rank ? fillText('tutor.rank.next', { text: rank }) : card.known ? '' : paidText(card.move);
    sNote.textContent = note;
    sNote.title = note;
    sNote.classList.toggle('is-reason', block !== null);
    const label =
      card.action === 'learn' ? `${t('tutor.act.learn')} · ${coinText(card.cost ?? 0, t)}` : card.action === 'rank' ? `${fillText('tutor.act.rank', { n: card.rank + 1 })} · ${coinText(card.cost ?? 0, t)}` : t(card.state === 'maxed' ? 'tutor.act.maxed' : 'tutor.lockedShort');
    actLabel.textContent = label;
    actIcon.replaceChildren(card.action === 'rank' ? icon('rankup') : card.action === 'learn' ? pixelIconSvg('play', 'px-icon') : pixelIconSvg('lock', 'px-icon'));
    const ready = card.action !== null && block === null;
    act.classList.toggle('is-disabled', !ready);
    act.setAttribute('aria-disabled', String(!ready));
    for (const el of grid.querySelectorAll<HTMLElement>('.tu-card')) el.classList.toggle('is-focused', el.dataset.move === card.move);
  };

  // Grid: a quiet card per move (name, type edge, slot icon, one state).
  const grid = h('div', { className: 'tu-grid' });
  grid.setAttribute('aria-label', t('tutor.title'));
  const stateLine = (card: MoveCard): HTMLElement => {
    switch (card.state) {
      case 'locked':
        return h('span', { className: 'tu-state is-locked' }, [pixelIconSvg('lock', 'px-icon'), h('span', { textContent: t('tutor.lockedShort') })]);
      case 'buy':
        return h('span', { className: `tu-state is-buy${card.affordable ? ' is-ok' : ''}`, textContent: coinText(card.cost ?? 0, t) });
      default:
        return h('span', { className: 'tu-state is-known', textContent: t('tutor.learned') });
    }
  };
  const cardButton = (card: MoveCard): HTMLButtonElement => {
    const button = h('button', { className: `tu-card is-${card.state}`, type: 'button' }, [h('span', { className: 'tu-card-row' }, [icon(card.slot), h('span', { className: 'tu-card-name', textContent: t(`move.${card.move}`) })]), stateLine(card)]);
    button.style.setProperty('--tu-edge', TYPE_COLORS[card.type].core);
    button.dataset.move = card.move;
    button.setAttribute('aria-label', `${t(`move.${card.move}`)}, ${tierName(card.tier)}, ${button.querySelector('.tu-state')?.textContent ?? ''}`);
    let armed = false;
    button.addEventListener('pointerdown', () => {
      armed = focused === card.move;
    });
    button.addEventListener('mouseenter', () => showSheet(card));
    button.addEventListener('focus', () => showSheet(card));
    button.addEventListener('click', () => {
      // On touch the first tap shows the move, the second acts.
      if (isTouchUi() && !armed) {
        showSheet(card);
        return;
      }
      void perform(card);
    });
    return button;
  };

  /** Learn or rank up `card`: asks first, and spends only after the player confirms. */
  async function perform(card: MoveCard | null): Promise<void> {
    if (asking) return;
    if (!card?.action || cardBlock(card, save.coins)) {
      options.play?.('denied');
      return;
    }
    const copy = confirmCopy(card);
    const chip = h('span', { className: 'tu-cost' }, [pixelIconSvg('coin', 'px-icon'), h('span', { textContent: coinText(copy.cost ?? 0, t) })]);
    asking = true;
    try {
      const spent = await spendAfterConfirm(
        () => confirmDialog({ title: copy.title, body: copy.body, confirmLabel: copy.confirmLabel, cost: chip }),
        () => {
          const bought = tutorPurchase(options.store, species, { kind: card.action === 'learn' ? 'move' : 'rank', move: card.move }, options.cleared);
          if (!bought) {
            options.play?.('denied');
            return false;
          }
          options.play?.('coin');
          save = bought;
          return true;
        },
      );
      if (spent) refresh();
    } finally {
      asking = false;
    }
  }

  function refresh(): void {
    const active = document.activeElement;
    const keep = active instanceof HTMLElement && grid.contains(active) ? (active.dataset.move ?? null) : null;
    cards = tutorCards(wallet(), species, filter);
    balance.replaceChildren(pixelIconSvg('coin', 'px-icon'), h('span', { textContent: coinText(save.coins, t) }));
    for (const [id, chip] of chips) {
      chip.classList.toggle('is-current', id === species);
      chip.setAttribute('aria-pressed', String(id === species));
    }
    for (const [f, tab] of tabs) {
      tab.classList.toggle('is-on', f === filter);
      tab.setAttribute('aria-pressed', String(f === filter));
    }
    buildLine.textContent = buildHint(species);
    buildLine.title = buildLine.textContent;
    grid.replaceChildren(...cards.map(cardButton));
    if (cards.length === 0) grid.append(h('p', { className: 'tu-empty', textContent: t('tutor.empty') }));
    const target = cards.find((c) => c.move === focused) ?? cards[0] ?? null;
    focused = target?.move ?? null;
    showSheet(target);
    if (keep && target) grid.querySelector<HTMLElement>(`[data-move="${target.move}"]`)?.focus({ preventScroll: true });
    const chip = chips.get(species);
    if (chip) strip.scrollLeft = Math.max(0, chip.offsetLeft - strip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2);
  }

  function switchTo(id: SpeciesId): void {
    species = id;
    focused = null;
    refresh();
  }
  function step(delta: -1 | 1): void {
    const all = roster();
    switchTo(all[(all.indexOf(species) + delta + all.length) % all.length]!);
  }

  const buildLine = h('p', { className: 'tu-hint tu-build' });
  const element = mdWindow({ title: t('tutor.title'), className: 'tu-window' }, [
    h('div', { className: 'tu-top' }, [back, prev, strip, next, balance]),
    tabRow,
    h('div', { className: 'tu-body' }, [grid, sheet]),
    h('div', { className: 'tu-foot' }, [buildLine, h('p', { className: 'tu-hint', textContent: t(isTouchUi() ? 'shop.hint.touch' : 'tutor.hint.keys') })]),
  ]);

  const onKey = (e: KeyboardEvent): void => {
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (asking) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      options.onBack();
      return;
    }
    if (e.code === 'KeyQ' || e.code === 'KeyE') {
      e.preventDefault();
      step(e.code === 'KeyQ' ? -1 : 1);
      return;
    }
    const dir = KEYS[e.code];
    if (!dir) return;
    e.preventDefault();
    const controls = [back, prev, ...chips.values(), next, ...tabs.values(), ...grid.querySelectorAll<HTMLButtonElement>('.tu-card'), act].filter((el) => !el.hidden);
    const at = controls.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) {
      (grid.querySelector<HTMLElement>(`[data-move="${focused}"]`) ?? controls[0])?.focus();
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    controls[Number(hubStep(points, String(at), dir))]?.focus();
  };
  window.addEventListener('keydown', onKey);

  refresh();
  queueMicrotask(() => grid.querySelector<HTMLElement>(`[data-move="${focused}"]`)?.focus({ preventScroll: true }));
  return {
    element,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      preview?.dispose();
    },
  };
}
