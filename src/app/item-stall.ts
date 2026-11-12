import type { KeyValueStore } from '../adapters/storage';
import type { ItemPullResult } from '../core/consumable-stock';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { describedMenu, description } from '../ui/describe';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { consumableIcon } from './loadout-bag-view';
import { itemStallInfo, shopRowsOf } from './item-stall-model';
import { buyConsumableAt, itemPullAt, loadSave } from './save';
import '../styles/bag.css';

/**
 * The item stall (odd/tasks/items-bag.md), beside the Pokémon gacha in the town: the balance, one Pull row (the item
 * gacha: its price, odds and pity from data/consumables.ts `ITEM_GACHA`), then one row per unlocked consumable at
 * its fixed price with the units owned (owner's option 1a: the gacha unlocks kinds, the rows sell the unlocked
 * ones). Every pull and purchase is saved at once; the line under the list tells what the last one gave.
 */
export interface ItemStallOptions {
  store: KeyValueStore;
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

const coins = (n: number): string => coinText(n, (k) => t(k));

/** "Tónico de rocío ×3 (¡nuevo!)", or with the Pokémonedas back for units over the cap. */
export function pullText(result: ItemPullResult): string {
  const name = t(`consumable.${result.id}`);
  const base = t('stall.reveal').replace('{name}', name).replace('{n}', String(result.units)).replace('{rarity}', t(`stall.rarity.${result.rarity}`));
  const unlocked = result.unlocked ? ` ${t('stall.unlocked')}` : '';
  const refund = result.refund > 0 ? ` ${t('stall.refund').replace('{coins}', coins(result.refund))}` : '';
  return `${base}${unlocked}${refund}`;
}

export function itemStallWindow(options: ItemStallOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  const balance = h('div', { className: 'shop-balance' });
  const reveal = h('p', { className: 'stall-reveal' });
  reveal.setAttribute('role', 'status');
  const about = h('p', { className: 'stall-about' });
  const list = cursorList({ items: [], onBack: options.onBack, label: t('stall.title'), className: 'shop-list', onCursor: (i) => desc.show(i) });
  // The description box keeps the size of the longest one (src/ui/describe.ts): rows never move under the cursor.
  const desc = description(list, { describe: (i) => describe(i), children: [about] });

  /** The row under the cursor: the pull's odds, or a kind's description. */
  function describe(index: number): void {
    if (index === 0) {
      const info = itemStallInfo(save);
      about.textContent = info.rates.map((r) => `${t(`stall.rarity.${r.rarity}`)} ${r.percent} %`).join(' · ');
      return;
    }
    const row = shopRowsOf(save)[index - 1];
    about.textContent = row ? t(`consumable.${row.id}.about`) : '';
  }

  function refresh(): void {
    const info = itemStallInfo(save);
    balance.replaceChildren(
      statLine(t('screen.coins.balance'), coins(save.coins)),
      statLine(t('stall.pity.uncommon'), t('gacha.pulls').replace('{n}', String(info.uncommonLeft))),
      statLine(t('stall.pity.rare'), t('gacha.pulls').replace('{n}', String(info.rareLeft))),
    );
    const items: ListItem[] = [
      {
        label: t('stall.pull'),
        value: coins(info.cost),
        className: info.canPull ? 'shop-row' : 'shop-row is-disabled',
        onConfirm: () => {
          const pulled = itemPullAt(options.store, (Math.random() * 2 ** 31) | 0);
          if (!pulled) return options.play?.('denied');
          options.play?.('coin');
          save = pulled.save;
          reveal.className = `stall-reveal is-${pulled.result.rarity}`;
          reveal.textContent = pullText(pulled.result);
          refresh();
        },
      },
      ...shopRowsOf(save).map(
        (row): ListItem => ({
          label: h('span', { className: 'stall-row-name' }, [consumableIcon(row.id), h('span', { textContent: `${t('stall.buy')} ${t(`consumable.${row.id}`)}` })]),
          value: `${coins(row.price)} · ${t('bag.stock').replace('{n}', String(row.stock))}`,
          className: `stall-row${row.affordable ? '' : ' is-disabled'}`,
          onConfirm: () => {
            const next = buyConsumableAt(options.store, row.id);
            if (!next) return options.play?.('denied');
            options.play?.('coin');
            save = next;
            reveal.className = 'stall-reveal';
            reveal.textContent = t('stall.bought').replace('{name}', t(`consumable.${row.id}`));
            refresh();
          },
        }),
      ),
      { label: t('menu.back'), onConfirm: options.onBack },
    ];
    list.setItems(items);
    desc.update();
  }

  refresh();
  const element = mdWindow({ title: t('stall.title'), className: 'shop item-stall' }, [h('p', { textContent: t('stall.intro') }), balance, reveal, describedMenu(list.element, desc.element)]);
  return { element, dispose: () => list.dispose() };
}
