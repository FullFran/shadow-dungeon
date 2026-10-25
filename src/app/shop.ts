import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { buyUpgrade, SHOP_ORDER, upgradeCost, upgradeLevel } from '../core/upgrades';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Poochyena's upgrade shop (docs/gdd.md §11): an MD-style window with the
 * balance, one cursor row per permanent upgrade (name, level, next cost) and
 * the effect text of the row under the cursor. Enter buys the next level;
 * rows the balance cannot pay (or maxed) show disabled and only play the
 * denied sound, but the cursor still stops on them so their effect can be
 * read. Opened from the town stall and from the title menu.
 */
export interface ShopRow {
  id: UpgradeId;
  name: string;
  level: number;
  max: number;
  /** Next level's cost, null when maxed. */
  cost: number | null;
  affordable: boolean;
  /** "PS máximos +4 por nivel. Ahora: +8." */
  effect: string;
}

/** A bonus of `level` levels of `id` in its unit: "+12", "+10 %", "+8 ms". */
export function bonusText(id: UpgradeId, level: number): string {
  const { perLevel, unit } = UPGRADES[id];
  if (unit === 'percent') return `+${Math.round(perLevel * level * 100)} %`;
  if (unit === 'ms') return `+${perLevel * level} ms`;
  return `+${perLevel * level}`;
}

export function shopRows(save: SaveData): ShopRow[] {
  return SHOP_ORDER.map((id) => {
    const level = upgradeLevel(save.upgrades, id);
    const cost = upgradeCost(save.upgrades, id);
    const effect = t(`upgrade.${id}.effect`).replace('{per}', bonusText(id, 1)) + ' ' + t('shop.now').replace('{bonus}', level > 0 ? bonusText(id, level) : '-');
    return { id, name: t(`upgrade.${id}`), level, max: UPGRADES[id].costs.length, cost, affordable: cost !== null && save.coins >= cost, effect };
  });
}

/** Buys the next level of `id` from the stored save; the new save, or null (and nothing written) when refused. */
export function purchase(store: KeyValueStore, id: UpgradeId): SaveData | null {
  const save = loadSave(store);
  const wallet = buyUpgrade(save, id);
  if (!wallet) return null;
  const next: SaveData = { ...save, ...wallet };
  writeSave(store, next);
  return next;
}

export interface ShopOptions {
  store: KeyValueStore;
  /** Purchase sound and refusal sound. */
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

export function shopWindow(options: ShopOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  const balance = h('div', { className: 'shop-balance' });
  const effect = h('p', { className: 'shop-effect dim' });
  let rows = shopRows(save);

  const describe = (index: number) => {
    const row = rows[index];
    effect.textContent = row ? row.effect : t('shop.hint');
  };

  const items = (): ListItem[] => [
    ...rows.map(
      (row): ListItem => ({
        label: `${row.name} ${t('shop.level').replace('{level}', String(row.level)).replace('{max}', String(row.max))}`,
        value: row.cost === null ? t('shop.max') : coinText(row.cost, (key) => t(key)),
        className: row.affordable ? 'shop-row' : 'shop-row is-disabled',
        onConfirm: () => {
          const bought = purchase(options.store, row.id);
          if (!bought) {
            options.play?.('denied');
            return;
          }
          options.play?.('coin');
          save = bought;
          refresh();
        },
      }),
    ),
    { label: t('menu.back'), onConfirm: options.onBack },
  ];

  const list = cursorList({ items: items(), onBack: options.onBack, onCursor: describe, label: t('shop.title'), className: 'shop-list' });

  function refresh(): void {
    rows = shopRows(save);
    balance.replaceChildren(statLine(t('screen.coins.balance'), coinText(save.coins, (key) => t(key))));
    list.setItems(items());
    describe(list.index());
  }

  refresh();
  const element = mdWindow({ title: t('shop.title'), className: 'shop' }, [h('p', { textContent: t('shop.text') }), balance, list.element, effect]);
  return { element, dispose: () => list.dispose() };
}
