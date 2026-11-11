import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { buyUpgrade, SHOP_ORDER, upgradeCost, upgradeLevel } from '../core/upgrades';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { isTouchUi } from '../adapters/touch-mode';
import { h, mdWindow } from '../ui/window';
import { coinText } from './coin-lines';
import { pixelIconSvg } from '../ui/pixel-icons';
import { loadSave, writeSave, type SaveData } from './save';
import { confirmDialog } from '../ui/confirm-dialog';
import { gridNav } from './window-nav';
import '../styles/evolve-shop.css';
import { deviceHint } from '../ui/device-hint';

/**
 * Poochyena's upgrade shop (docs/gdd.md §11), in the Pokémon picker's mould
 * (owner, 2026-11-03: "lo mismo que hemos hecho con los menús, botones y
 * selector de pokemon, para Evolución y Mejoras"): a card per permanent
 * upgrade (big icon, name, level gems, next cost or MAX) beside a large sheet
 * for the card in focus (icon, effect now and at the next level, gems, cost,
 * balance and the ember Buy button). Arrows move across the grid, Enter or a
 * click buys, Esc goes back; on touch a card takes two taps (the first shows
 * its sheet, the second buys). Fixed geometry. Opened from the town stall and
 * from the title menu.
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

/** What an upgrade does at `level` and at the next one ("PS máximos +4 → +8"); `next` is null when maxed. */
export function upgradeEffect(id: UpgradeId, level: number): { label: string; now: string; next: string | null } {
  const maxed = level >= UPGRADES[id].costs.length;
  return { label: t(`shop.stat.${id}`), now: bonusText(id, level), next: maxed ? null : bonusText(id, level + 1) };
}

