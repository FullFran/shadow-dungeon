import { buyMove, knownMoves, moveRank, rankCost, rankUp, tutorPrice, type TutorWallet } from '../core/tutor';
import type { StarterId } from '../data/learnsets';
import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { originalKit, PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, RANK_EFFECT, RECOMMENDED_BUILD, TUTOR_OFFER } from '../data/tutor';
import type { KeyValueStore } from '../adapters/storage';
import { isTouchUi } from '../adapters/touch-mode';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow, statLine } from '../ui/window';
import { coinText } from './coin-lines';
import { moveInfoLines } from './move-info';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Smeargle's move tutor (odd/tasks/movepools.md T3): an MD-style window like
 * Poochyena's shop. A species row (◀ ▶) picks whose moves are on sale (the
 * player's starter first), a slot filter row (◀ ▶) narrows the list to one
 * slot kind, then one row per move the tutor teaches that species (price,
 * or "Aprendido") and one per original move's Mejora (rank and next cost).
 * The line under the list tells what the row under the cursor does, and the
 * recommended build is shown on top. Enter buys; refused rows only play the
 * denied sound. On touch a row takes two taps (see, then buy).
 */

/** The slot filter: every slot, or one kind. */
export type SlotFilter = 'all' | SlotKind;
export const SLOT_FILTERS: readonly SlotFilter[] = ['all', ...PLAYER_SLOT_LAYOUT];

/** The next filter after `filter` in direction `delta`, wrapping around. */
export function stepFilter(filter: SlotFilter, delta: -1 | 1): SlotFilter {
  const i = SLOT_FILTERS.indexOf(filter);
  return SLOT_FILTERS[(i + delta + SLOT_FILTERS.length) % SLOT_FILTERS.length]!;
}

/** The ◀ ▶ slot filter row (also used by the loadout). */
export function slotFilterRow(filter: SlotFilter, onChange: (next: SlotFilter) => void): ListItem {
  return {
    label: t('tutor.filter'),
    value: t(filter === 'all' ? 'tutor.filter.all' : `slot.${filter}`),
    className: 'filter-row',
    onAdjust: (delta) => onChange(stepFilter(filter, delta)),
    onConfirm: () => onChange(stepFilter(filter, 1)),
  };
}

/** "Mazazo +" / "Mazazo ++": a ranked move's name. */
export function rankedName(move: MoveId, rank: number): string {
  return rank > 0 ? `${t(`move.${move}`)} ${'+'.repeat(rank)}` : t(`move.${move}`);
}

/** "Recomendado: Sombra Furtiva · Carantoña · Danza Espada · Golpe Fantasma". */
export function buildHint(species: SpeciesId): string {
  const build = RECOMMENDED_BUILD[species as StarterId] ?? [];
  return t('tutor.build').replace('{moves}', build.map((m) => t(`move.${m}`)).join(' · '));
}

export interface TutorRow {
  kind: 'move' | 'rank';
  move: MoveId;
  label: string;
  /** Price or rank cost; null when learned or maxed. */
  cost: number | null;
  affordable: boolean;
  /** What the row does, for the line under the list. */
  effect: string;
}

/** The rows of `species` under `filter`: moves on sale, then the Mejoras of its original kit. */
export function tutorRows(save: TutorWallet, species: SpeciesId, filter: SlotFilter = 'all'): TutorRow[] {
  const fits = (m: MoveId) => filter === 'all' || MOVES[m].slot === filter;
  const known = knownMoves(save, species);
  const offer = (TUTOR_OFFER[species as StarterId] ?? []).filter(fits);
  const moves = offer.map((move): TutorRow => {
    const learned = known.includes(move);
    const cost = learned ? null : tutorPrice(species, move);
    const [stats] = moveInfoLines(move);
    const power = MOVES[move].power > 0 ? `${t('loadout.power')} ${MOVES[move].power} · ` : '';
    return {
      kind: 'move',
      move,
      label: `${t(`move.${move}`)} · ${t(`type.${MOVES[move].type}`)} · ${t(`slot.${MOVES[move].slot}`)}`,
      cost,
      affordable: cost !== null && save.coins >= cost,
      effect: `${power}${stats}. ${t(`move.${move}.description`)}`,
    };
  });
  const ranks = originalKit(species)
    .filter(fits)
    .map((move): TutorRow => {
      const rank = moveRank(save, species, move);
      const cost = rankCost(save, species, move);
      const cooldown = MOVES[move].cooldownMs ? ` ${t('tutor.rank.cooldown').replace('{pct}', String(Math.round(RANK_EFFECT.cooldown * 100)))}` : '';
      return {
        kind: 'rank',
        move,
        label: `${rankedName(move, rank)} ${t('shop.level').replace('{level}', String(rank)).replace('{max}', String(MAX_RANK))}`,
        cost,
        affordable: cost !== null && save.coins >= cost,
        effect: `${t('tutor.rank.effect').replace('{pct}', String(Math.round(RANK_EFFECT.damage * 100)))}${cooldown}`,
      };
    });
  return [...moves, ...ranks];
}

