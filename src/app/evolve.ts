import { awakeningsOf, MATERIAL_TIERS, type MaterialTier } from '../data/player-evolutions';
import type { SheetStore } from '../adapters/assets';
import type { SpeciesId } from '../data/species';
import { awakenedOf, rosterOf } from '../core/collection';
import { hasShiny, wearsShiny } from '../core/shiny';
import { canEvolve, evolutionOf, evolve, lineOf, nextStep, stageOf } from '../core/evolution';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { isTouchUi } from '../adapters/touch-mode';
import { h, mdWindow } from '../ui/window';
import { pixelIconSvg, pixelSvgOf } from '../ui/pixel-icons';
import { EVOLVE_SHOP_ICONS } from '../ui/icons/evolve-shop-icons';
import { coinText } from './coin-lines';
import { loadSave, wearShinyAt, writeSave, type SaveData } from './save';
import { bondLine } from './story';
import { storyKeys } from '../data/story-quests';
import type { ChallengeLine } from '../data/dungeons';
import { portrait } from './loadout';
import { confirmDialog } from '../ui/confirm-dialog';
import { gridNav } from './window-nav';
import { attachPager } from '../ui/pager';
import '../styles/evolve-shop.css';
import { deviceHint } from '../ui/device-hint';

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

/**
 * Evolves (or awakens) `species` only after `ask` answers yes (owner, 2026-11-03: "de un click te lo gastas").
 * Nothing is asked for a step that cannot be taken; the save is re-read after the answer. Null when cancelled or refused.
 */
export async function confirmedEvolve(store: KeyValueStore, species: SpeciesId, ask: () => Promise<boolean>): Promise<SaveData | null> {
  const row = evolveRows(loadSave(store)).find((r) => r.species === species);
  if (!row?.to || !row.ready) return null;
  if (!(await ask())) return null;
  return evolveAt(store, species);
}

/** "Normal 1/3 · Difícil 0/2". */
export const materialsText = (row: EvolveRow): string => row.materials.map((m) => `${t(`difficulty.${m.tier}`)} ${m.have}/${m.need}`).join(' · ');


/** The forms of `species`' line, first to last (a species outside a line is alone). */
export function evolutionChain(species: SpeciesId): SpeciesId[] {
  const chain: SpeciesId[] = [lineOf(species)];
  for (let next = evolutionOf(chain[chain.length - 1]!); next; next = evolutionOf(next.to)) chain.push(next.to);
  return chain;
}

/** The line as the sheet draws it: each form, known when the player has reached it (the ones ahead are dark silhouettes). */
export function chainView(species: SpeciesId): { species: SpeciesId; known: boolean }[] {
  const at = stageOf(species);
  return evolutionChain(species).map((form, i) => ({ species: form, known: i <= at }));
}

/** The stage dots of a card: forms reached of the line, or awakenings taken plus the base form for one that awakens. */
export function stageDots(row: EvolveRow): { filled: number; total: number } {
  if (row.awaken) return { filled: Math.min(row.awaken.awakened + 1, row.awaken.steps + 1), total: row.awaken.steps + 1 };
  return { filled: stageOf(row.species) + 1, total: evolutionChain(row.species).length };
}

export type EvolveBlock = { kind: 'ready' } | { kind: 'final' } | { kind: 'materials'; missing: { tier: MaterialTier; short: number }[] } | { kind: 'coins'; short: number };

/** What stops the step of `row` with `coins` in the purse: nothing, no step left, essences short per tier, or coins short. */
export function evolveBlock(row: EvolveRow, coins: number): EvolveBlock {
  if (row.to === null) return { kind: 'final' };
  const missing = row.materials.filter((m) => m.have < m.need).map((m) => ({ tier: m.tier, short: m.need - m.have }));
  if (missing.length > 0) return { kind: 'materials', missing };
  if (coins < row.coins) return { kind: 'coins', short: row.coins - coins };
  return { kind: 'ready' };
}

export interface EvolveOptions {
  store: KeyValueStore;
  /** The sprite sheets the portraits animate from. */
  sheets: Promise<SheetStore>;
  play?(sound: 'coin' | 'denied'): void;
  /** After an evolution (the app follows the selected species to its new form). */
  onEvolved?(from: SpeciesId, to: SpeciesId): void;
  /** Opens the challenges menu (a "Desafíos" button beside Back; absent: none). */
  onChallenges?(): void;
  onBack(): void;
}

