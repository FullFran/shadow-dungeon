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
import { buildHint, cardBlock, confirmCopy, nextRankText, paidText, spendAfterConfirm, tierName, tutorCards, tutorPurchase, type MoveCard, cardStateLabel } from './tutor';
import { defaultOpen, horizontal, moveGroups, navItems, navMove, type MoveGroup, type NavItem } from './tutor-groups';
import type { SlotKind } from '../data/slots';
import { hubStep } from './title-hub';
import '../styles/tutor.css';

/**
 * Smeargle's move tutor as a screen, the Pokémon picker's pattern
 * (src/app/species-picker.ts; owner, 2026-11-03: "lo mismo ... para Maestro"):
 * the Pokémon as portrait chips and the balance on top, then ONE column of moves
 * grouped in accordions (one per slot: Rápida, Fuerte, Potencia, Área; the old slot
 * tabs are gone, the groups are the filter) beside one sheet for the move in focus: a live preview
 * of the move cast by the chosen Pokémon (move-preview.ts), its name, three big
 * numbers, what it does, what the next rank adds and one primary action. Learning
 * or ranking up asks first (the shared confirmation) and spends only on a yes.
 * Up and Down walk the headers and the open rows, Left and Right fold and unfold a
 * group, Enter or Space on a header toggles it, Enter or a click on a row acts (on
 * touch: the first tap shows, the second acts), Q E switch Pokémon, Esc goes back.
 * Fixed geometry: nothing resizes with the content (the list scrolls inside).
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
  let cards: MoveCard[] = [];
  let groups: MoveGroup[] = [];
  /** Open groups; null until the first render of a Pokémon picks the default one. */
  let open: Set<SlotKind> | null = null;
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
      h('span', { className: 'tu-chip-art sprite-box' }, options.portrait ? [options.portrait(id, 1)] : []),
      h('span', { className: 'tu-chip-name', textContent: t(`species.${id}`) }),
    ]);
    chip.setAttribute('aria-label', t(`species.${id}`));
    chip.addEventListener('click', () => switchTo(id));
    chips.set(id, chip);
    strip.append(chip);
  }
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));

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
    for (const el of list.querySelectorAll<HTMLElement>('.tu-row')) el.classList.toggle('is-focused', el.dataset.move === card.move);
  };

  // List: one accordion per slot, a calm row per move (name, rank pips, one quiet price or state).
  const list = h('div', { className: 'tu-list' });
  list.setAttribute('aria-label', t('tutor.title'));
  const headers = new Map<SlotKind, HTMLButtonElement>();
  const bodies = new Map<SlotKind, HTMLElement>();
  const groupEls = new Map<SlotKind, HTMLElement>();

  const rowState = (card: MoveCard): HTMLElement => {
    const label = cardStateLabel(card);
    return h('span', { className: `tu-row-state is-${label.kind}` }, [...(label.kind === 'locked' ? [pixelIconSvg('lock', 'px-icon')] : []), h('span', { textContent: label.action })]);
  };
  const rowButton = (card: MoveCard): HTMLButtonElement => {
    const button = h('button', { className: `tu-row is-${card.state}${card.affordable ? ' is-ok' : ''}`, type: 'button' }, [h('span', { className: 'tu-row-name', textContent: t(`move.${card.move}`) }), pips(card.rank), rowState(card)]);
    button.dataset.move = card.move;
    button.setAttribute('aria-label', `${t(`move.${card.move}`)}, ${tierName(card.tier)}, ${cardStateLabel(card).rank} ${cardStateLabel(card).action}`);
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
  const groupEl = (group: MoveGroup): HTMLElement => {
    const name = t(`slot.${group.slot}`);
    const count = fillText('tutor.group.count', { n: group.cards.length });
    const maxed = group.maxed > 0 ? fillText('tutor.group.maxed', { n: group.maxed }) : t('tutor.group.noneMaxed');
    const head = h('button', { className: 'tu-group-head', type: 'button', id: `tu-h-${group.slot}` }, [
      h('span', { className: 'tu-chevron' }),
      icon(group.slot),
      h('span', { className: 'tu-group-name', textContent: name }),
      h('span', { className: 'tu-group-count', textContent: count }),
      h('span', { className: `tu-group-max${group.maxed > 0 ? ' has-max' : ''}`, textContent: maxed }),
    ]);
    head.setAttribute('aria-controls', `tu-g-${group.slot}`);
    head.setAttribute('aria-label', fillText('tutor.group.aria', { name, count, maxed }));
    head.addEventListener('click', () => toggle(group.slot));
    const inner = h('div', { className: 'tu-group-inner' }, group.cards.map(rowButton));
    const body = h('div', { className: 'tu-group-body', id: `tu-g-${group.slot}` }, [inner]);
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', `tu-h-${group.slot}`);
    headers.set(group.slot, head);
    bodies.set(group.slot, body);
    const el = h('section', { className: 'tu-group' }, [head, body]);
    groupEls.set(group.slot, el);
    return el;
  };

  /** Reflect `open` on the headers and bodies (a closed body is inert: its rows leave the tab order). */
  const syncOpen = (): void => {
    for (const [slot, head] of headers) {
      const isOpen = open?.has(slot) ?? false;
      head.setAttribute('aria-expanded', String(isOpen));
      groupEls.get(slot)?.classList.toggle('is-open', isOpen);
      bodies.get(slot)?.toggleAttribute('inert', !isOpen);
    }
  };
  function toggle(slot: SlotKind, force?: boolean): void {
    if (!open) return;
    const want = force ?? !open.has(slot);
    if (want) open.add(slot);
    else open.delete(slot);
    syncOpen();
    headers.get(slot)?.scrollIntoView({ block: 'nearest' });
  }
  const items = (): NavItem[] => navItems(groups, open ?? new Set());
  const elOf = (item: NavItem): HTMLElement | null => (item.kind === 'header' ? (headers.get(item.slot) ?? null) : (list.querySelector<HTMLElement>(`[data-move="${item.move}"]`) ?? null));
  const focusItem = (item: NavItem | undefined): void => {
    const el = item ? elOf(item) : null;
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'nearest' });
  };
  const itemAt = (el: Element | null): number => items().findIndex((i) => elOf(i) === el);

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
    const keep = active instanceof HTMLElement && list.contains(active) ? (active.dataset.move ?? active.id) : null;
    cards = tutorCards(wallet(), species, 'all');
    groups = moveGroups(cards);
    open ??= defaultOpen(groups, focused);
    balance.replaceChildren(pixelIconSvg('coin', 'px-icon'), h('span', { textContent: coinText(save.coins, t) }));
    for (const [id, chip] of chips) {
      chip.classList.toggle('is-current', id === species);
      chip.setAttribute('aria-pressed', String(id === species));
    }
    buildLine.textContent = buildHint(species);
    buildLine.title = buildLine.textContent;
    headers.clear();
    bodies.clear();
    groupEls.clear();
    list.replaceChildren(...groups.map(groupEl));
    if (cards.length === 0) list.append(h('p', { className: 'tu-empty', textContent: t('tutor.empty') }));
    syncOpen();
    const target = cards.find((c) => c.move === focused) ?? cards.find((c) => open?.has(c.slot)) ?? cards[0] ?? null;
    focused = target?.move ?? null;
    showSheet(target);
    if (keep) (list.querySelector<HTMLElement>(`[data-move="${keep}"]`) ?? list.querySelector<HTMLElement>(`#${keep}`))?.focus({ preventScroll: true });
    const chip = chips.get(species);
    if (chip) strip.scrollLeft = Math.max(0, chip.offsetLeft - strip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2);
  }

  function switchTo(id: SpeciesId): void {
    species = id;
    focused = null;
    open = null;
    refresh();
  }
  function step(delta: -1 | 1): void {
    const all = roster();
    switchTo(all[(all.indexOf(species) + delta + all.length) % all.length]!);
  }

  const buildLine = h('p', { className: 'tu-hint tu-build' });
  const element = mdWindow({ title: t('tutor.title'), className: 'tu-window' }, [
    h('div', { className: 'tu-top' }, [back, prev, strip, next, balance]),
    h('div', { className: 'tu-body' }, [list, sheet]),
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
    const active = document.activeElement;
    const at = list.contains(active) ? itemAt(active) : -1;
    const all = items();
    if (at >= 0) {
      const item = all[at]!;
      if (dir === 'up' || dir === 'down') {
        const to = navMove(all, at, dir === 'up' ? -1 : 1);
        // Up from the first header leaves the list for the Pokémon strip.
        if (dir === 'up' && to === at) chips.get(species)?.focus();
        else focusItem(all[to]);
        return;
      }
      const move = horizontal(item, dir, open ?? new Set());
      if (move?.kind === 'toHeader') focusItem({ kind: 'header', slot: move.slot });
      else if (move) toggle(move.slot, move.kind === 'open');
      else if (dir === 'right') act.focus();
      return;
    }
    if (active === act && dir === 'left') {
      const row = list.querySelector<HTMLElement>(`[data-move="${focused}"]`);
      (row && !row.closest('[inert]') ? row : headers.values().next().value)?.focus();
      return;
    }
    // Outside the list (back, Pokémon strip, the sheet's action): spatial arrows, the list standing in as one stop.
    const stop = all.map(elOf).find((el) => el !== null) ?? null;
    const controls = [back, prev, ...chips.values(), next, ...(stop ? [stop] : []), act].filter((el): el is HTMLElement => !!el && !el.hidden);
    const here = controls.indexOf(active as HTMLElement);
    if (here < 0) {
      (list.querySelector<HTMLElement>(`[data-move="${focused}"]`) ?? controls[0])?.focus();
      return;
    }
    const points = controls.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const to = controls[Number(hubStep(points, String(here), dir))];
    if (to && to === stop) {
      const row = list.querySelector<HTMLElement>(`[data-move="${focused}"]`);
      (row && !row.closest('[inert]') ? row : stop).focus();
    } else to?.focus();
  };
  window.addEventListener('keydown', onKey);

  refresh();
  queueMicrotask(() => list.querySelector<HTMLElement>(`[data-move="${focused}"]`)?.focus({ preventScroll: true }));
  return {
    element,
    dispose: () => {
      window.removeEventListener('keydown', onKey);
      preview?.dispose();
    },
  };
}
