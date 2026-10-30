import { cursorList } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';

/**
 * A floor event's choice (the eclipse shrine's pact, the merchant echo's
 * wares): a few cards in the item pick's look, picked with a click, the
 * cursor or 1/2/3. Solo it is modal and the run pauses (the game decides);
 * in a shared run it is a strip that never takes the keyboard.
 */
export interface SimaChoiceOption {
  name: string;
  description: string;
  /** Card colour, as the item rarities: `rare` for the blessing, `common` to leave... */
  look: 'common' | 'uncommon' | 'rare';
  disabled?: boolean;
}

export function openSimaChoice(
  parent: HTMLElement,
  title: string,
  hint: string,
  options: readonly SimaChoiceOption[],
  shared: boolean,
  onPick: (index: number) => void,
  onBack: () => void,
): () => void {
  const overlay = h('div', { className: shared ? 'item-pick shared' : 'item-pick overlay' });
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', title);
  const list = cursorList({
    layout: 'horizontal',
    keyboard: !shared,
    label: title,
    className: 'pick-row',
    onBack,
    items: options.map((option, index) => ({
      className: `pick-card rarity-${option.look}`,
      disabled: option.disabled === true,
      label: h('span', { className: 'pick-body' }, [
        h('span', { className: 'pick-key', textContent: String(index + 1) }),
        h('strong', { className: 'pick-name', textContent: option.name }),
        h('span', { className: 'pick-description', textContent: option.description }),
      ]),
      onConfirm: () => onPick(index),
    })),
  });
  list.element.addEventListener('mousedown', (e) => e.preventDefault());
  overlay.append(mdWindow({ title, className: 'pick-panel' }, [list.element, h('p', { className: 'pick-hint dim', textContent: hint })]));
  parent.append(overlay);
  return () => {
    list.dispose();
    overlay.remove();
  };
}