/** Buys a row from the stored save: the new save, or null (nothing written) when refused. */
export function tutorPurchase(store: KeyValueStore, species: SpeciesId, row: Pick<TutorRow, 'kind' | 'move'>): SaveData | null {
  const save = loadSave(store);
  const wallet = row.kind === 'move' ? buyMove(save, species, row.move) : rankUp(save, species, row.move);
  if (!wallet) return null;
  const next: SaveData = { ...save, ...wallet };
  writeSave(store, next);
  return loadSave(store);
}

export interface TutorOptions {
  store: KeyValueStore;
  /** The player's starter: the tutor opens on it. */
  species: SpeciesId;
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

export function tutorWindow(options: TutorOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  let species = options.species;
  let filter: SlotFilter = 'all';
  let rows = tutorRows(save, species, filter);
  const balance = h('div', { className: 'shop-balance' });
  const build = h('p', { className: 'tutor-build' });
  const effect = h('p', { className: 'shop-effect dim' });
  /** The line under the list: what the row under the cursor does, or how to buy. */
  const describe = (row: TutorRow | null | undefined) => {
    effect.textContent = row ? row.effect : t(isTouchUi() ? 'shop.hint.touch' : 'tutor.hint');
  };

  const items = (): ListItem[] => {
    const out: ListItem[] = [
      {
        label: t('tutor.species'),
        value: t(`species.${species}`),
        className: 'filter-row',
        onAdjust: (delta) => switchSpecies(delta),
        onConfirm: () => switchSpecies(1),
      },
      slotFilterRow(filter, (next) => {
        filter = next;
        refresh();
      }),
    ];
    let header: TutorRow['kind'] | null = null;
    for (const row of rows) {
      if (row.kind !== header) {
        header = row.kind;
        out.push({ header: true, label: t(row.kind === 'move' ? 'tutor.moves' : 'tutor.ranks') });
      }
      out.push({
        label: row.label,
        value: row.cost === null ? t(row.kind === 'move' ? 'tutor.learned' : 'shop.max') : coinText(row.cost, (key) => t(key)),
        className: row.affordable ? 'shop-row' : 'shop-row is-disabled',
        tapToSelect: true,
        onConfirm: () => {
          const bought = tutorPurchase(options.store, species, row);
          if (!bought) {
            options.play?.('denied');
            return;
          }
          options.play?.('coin');
          save = bought;
          refresh();
        },
      });
    }
    out.push({ label: t('menu.back'), onConfirm: options.onBack });
    return out;
  };

  // Header rows take a list slot too: map a list index to its row through the items.
  let rowAt: (TutorRow | null)[] = [];
  const list = cursorList({
    items: [],
    onBack: options.onBack,
    onCursor: (index) => describe(rowAt[index]),
    label: t('tutor.title'),
    className: 'shop-list',
  });

  function switchSpecies(delta: -1 | 1): void {
    const i = PLAYABLE_SPECIES.indexOf(species);
    species = PLAYABLE_SPECIES[(i + delta + PLAYABLE_SPECIES.length) % PLAYABLE_SPECIES.length]!;
    refresh();
  }

  function refresh(): void {
    rows = tutorRows(save, species, filter);
    balance.replaceChildren(statLine(t('screen.coins.balance'), coinText(save.coins, (key) => t(key))));
    build.textContent = buildHint(species);
    const next = items();
    rowAt = [];
    let r = 0;
    for (const item of next) rowAt.push(item.onConfirm && item.className?.startsWith('shop-row') ? (rows[r++] ?? null) : null);
    list.setItems(next);
    describe(rowAt[list.index()]);
  }

  refresh();
  const element = mdWindow({ title: t('tutor.title'), className: 'shop tutor' }, [h('p', { textContent: t('tutor.text') }), balance, build, list.element, effect]);
  return { element, dispose: () => list.dispose() };
}
