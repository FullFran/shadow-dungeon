import { awakeningsOf, MATERIAL_TIERS, type MaterialTier } from '../data/player-evolutions';
import type { SpeciesId } from '../data/species';
import { awakenedOf, rosterOf } from '../core/collection';
import { hasShiny, wearsShiny } from '../core/shiny';
import { canEvolve, evolutionOf, evolve, lineOf, nextStep } from '../core/evolution';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { isTouchUi } from '../adapters/touch-mode';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { description, describedMenu } from '../ui/describe';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { loadSave, wearShinyAt, writeSave, type SaveData } from './save';
import { bondLine } from './story';
import { storyKeys } from '../data/story-quests';
import type { ChallengeLine } from '../data/dungeons';

/**
 * Phantump's evolutions (odd/tasks/gacha-evolutions.md T5,
 * odd/tasks/roster-parity.md): an MD-style window over the town with one row
 * per species the player has that grows (the starters, an evolved one as its
 * current form, and the gacha species), its next form (or Mimikyu's next
 * awakening), the Pokémonedas and the materials it needs per tier
 * (owned/needed, named by the difficulty that drops them), and Evolve (or
 * Awaken). A step is saved at once. Costs come from
 * data/player-evolutions.ts. A "Desafíos" row opens the challenges menu
 * (app/challenges.ts), where the materials are won. A line with its shiny
 * skin unlocked gets an on/off row (odd/tasks/shiny-echo.md).
 */
export interface EvolveRow {
  species: SpeciesId;
  /** Its next form (itself for an awakening), null when it has no step left. */
  to: SpeciesId | null;
  /** The step is an awakening (Mimikyu): `awakened` steps taken of `steps`. */
  awaken?: { awakened: number; steps: number };
  coins: number;
  /** Materials owned and needed, per tier the step asks for (in tier order). */
  materials: { tier: MaterialTier; have: number; need: number }[];
  ready: boolean;
}

/** Whether `species` grows at all: it is in an evolution line or it awakens. */
const grows = (species: SpeciesId): boolean => lineOf(species) !== species || evolutionOf(species) !== null || awakeningsOf(species).length > 0;

/** Every species the player has that grows, in roster order (the starters first), with what its next step costs. */
export function evolveRows(save: SaveData): EvolveRow[] {
  return rosterOf(save)
    .filter(grows)
    .map((species) => {
      const steps = awakeningsOf(species).length;
      const awaken = steps > 0 ? { awaken: { awakened: awakenedOf(save, species), steps } } : {};
      const next = nextStep(save, species);
      if (!next) return { species, to: null, ...awaken, coins: 0, materials: [], ready: false };
      const have = save.materials?.[lineOf(species)] ?? {};
      const materials = MATERIAL_TIERS.filter((tier) => (next.materials[tier] ?? 0) > 0).map((tier) => ({ tier, have: have[tier] ?? 0, need: next.materials[tier]! }));
      return { species, to: evolutionOf(species)?.to ?? species, ...awaken, coins: next.coins, materials, ready: canEvolve(save, species) };
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
  /** Opens the challenges menu (a "Desafíos" row above Back; absent: no row). */
  onChallenges?(): void;
  onBack(): void;
}

/** The row's label: "Zorua → Zoroark", "Mimikyu · Despertar 1/2", or the species alone when it has no step left. */
export function rowLabel(row: EvolveRow): string {
  const name = t(`species.${row.species}`);
  if (row.awaken) return t('evolve.awaken.row').replace('{species}', name).replace('{n}', String(Math.min(row.awaken.awakened + 1, row.awaken.steps))).replace('{steps}', String(row.awaken.steps));
  return row.to ? t('evolve.row').replace('{from}', name).replace('{to}', t(`species.${row.to}`)) : name;
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

  /** The line's bond with you (its Senda's chapters closed): its newest line, and Phantump's word once the third is closed. */
  const bondText = (row: EvolveRow): string => {
    const line = lineOf(row.species) as ChallengeLine;
    const bond = bondLine(save, line);
    if (!bond) return '';
    const words = t('story.bond').replace('{n}', String(bond.level)).replace('{species}', t(`species.${row.species}`)).replace('{text}', t(bond.key));
    return bond.level >= 3 ? `${words} ${t(storyKeys.phantump(line))}` : words;
  };

  const rowText = (row: EvolveRow) => [rowCost(row), bondText(row)].filter(Boolean).join(' ');

  const rowCost = (row: EvolveRow) =>
    row.to === null
      ? t(row.awaken ? 'evolve.awaken.full' : 'evolve.final')
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
        label: rowLabel(row),
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
          done.textContent = row.awaken
            ? t('evolve.awaken.done').replace('{species}', t(`species.${row.species}`)).replace('{n}', String(row.awaken.awakened + 1)).replace('{steps}', String(row.awaken.steps))
            : t('evolve.done').replace('{from}', t(`species.${row.species}`)).replace('{to}', t(`species.${to}`));
          options.onEvolved?.(row.species, to);
          refresh();
        },
      });
      describeAt.push(rowText(row));
    }
    // The shiny skins, one row per line the player has with its skin unlocked.
    for (const species of rosterOf(save).filter((id) => hasShiny(save, id))) {
      const flip = () => {
        save = wearShinyAt(options.store, species, !wearsShiny(save, species));
        refresh();
      };
      out.push({ label: t('evolve.shiny.row').replace('{species}', t(`species.${species}`)), value: t(wearsShiny(save, species) ? 'menu.on' : 'menu.off'), onAdjust: flip, onConfirm: flip });
      describeAt.push(t('evolve.shiny.text'));
    }
    if (options.onChallenges) {
      out.push({ label: t('challenges.title'), onConfirm: options.onChallenges });
      describeAt.push(t('challenges.text'));
    }
    out.push({ label: t('menu.back'), onConfirm: options.onBack });
    describeAt.push(null);
    return out;
  };

  const list = cursorList({ items: [], onBack: options.onBack, onCursor: describe, label: t('evolve.title'), className: 'shop-list' });
  const desc = description(list, { describe, children: [effect] });

  function refresh(): void {
    balance.replaceChildren(statLine(t('screen.coins.balance'), coinText(save.coins, (k) => t(k))));
    list.setItems(items());
    desc.update();
  }

  refresh();
  const element = mdWindow({ title: t('evolve.title'), className: 'shop gacha' }, [h('p', { textContent: t('evolve.text') }), balance, describedMenu(list.element, desc.element)]);
  return { element, dispose: () => list.dispose() };
}