/** The row's label: "Zorua → Zoroark", "Mimikyu · Despertar 1/2", or the species alone when it has no step left. */
export function rowLabel(row: EvolveRow): string {
  const name = t(`species.${row.species}`);
  if (row.awaken) return t('evolve.awaken.row').replace('{species}', name).replace('{n}', String(Math.min(row.awaken.awakened + 1, row.awaken.steps))).replace('{steps}', String(row.awaken.steps));
  return row.to ? t('evolve.row').replace('{from}', name).replace('{to}', t(`species.${row.to}`)) : name;
}

/** Stage dots, filled for the forms reached. */
function dots(filled: number, total: number): HTMLElement {
  const el = h('span', { className: 'es-gems ev-dots' }, Array.from({ length: total }, (_, i) => h('i', { className: i < filled ? 'is-on' : '' })));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', t('evolve.stage').replace('{n}', String(filled)).replace('{total}', String(total)));
  return el;
}

/**
 * Phantump's window in the Pokémon picker's mould (owner, 2026-11-03): a card
 * per species that grows (animated sprite, name, stage dots, lit when it can
 * take its step) beside a large sheet for the card in focus: the line as
 * sprites with arrows (forms not reached yet as dark silhouettes), what the
 * step costs against what the player has, and one ember button (Evolucionar,
 * Despertar, or the reason it cannot). Arrows move across the grid, Enter or a
 * click acts, Esc goes back; on touch the first tap shows the sheet.
 */
