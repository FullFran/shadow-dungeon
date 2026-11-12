import { CONSUMABLES, type ConsumableId } from '../data/consumables';
import type { Difficulty } from '../data/difficulty';
import type { ConsumableWallet } from '../core/consumable-stock';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { describedMenu, description } from '../ui/describe';
import { CONSUMABLE_ICONS } from '../ui/icons/consumable-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h, mdWindow } from '../ui/window';
import { bagRows, toggleBag, type BagPick } from './bag-model';
import '../styles/bag.css';

/**
 * The loadout's third step, the bag (odd/tasks/items-bag.md): three slot tiles, then one row per unlocked kind with
 * the units owned (a confirm packs it in the first empty slot or takes it out), its description under the list, then
 * Start and Back. Only the units used in the run leave the stock; a kind with none owned, or the revive on
 * Nightmare, cannot go in. The pick is remembered in the settings (`bag`) by the caller.
 */
export interface BagStepOptions {
  wallet: Pick<ConsumableWallet, 'stock' | 'unlockedConsumables'>;
  bag: BagPick;
  /** The run's tier (the revive never goes in on Nightmare). */
  tier: Difficulty;
  onChange(bag: (ConsumableId | null)[]): void;
  onStart(): void;
  onBack(): void;
  startLabel?: string;
  context?: string;
}

export const consumableIcon = (id: ConsumableId, className = 'px-icon'): SVGSVGElement => pixelSvgOf(CONSUMABLE_ICONS[id], className);

export function bagStep(options: BagStepOptions): HTMLElement {
  let bag: BagPick = options.bag;
  const slots = h('div', { className: 'bag-slots' });
  slots.setAttribute('aria-label', t('bag.slots'));
  const about = h('p', { className: 'bag-about' });
  const list = cursorList({ items: [], onBack: options.onBack, label: t('bag.title'), className: 'bag-list', onCursor: (i) => desc.show(i) });
  // The description box keeps the size of the longest one (src/ui/describe.ts): rows never move under the cursor.
  const desc = description(list, { describe: (i) => describe(i), children: [about] });

  const describe = (index: number): void => {
    const row = bagRows(options.wallet, bag, options.tier)[index];
    if (!row) {
      about.textContent = t('bag.note');
      return;
    }
    const barred = row.id === 'second-sprout' && options.tier === 'nightmare' ? ` ${t('bag.nightmare')}` : '';
    about.textContent = `${t(`consumable.${row.id}.about`)}${barred}`;
  };

  function redraw(): void {
    slots.replaceChildren(
      ...bag.map((id) =>
        h('div', { className: `bag-slot${id ? ' is-full' : ''}` }, id ? [consumableIcon(id), h('span', { textContent: t(`consumable.${id}`) })] : [h('span', { className: 'dim', textContent: t('bag.empty') })]),
      ),
    );
    const rows = bagRows(options.wallet, bag, options.tier);
    const items: ListItem[] = rows.map((row) => ({
      label: h('span', { className: 'bag-row-name' }, [consumableIcon(row.id), h('span', { textContent: t(`consumable.${row.id}`) })]),
      value: row.packed ? t('bag.packed').replace('{n}', String(Math.min(row.stock, CONSUMABLES[row.id].perSlot))) : t('bag.stock').replace('{n}', String(row.stock)),
      className: `bag-row${row.usable ? '' : ' is-disabled'}${row.packed ? ' is-packed' : ''}`,
      onConfirm: () => {
        if (!row.usable && !row.packed) return;
        bag = toggleBag(bag, row.id);
        options.onChange([...bag]);
        redraw();
      },
    }));
    items.push({ label: options.startLabel ?? t('menu.start'), className: 'bag-start', onConfirm: options.onStart }, { label: t('menu.back'), onConfirm: options.onBack });
    list.setItems(items);
    desc.update();
  }
  redraw();
  const empty = bagRows(options.wallet, bag, options.tier).every((r) => r.stock === 0);
  return mdWindow({ title: t('bag.title'), className: 'bag-step' }, [
    ...(options.context ? [h('p', { className: 'dim', textContent: options.context })] : []),
    h('p', { className: 'dim', textContent: t(empty ? 'bag.none' : 'bag.note') }),
    slots,
    describedMenu(list.element, desc.element),
  ]);
}
