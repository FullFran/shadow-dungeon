import { ITEMS, type ItemId, type Rarity } from '../data/items';
import { t } from '../i18n';
import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * The pick-1-of-3 held item overlay shown on entering each floor after the
 * first (docs/gdd.md §3). Three cards (name, short description, rarity
 * colour), picked with a click or the 1/2/3 keys. Solo it is modal and the
 * simulation pauses (same policy as the Esc menu). In a shared run nothing
 * pauses: the overlay is a strip at the bottom of the screen, the player keeps
 * moving and rolling, and the cards are page elements above the canvas, so a
 * click on a card never reaches the game (no attack). Cards never take the
 * keyboard focus in a shared run, so Space keeps rolling.
 */
export interface PickCard {
  id: ItemId;
  name: string;
  description: string;
  rarity: Rarity;
  rarityLabel: string;
  /** "Llevas 1 de 3" when a stack is already held. */
  held: string | null;
}

const PICK_KEYS = [
  ['Digit1', 'Numpad1'],
  ['Digit2', 'Numpad2'],
  ['Digit3', 'Numpad3'],
];

/** Card index for a key code (1, 2, 3 on the top row or the keypad), or null. */
export function pickIndexForKey(code: string, cards: number): number | null {
  const index = PICK_KEYS.findIndex((codes) => codes.includes(code));
  return index >= 0 && index < cards ? index : null;
}

/** Solo pauses while the player picks; a shared run never does. */
export const pickPausesSimulation = (picking: boolean, shared: boolean): boolean => picking && !shared;

export function pickCards(offer: readonly ItemId[], owned: readonly ItemId[]): PickCard[] {
  return offer.map((id) => {
    const count = owned.filter((o) => o === id).length;
    return {
      id,
      name: t(`item.${id}`),
      description: t(`item.${id}.description`),
      rarity: ITEMS[id].rarity,
      rarityLabel: t(`rarity.${ITEMS[id].rarity}`),
      held: count > 0 ? t('pick.held').replace('{count}', String(count)).replace('{max}', String(ITEMS[id].maxStacks)) : null,
    };
  });
}

export { heldItems, type HeldItem } from '../adapters/hud';

/**
 * Shows the overlay inside `parent`; `onPick` gets the card index. Solo, the
 * cards are a cursor list (left/right or A/D, Enter/Space) next to the 1/2/3
 * keys the game handles; shared, the strip is mouse-only and nothing in it can
 * take the keyboard focus. Returns a function that removes it.
 */
export function openItemPick(parent: HTMLElement, cards: readonly PickCard[], shared: boolean, onPick: (index: number) => void): () => void {
  const overlay = h('div', { className: shared ? 'item-pick shared' : 'item-pick overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', t('pick.title'));
  const list = cursorList({
    layout: 'horizontal',
    keyboard: !shared,
    label: t('pick.title'),
    className: 'pick-row',
    items: cards.map((card, index) => ({
      className: `pick-card rarity-${card.rarity}`,
      label: h('span', { className: 'pick-body' }, [
        h('span', { className: 'pick-key', textContent: String(index + 1) }),
        h('strong', { className: 'pick-name', textContent: card.name }),
        h('span', { className: 'pick-rarity', textContent: card.rarityLabel }),
        h('span', { className: 'pick-description', textContent: card.description }),
        card.held ? h('span', { className: 'pick-held', textContent: card.held }) : null,
      ]),
      onConfirm: () => onPick(index),
    })),
  });
  // Mouse down too: the canvas below must not see the press (and nothing takes focus).
  list.element.addEventListener('mousedown', (e) => e.preventDefault());
  overlay.append(
    mdWindow({ title: t('pick.title'), className: 'pick-panel' }, [list.element, h('p', { className: 'pick-hint dim', textContent: t('pick.hint') })]),
  );
  parent.append(overlay);
  return () => {
    list.dispose();
    overlay.remove();
  };
}