export function evolveWindow(options: EvolveOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  let focused: SpeciesId | null = null;
  /** The last step taken, shown in the note until focus moves. */
  let done: { species: SpeciesId; text: string } | null = null;
  let cards: HTMLButtonElement[] = [];
  const coin = (n: number) => coinText(n, (k) => t(k));

  const stage = h('div', { className: 'es-stage ev-stage' });
  const name = h('h2', { className: 'es-name' });
  const dotsRow = h('div', { className: 'es-gems-row' });
  const needs = h('div', { className: 'ev-needs' });
  const note = h('p', { className: 'es-text ev-note' });
  const primary = h('button', { className: 'es-primary', type: 'button' });
  const shiny = h('button', { className: 'es-back ev-aux', type: 'button' });
  const challenges = options.onChallenges ? h('button', { className: 'es-back ev-aux', type: 'button', textContent: t('challenges.title') }) : null;
  const grid = h('div', { className: 'es-grid ev-grid' });
  grid.setAttribute('aria-label', t('evolve.title'));
  // Phones: the cards that do not fit become pages, their buttons in the foot (src/ui/pager.ts; idle on desktop).
  const pageNav = h('span', { className: 'es-pages' });
  const pager = attachPager(grid, { nav: pageNav });
  const pageButtons = (): HTMLElement[] => (pageNav.hidden ? [] : [...pageNav.querySelectorAll<HTMLElement>('button')]);

  /** The line's bond with you (its Senda's chapters closed): its newest line, and Phantump's word once the third is closed. */
  const bondText = (row: EvolveRow): string => {
    const line = lineOf(row.species) as ChallengeLine;
    const bond = bondLine(save, line);
    if (!bond) return '';
    const words = t('story.bond').replace('{n}', String(bond.level)).replace('{species}', t(`species.${row.species}`)).replace('{text}', t(bond.key));
    return bond.level >= 3 ? `${words} ${t(storyKeys.phantump(line))}` : words;
  };

  const need = (icon: SVGSVGElement, label: string, have: number, wanted: number): HTMLElement => {
    const short = Math.max(0, wanted - have);
    return h('div', { className: `ev-need${short > 0 ? ' is-short' : ' is-met'}` }, [
      icon,
      h('span', { className: 'ev-need-label', textContent: label }),
      h('span', { className: 'ev-need-count', textContent: `${have} / ${wanted}` }),
      h('span', { className: 'ev-need-short', textContent: short > 0 ? `−${short}` : '' }),
    ]);
  };

  /** The sprites of the line with an arrow between each; the ones not reached are dark silhouettes. */
  const chainOf = (row: EvolveRow): HTMLElement => {
    const parts: HTMLElement[] = [];
    chainView(row.species).forEach((form, i) => {
      if (i > 0) parts.push(h('span', { className: 'ev-arrow' }, [pixelSvgOf(EVOLVE_SHOP_ICONS.arrow!, 'px-icon')]));
      const sprite = h('span', { className: `ev-form sprite-box${form.known ? (form.species === row.species ? ' is-current' : '') : ' is-unknown'}` }, [portrait(options.sheets, form.species, 3, form.known && wearsShiny(save, form.species))]);
      sprite.setAttribute('role', 'img');
      sprite.setAttribute('aria-label', form.known ? t(`species.${form.species}`) : t('evolve.unknown'));
      parts.push(sprite);
    });
    if (row.awaken) {
      const taken = row.awaken.awakened;
      const steps = Array.from({ length: row.awaken.steps }, (_, i) => h('span', { className: `ev-spark${i < taken ? ' is-on' : ''}` }, [pixelSvgOf(EVOLVE_SHOP_ICONS.awaken!, 'px-icon')]));
      parts.push(h('span', { className: 'ev-sparks' }, steps));
    }
    return h('div', { className: 'ev-chain' }, parts);
  };

  const cardOf = (row: EvolveRow): HTMLButtonElement => {
    const { filled, total } = stageDots(row);
    const card = h('button', { className: `es-card ev-card${row.ready ? ' is-ready' : ''}`, type: 'button' }, [
      h('span', { className: 'es-card-art sprite-box' }, [portrait(options.sheets, row.species, 2, wearsShiny(save, row.species))]),
      h('span', { className: 'es-card-name', textContent: t(`species.${row.species}`) }),
      dots(filled, total),
      ...(row.ready ? [h('span', { className: 'es-card-tag', textContent: t('evolve.ready') })] : []),
    ]);
    card.dataset.species = row.species;
    card.setAttribute('aria-label', `${rowLabel(row)}${row.ready ? `, ${t('evolve.ready')}` : ''}`);
    card.addEventListener('mouseenter', () => {
      if (!isTouchUi()) show(row.species);
    });
    card.addEventListener('focus', () => show(row.species));
    card.addEventListener('click', () => {
      // Touch: the first tap shows the sheet, the second acts (no step by a stray tap).
      if (isTouchUi() && focused !== row.species) show(row.species);
      else act(row.species);
    });
    return card;
  };

  /** A confirmation is open: a second press never stacks another. */
  let asking = false;

  /** The costs of a step as chips: Pokémonedas, then each essence tier. */
  const costChips = (row: EvolveRow): HTMLElement =>
    h('div', { className: 'rc-chips' }, [
      h('span', { className: 'es-chip es-chip-cost' }, [pixelIconSvg('coin', 'px-icon'), h('span', { textContent: coin(row.coins) })]),
      ...row.materials.map((m) => h('span', { className: 'es-chip es-chip-cost' }, [pixelSvgOf(EVOLVE_SHOP_ICONS[`essence-${m.tier}`]!, 'px-icon'), h('span', { textContent: `${m.need} ${t(`difficulty.${m.tier}`)}` })])),
    ]);

  /** Asks first; the coins and essences leave only after Confirm. */
  function act(species: SpeciesId): void {
    if (asking) return;
    const row = evolveRows(save).find((r) => r.species === species);
    const to = row?.to;
    if (!row || !to || !row.ready) {
      options.play?.('denied');
      return;
    }
    const from = t(`species.${species}`);
    const step = row.awaken ? { n: String(row.awaken.awakened + 1), steps: String(row.awaken.steps) } : null;
    asking = true;
    void confirmedEvolve(options.store, species, () =>
      confirmDialog({
        title: t(row.awaken ? 'evolve.confirm.awaken.title' : 'evolve.confirm.title'),
        body: row.awaken ? t('evolve.confirm.awaken.body').replace('{species}', from).replace('{n}', step!.n).replace('{steps}', step!.steps) : t('evolve.confirm.body').replace('{from}', from).replace('{to}', t(`species.${to}`)),
        confirmLabel: t(row.awaken ? 'evolve.btn.awaken' : 'evolve.btn.evolve'),
        cost: costChips(row),
      }),
    )
      .then((evolved) => {
        if (!evolved) return;
        options.play?.('coin');
        save = evolved;
        done = {
          species: to,
          text: row.awaken
            ? t('evolve.awaken.done').replace('{species}', from).replace('{n}', step!.n).replace('{steps}', step!.steps)
            : t('evolve.done').replace('{from}', from).replace('{to}', t(`species.${to}`)),
        };
        options.onEvolved?.(species, to);
        focused = to;
        render();
        cards.find((c) => c.dataset.species === to)?.focus({ preventScroll: true });
      })
      .finally(() => {
        asking = false;
      });
  }

  /** Redraws the sheet for `species`. */
  function show(species: SpeciesId): void {
    const rows = evolveRows(save);
    const row = rows.find((r) => r.species === species) ?? rows[0];
    if (!row) return;
    if (done && done.species !== row.species) done = null;
    focused = row.species;
    for (const card of cards) card.classList.toggle('is-focused', card.dataset.species === row.species);
    stage.replaceChildren(h('div', { className: 'es-stage-glow' }), chainOf(row));
    name.textContent = t(`species.${row.species}`);
    const { filled, total } = stageDots(row);
    dotsRow.replaceChildren(dots(filled, total), h('span', { className: 'es-level', textContent: row.awaken ? rowLabel(row) : t('evolve.stage').replace('{n}', String(filled)).replace('{total}', String(total)) }));
    const block = evolveBlock(row, save.coins);
    needs.replaceChildren(
      ...(row.to === null
        ? [h('p', { className: 'ev-final', textContent: t(row.awaken ? 'evolve.awaken.full' : 'evolve.final') })]
        : [
            need(pixelIconSvg('coin', 'px-icon'), t('evolve.coins'), save.coins, row.coins),
            ...row.materials.map((m) => need(pixelSvgOf(EVOLVE_SHOP_ICONS[`essence-${m.tier}`]!, 'px-icon'), t('evolve.essence').replace('{tier}', t(`difficulty.${m.tier}`)), m.have, m.need)),
          ]),
    );
    note.textContent = done?.text ?? bondText(row);
    note.classList.toggle('is-done', Boolean(done));
    primary.classList.toggle('is-blocked', block.kind !== 'ready');
    primary.setAttribute('aria-disabled', String(block.kind !== 'ready'));
    const reason =
      block.kind === 'final' ? t(row.awaken ? 'evolve.btn.awakened' : 'evolve.btn.final')
      : block.kind === 'coins' ? t('shop.short').replace('{n}', coin(block.short))
      : block.kind === 'materials' ? t('evolve.btn.materials')
      : '';
    primary.replaceChildren(
      ...(block.kind === 'ready' ? [pixelSvgOf(EVOLVE_SHOP_ICONS[row.awaken ? 'awaken' : 'arrow']!, 'px-icon'), h('span', { textContent: t(row.awaken ? 'evolve.btn.awaken' : 'evolve.btn.evolve') })] : [h('span', { textContent: reason })]),
    );
    shiny.hidden = !hasShiny(save, row.species);
    shiny.textContent = t('evolve.shiny.row').replace('{species}', t(`species.${row.species}`)) + ': ' + t(wearsShiny(save, row.species) ? 'menu.on' : 'menu.off');
  }

  /** Rebuilds the grid from the save (an evolution changes which species a card holds). */
  function render(): void {
    const rows = evolveRows(save);
    cards = rows.map(cardOf);
    grid.replaceChildren(...(cards.length > 0 ? cards : [h('p', { className: 'es-text', textContent: t('evolve.none.text') })]));
    pager.refresh();
    show(rows.some((r) => r.species === focused) ? focused! : (rows[0]?.species ?? 'mimikyu'));
  }

  primary.addEventListener('click', () => focused && act(focused));
  shiny.addEventListener('click', () => {
    if (!focused) return;
    save = wearShinyAt(options.store, focused, !wearsShiny(save, focused));
    render();
    shiny.focus({ preventScroll: true });
  });
  challenges?.addEventListener('click', () => options.onChallenges?.());
  const back = h('button', { className: 'es-back', type: 'button', textContent: t('menu.back') });
  back.addEventListener('click', () => options.onBack());

  const sheet = h('section', { className: 'es-sheet' }, [stage, name, dotsRow, needs, note, primary]);
  const element = mdWindow({ title: t('evolve.title'), className: 'es-window ev-window' }, [
    h('p', { className: 'dim es-context', textContent: t('evolve.text') }),
    h('div', { className: 'es-body' }, [sheet, grid]),
    h('div', { className: 'es-foot' }, [back, pageNav, h('span', { className: 'ev-foot-aux' }, [shiny, challenges]), deviceHint('es-hint', 'evolve.hint')]),
  ]);

  const stopKeys = gridNav({
    win: element,
    controls: () => [...pager.visible(), primary, ...(shiny.hidden ? [] : [shiny]), ...(challenges ? [challenges] : []), back, ...pageButtons()],
    fallback: () => cards.find((c) => c.dataset.species === focused) ?? cards[0],
    onBack: options.onBack,
  });

  render();
  queueMicrotask(() => cards.find((c) => c.dataset.species === focused)?.focus({ preventScroll: true }));
  return {
    element,
    dispose: () => {
      stopKeys();
      pager.dispose();
    },
  };
}
