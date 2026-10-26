import { MATERIAL_TIERS, type MaterialTier } from '../data/player-evolutions';
import type { SpeciesId } from '../data/species';
import { canEvolve, evolutionOf, evolve, lineOf } from '../core/evolution';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { isTouchUi } from '../adapters/touch-mode';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Phantump's evolutions (odd/tasks/gacha-evolutions.md T5): an MD-style
 * window over the town with one row per owned gacha species, its next form,
 * the Pokémonedas and the materials it needs per tier (owned/needed, named
 * by the difficulty that drops them), and Evolve. An evolution is saved at
 * once. Costs come from data/player-evolutions.ts.
 */
export interface EvolveRow {
  species: SpeciesId;
  /** Its next form, null for a final form. */
  to: SpeciesId | null;
  coins: number;
  /** Materials owned and needed, per tier the step asks for (in tier order). */
  materials: { tier: MaterialTier; have: number; need: number }[];
  ready: boolean;
}

/** Every owned gacha species, in the order obtained, with what its next evolution costs. */
export function evolveRows(save: SaveData): EvolveRow[] {
  return (save.owned ?? []).map((species) => {
    const next = evolutionOf(species);
    if (!next) return { species, to: null, coins: 0, materials: [], ready: false };
    const have = save.materials?.[lineOf(species)] ?? {};
    const materials = MATERIAL_TIERS.filter((tier) => (next.materials[tier] ?? 0) > 0).map((tier) => ({ tier, have: have[tier] ?? 0, need: next.materials[tier]! }));
    return { species, to: next.to, coins: next.coins, materials, ready: canEvolve(save, species) };
  });
}

/** Evolves `species` in the stored save, written at once; null (nothing written) when it cannot. */
export function evolveAt(store: KeyValueStore, species: SpeciesId): SaveData | null {
  const save = loadSave(store);
  const evolved = evolve(save, species);
  if (!evolved) return null;
  writeSave(store, { ...save, ...evolved, owned: [...(evolved.owned ?? [])] });
  return loadSave(store);
}

/** "Normal 1/3 · Difícil 0/2". */
export const materialsText = (row: EvolveRow): string => row.materials.map((m) => `${t(`difficulty.${m.tier}`)} ${m.have}/${m.need}`).join(' · ');

export interface EvolveOptions {
  store: KeyValueStore;
  play?(sound: 'coin' | 'denied'): void;
  /** After an evolution (the app follows the selected species to its new form). */
  onEvolved?(from: SpeciesId, to: SpeciesId): void;
  onBack(): void;
}

export function evolveWindow(options: EvolveOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  const balance = h('div', { className: 'shop-balance' });
  const done = h('p', { className: 'gacha-reveal is-rare' });
  const describeLine = h('p', { className: 'dim' });
  const effect = h('div', { className: 'shop-effect' }, [done, describeLine]);
  /** The description of each list row (Back has none). */
  let describeAt: (string | null)[] = [];
  const describe = (index: number) => {
    describeLine.textContent = describeAt[index] ?? t(isTouchUi() ? 'shop.hint.touch' : 'evolve.hint');
  };

  const rowText = (row: EvolveRow) =>
    row.to === null
      ? t('evolve.final')
      : t('evolve.cost')
          .replace('{coins}', coinText(row.coins, (k) => t(k)))
          .replace('{materials}', materialsText(row))
          .replace('{species}', t(`species.${lineOf(row.species)}`));

  const items = (): ListItem[] => {
    const rows = evolveRows(save);
    const out: ListItem[] = [];
    describeAt = [];
    if (rows.length === 0) {
      out.push({ label: t('evolve.none'), className: 'shop-row is-disabled', onConfirm: () => options.play?.('denied') });
      describeAt.push(t('evolve.none.text'));
    }
    for (const row of rows) {
      const to = row.to;
      out.push({
        label: to ? t('evolve.row').replace('{from}', t(`species.${row.species}`)).replace('{to}', t(`species.${to}`)) : t(`species.${row.species}`),
        value: to ? coinText(row.coins, (k) => t(k)) : '-',
        className: row.ready ? 'shop-row' : 'shop-row is-disabled',
        tapToSelect: true,
        onConfirm: () => {
          const evolved = to ? evolveAt(options.store, row.species) : null;
          if (!evolved || !to) {
            options.play?.('denied');
            return;
          }
          options.play?.('coin');
          save = evolved;
          done.textContent = t('evolve.done').replace('{from}', t(`species.${row.species}`)).replace('{to}', t(`species.${to}`));
          options.onEvolved?.(row.species, to);
          refresh();
        },
      });
      describeAt.push(rowText(row));
    }
    out.push({ label: t('menu.back'), onConfirm: options.onBack });
    describeAt.push(null);
    return out;
  };

  const list = cursorList({ items: [], onBack: options.onBack, onCursor: describe, label: t('evolve.title'), className: 'shop-list' });

  function refresh(): void {
    balance.replaceChildren(statLine(t('screen.coins.balance'), coinText(save.coins, (k) => t(k))));
    list.setItems(items());
    describe(list.index());
  }

  refresh();
  const element = mdWindow({ title: t('evolve.title'), className: 'shop gacha' }, [h('p', { textContent: t('evolve.text') }), balance, list.element, effect]);
  return { element, dispose: () => list.dispose() };
}