/** Whether the next level can be bought, is out of reach by `missing` Pokémonedas, or is the last one already owned. */
export function buyState(save: Pick<SaveData, 'coins' | 'upgrades'>, id: UpgradeId): { kind: 'ready' | 'short' | 'max'; cost: number | null; missing: number } {
  const cost = upgradeCost(save.upgrades, id);
  if (cost === null) return { kind: 'max', cost: null, missing: 0 };
  return save.coins >= cost ? { kind: 'ready', cost, missing: 0 } : { kind: 'short', cost, missing: cost - save.coins };
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

/**
 * Buys the next level of `id` only after `ask` answers yes (owner, 2026-11-03: one click spent it).
 * Nothing is asked for a level that cannot be bought; the purchase re-reads the save after the answer.
 */
export async function confirmedPurchase(store: KeyValueStore, id: UpgradeId, ask: () => Promise<boolean>): Promise<SaveData | null> {
  if (buyState(loadSave(store), id).kind !== 'ready') return null;
  if (!(await ask())) return null;
  return purchase(store, id);
}

export interface ShopOptions {
  store: KeyValueStore;
  /** Purchase sound and refusal sound. */
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

/** A level as filled and empty gems, named for assistive tech. */
function levelGems(level: number, max: number): HTMLElement {
  const gems = h('span', { className: 'es-gems' }, Array.from({ length: max }, (_, i) => h('i', { className: i < level ? 'is-on' : '' })));
  gems.setAttribute('role', 'img');
  gems.setAttribute('aria-label', t('shop.level').replace('{level}', String(level)).replace('{max}', String(max)));
  return gems;
}

export function shopWindow(options: ShopOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  let focused: UpgradeId = SHOP_ORDER[0]!;
  const coin = (n: number) => coinText(n, (key) => t(key));

  const stage = h('div', { className: 'es-stage' });
  const name = h('h2', { className: 'es-name' });
  const gems = h('div', { className: 'es-gems-row' });
  const effect = h('div', { className: 'sh-effect' });
  const about = h('p', { className: 'es-text' });
  const chips = h('div', { className: 'es-chips' });
  const buy = h('button', { className: 'es-primary', type: 'button' });

  const cards = SHOP_ORDER.map((id) => {
    const card = h('button', { className: 'es-card sh-card', type: 'button' });
    card.dataset.upgrade = id;
    card.addEventListener('mouseenter', () => {
      if (!isTouchUi()) show(id);
    });
    card.addEventListener('focus', () => show(id));
    card.addEventListener('click', () => {
      // Touch: the first tap shows the sheet, the second buys (no purchase by a stray tap).
      if (isTouchUi() && focused !== id) show(id);
      else act(id);
    });
    return card;
  });

  /** A confirmation is open: a second press never stacks another. */
  let asking = false;

  /** Asks first (title, what changes, the cost); the coins leave only after Confirm. */
  function act(id: UpgradeId): void {
    if (asking) return;
    const state = buyState(save, id);
    if (state.kind !== 'ready') {
      options.play?.('denied');
      return;
    }
    const fx = upgradeEffect(id, upgradeLevel(save.upgrades, id));
    asking = true;
    void confirmedPurchase(options.store, id, () =>
      confirmDialog({
        title: t('shop.confirm.title'),
        body: t('shop.confirm.body').replace('{name}', t(`upgrade.${id}`)).replace('{stat}', fx.label).replace('{now}', fx.now).replace('{next}', fx.next ?? ''),
        confirmLabel: t('shop.buy'),
        cost: h('div', { className: 'rc-chips' }, [h('span', { className: 'es-chip es-chip-cost' }, [pixelIconSvg('coin', 'px-icon'), h('span', { textContent: coin(state.cost!) })])]),
      }),
    )
      .then((bought) => {
        if (!bought) return;
        options.play?.('coin');
        save = bought;
        show(id);
      })
      .finally(() => {
        asking = false;
      });
  }

  /** Redraws every card (the level, cost and affordability change after a purchase) and the sheet for `id`. */
  function show(id: UpgradeId): void {
    focused = id;
    const rows = shopRows(save);
    for (const card of cards) {
      const row = rows.find((r) => r.id === card.dataset.upgrade)!;
      const state = buyState(save, row.id);
      card.classList.toggle('is-focused', row.id === id);
      card.classList.toggle('is-max', state.kind === 'max');
      card.setAttribute('aria-label', `${row.name}, ${t('shop.level').replace('{level}', String(row.level)).replace('{max}', String(row.max))}, ${row.cost === null ? t('shop.max') : coin(row.cost)}`);
      card.replaceChildren(
        h('span', { className: 'sh-card-art' }, [pixelIconSvg(row.id, 'px-icon sh-icon')]),
        h('span', { className: 'es-card-name', textContent: row.name }),
        levelGems(row.level, row.max),
        h('span', { className: `es-cost${state.kind === 'short' ? ' is-short' : ''}`, textContent: row.cost === null ? t('shop.max') : coin(row.cost) }),
      );
    }
    const row = rows.find((r) => r.id === id)!;
    const state = buyState(save, id);
    const fx = upgradeEffect(id, row.level);
    stage.replaceChildren(h('div', { className: 'es-stage-glow' }), h('div', { className: 'sh-stage-icon' }, [pixelIconSvg(id, 'px-icon sh-icon-big')]), h('div', { className: 'es-stage-sign' }));
    name.textContent = row.name;
    gems.replaceChildren(levelGems(row.level, row.max), h('span', { className: 'es-level', textContent: t('shop.level').replace('{level}', String(row.level)).replace('{max}', String(row.max)) }));
    effect.replaceChildren(
      h('span', { className: 'sh-effect-label', textContent: fx.label }),
      h('span', { className: 'sh-effect-line' }, [
        h('span', { className: 'sh-effect-now', textContent: fx.now }),
        ...(fx.next ? [h('span', { className: 'sh-effect-arrow', textContent: '→' }), h('span', { className: 'sh-effect-next', textContent: fx.next })] : [h('span', { className: 'sh-effect-max', textContent: t('shop.maxed') })]),
      ]),
    );
    about.textContent = t(`upgrade.${id}.effect`).replace('{per}', bonusText(id, 1));
    chips.replaceChildren(
      h('span', { className: 'es-chip es-chip-balance' }, [pixelIconSvg('coin', 'px-icon'), h('span', { textContent: `${t('screen.coins.balance')} ${coin(save.coins)}` })]),
      ...(state.cost !== null ? [h('span', { className: `es-chip es-chip-cost${state.kind === 'short' ? ' is-short' : ''}`, textContent: `${t('shop.cost')} ${coin(state.cost)}` })] : []),
    );
    buy.classList.toggle('is-blocked', state.kind !== 'ready');
    buy.setAttribute('aria-disabled', String(state.kind !== 'ready'));
    buy.replaceChildren(
      ...(state.kind === 'ready' ? [pixelIconSvg('coin', 'px-icon'), h('span', { textContent: t('shop.buy') })] : [h('span', { textContent: state.kind === 'max' ? t('shop.maxed') : t('shop.short').replace('{n}', coin(state.missing)) })]),
    );
  }
  buy.addEventListener('click', () => act(focused));

  const grid = h('div', { className: 'es-grid sh-grid' }, cards);
  grid.setAttribute('aria-label', t('shop.title'));
  const back = h('button', { className: 'es-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());

  const sheet = h('section', { className: 'es-sheet' }, [stage, name, gems, effect, about, chips, buy]);
  const element = mdWindow({ title: t('shop.title'), className: 'es-window sh-window' }, [
    h('p', { className: 'dim es-context', textContent: t('shop.text') }),
    h('div', { className: 'es-body' }, [sheet, grid]),
    h('div', { className: 'es-foot' }, [back, deviceHint('es-hint', 'shop.hint')]),
  ]);

  const stopKeys = gridNav({
    win: element,
    controls: () => [...cards, buy, back],
    fallback: () => cards.find((c) => c.dataset.upgrade === focused),
    onBack: options.onBack,
  });

  show(focused);
  queueMicrotask(() => cards.find((c) => c.dataset.upgrade === focused)?.focus({ preventScroll: true }));
  return { element, dispose: stopKeys };
}
