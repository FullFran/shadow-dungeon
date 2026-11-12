import type { BagSlot } from '../core/consumable-stock';
import type { ConsumableId } from '../data/consumables';
import { CONSUMABLE_ICONS } from './icons/consumable-icons';
import { pixelSvgOf } from './pixel-icons';
import { h } from './window';
import '../styles/bag.css';

/**
 * The bag in a run (odd/tasks/items-bag.md): its slots at the top centre, each with the consumable's icon and units,
 * the selected one framed, and the key that uses it. A click or tap on a slot selects it; on the selected slot it
 * uses it (two taps, so a stray one never spends a unit). Drawn only while the run has a bag; never in the shrine.
 */
export interface BagHud {
  /** Redraws when something changed: the slots, the selection, the key label, a passive (the sprout) marked. */
  update(bag: readonly (BagSlot | null)[], selected: number, keyLabel: string | null, name: (id: ConsumableId) => string): void;
  dispose(): void;
}

export function mountBagHud(parent: HTMLElement, onTap: (index: number) => void): BagHud {
  const element = h('div', { className: 'bag-hud' });
  element.setAttribute('role', 'group');
  parent.append(element);
  let drawn = '';
  return {
    update(bag, selected, keyLabel, name) {
      const key = JSON.stringify([bag, selected, keyLabel]);
      if (key === drawn) return;
      drawn = key;
      element.hidden = bag.every((slot) => slot === null);
      element.replaceChildren(
        ...bag.map((slot, i) => {
          const button = h('button', { className: `bag-hud-slot${i === selected ? ' is-selected' : ''}${slot ? '' : ' is-empty'}`, type: 'button' }, slot ? [pixelSvgOf(CONSUMABLE_ICONS[slot.id], 'px-icon'), h('span', { className: 'bag-hud-count', textContent: `×${slot.count}` })] : []);
          if (slot) button.setAttribute('aria-label', `${name(slot.id)} ×${slot.count}`);
          button.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onTap(i);
          });
          return button;
        }),
        ...(keyLabel ? [h('span', { className: 'bag-hud-key', textContent: keyLabel })] : []),
      );
    },
    dispose() {
      element.remove();
    },
  };
}
