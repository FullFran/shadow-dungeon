import { costsOf } from '../core/move-power';
import { buyMove, knownMoves, moveRank, rankCost, rankUp, tutorLock, tutorPrice, type TutorWallet } from '../core/tutor';
import { dungeonById } from '../data/dungeons';
import { RANK_EFFECTS, type RankEffect } from '../data/rank-effects';
import type { StarterId } from '../data/learnsets';
import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, moveTier, RANK_EFFECT, RECOMMENDED_BUILD, TUTOR_OFFER, type MoveTier } from '../data/tutor';
import type { KeyValueStore } from '../adapters/storage';
import { isTouchUi } from '../adapters/touch-mode';
import { getLanguage, t } from '../i18n';
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

/** "Básico", "Avanzado", "Maestro". */
export const tierName = (tier: MoveTier): string => t(`tutor.tier.${tier}`);

/** "★☆": filled stars per rank, empty ones for the ranks still to buy. */
export const rankStars = (rank: number): string => '★'.repeat(Math.max(0, Math.min(MAX_RANK, rank))) + '☆'.repeat(Math.max(0, MAX_RANK - rank));

const pct = (share: number): string => String(Math.round(share * 100));
/** Seconds with one decimal at most, with the language's decimal mark ("1,2 s" in Spanish). */
const secs = (ms: number): string => {
  const s = String(Math.round(ms / 100) / 10);
  return getLanguage() === 'es' ? s.replace('.', ',') : s;
};
const fill = (key: string, values: Record<string, string>): string => Object.entries(values).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), t(key));

/** The text of one rank effect ("deja una marca que estalla a los 1,2 s (35 % del golpe)"). */
export function rankEffectText(e: RankEffect): string {
  switch (e.kind) {
    case 'crit':
      return fill('rank.crit', { pct: pct(e.bonus) });
    case 'size':
      return fill('rank.size', { pct: pct(e.multiplier - 1) });
    case 'dot':
      return e.chance >= 1 ? t(`rank.dot.${e.dot}.always`) : fill(`rank.dot.${e.dot}`, { pct: pct(e.chance) });
    case 'mark':
      return fill('rank.mark', { s: secs(e.delayMs), pct: pct(e.share) });
    case 'split':
      return fill('rank.split', { n: String(e.count), pct: pct(e.share) });
    case 'weaken':
      return fill('rank.weaken', { pct: pct(1 - e.factor), s: secs(e.durationMs) });
    case 'zone': {
      const key = e.at === 'self' ? (e.every ? 'rank.zone.aura' : 'rank.zone.aftershock') : `rank.zone.${e.at}`;
      return fill(key, { s: secs(e.at === 'self' && !e.every ? (e.delayMs ?? 0) : e.lifetimeMs) }) + (e.dot ? ` ${t(`rank.zone.${e.dot}`)}` : '');
    }
    case 'hits':
      return fill('rank.hits', { n: String(e.add) });
    case 'return':
      return fill('rank.return', { n: String(e.times), pct: pct(e.share) });
    case 'chain':
      return fill('rank.chain', { pct: pct(e.share) });
    case 'ward':
      return fill('rank.ward', { pct: pct(1 - e.damageTaken), s: secs(e.durationMs) });
    case 'iframes':
      return t('rank.iframes');
    case 'buff': {
      const parts = [
        e.hits ? fill('rank.buff.hits', { n: String(e.hits) }) : null,
        e.durationMs ? fill('rank.buff.duration', { s: secs(e.durationMs) }) : null,
        e.critChance ? fill('rank.buff.crit', { pct: pct(e.critChance) }) : null,
        e.speed ? fill('rank.buff.speed', { pct: pct(e.speed) }) : null,
        e.damageTaken ? fill('rank.buff.guard', { pct: pct(-e.damageTaken) }) : null,
        e.multiplier ? fill('rank.buff.power', { pct: pct(e.multiplier) }) : null,
      ];
      return parts.filter((p): p is string => p !== null).join(', ');
    }
    case 'drain':
      return fill('rank.drain', { pct: pct(e.share) });
    case 'stagger':
      return fill('rank.stagger', { pct: pct(e.multiplier - 1) });
    case 'homing':
      return t('rank.homing');
    case 'heal':
      return fill('rank.heal', { pct: pct(e.share) });
  }
}

/** What rank `rank` (1 or 2) of `move` adds: the damage and, on a boost, the cooldown, then its effect. */
export function rankText(move: MoveId, rank: number): string {
  const numbers = MOVES[move].slot === 'boost' ? fill('tutor.rank.boost', { pct: pct(RANK_EFFECT.cooldown) }) : fill('tutor.rank.damage', { pct: pct(RANK_EFFECT.damage) });
  const effect = RANK_EFFECTS[move][rank - 1];
  return `+${rank}: ${numbers}, ${effect ? rankEffectText(effect) : ''}`;
}

/** Both ranks of a move, for its row on sale. */
const bothRanks = (move: MoveId): string => `${rankText(move, 1)}. ${rankText(move, 2)}.`;

export interface TutorRow {
  kind: 'move' | 'rank';
  move: MoveId;
  label: string;
  /** The move's power tier (its badge). */
  tier: MoveTier;
  /** Price or rank cost; null when learned or maxed. */
  cost: number | null;
  affordable: boolean;
  /** A Maestro move still locked: the name of the dungeon to clear first; null when open. */
  locked: string | null;
  /** What the row does, for the line under the list. */
  effect: string;
}

/** The rows of `species` under `filter`: moves on sale, then the Mejoras of every move it knows. */
export function tutorRows(save: TutorWallet, species: SpeciesId, filter: SlotFilter = 'all'): TutorRow[] {
  const fits = (m: MoveId) => filter === 'all' || MOVES[m].slot === filter;
  const known = knownMoves(save, species);
  const offer = (TUTOR_OFFER[species as StarterId] ?? []).filter(fits);
  const moves = offer.map((move): TutorRow => {
    const learned = known.includes(move);
    const cost = learned ? null : tutorPrice(species, move);
    const lock = learned ? null : tutorLock(save, species, move);
    const locked = lock ? t(dungeonById(lock).lore.nameKey) : null;
    const [stats] = moveInfoLines(move);
    const power = MOVES[move].power > 0 ? `${t('loadout.power')} ${MOVES[move].power} · ` : '';
    const tier = moveTier(move);
    const costs = costsOf(MOVES[move]);
    const paid = tier !== 'basic' && costs.length > 0 ? ` ${fill('tutor.costs', { list: costs.map((c) => t(`tutor.cost.${c}`)).join(', ') })}` : '';
    const lockLine = locked ? ` ${fill('tutor.locked', { dungeon: locked })}` : '';
    return {
      kind: 'move',
      move,
      tier,
      label: `${t(`move.${move}`)} · ${t(`type.${MOVES[move].type}`)} · ${t(`slot.${MOVES[move].slot}`)}`,
      cost,
      locked,
      affordable: cost !== null && !locked && save.coins >= cost,
      effect: `${tierName(tier)}.${lockLine} ${power}${stats}. ${t(`move.${move}.description`)}${paid} ${bothRanks(move)}`,
    };
  });
  const ranks = known.filter(fits).map((move): TutorRow => {
    const rank = moveRank(save, species, move);
    const cost = rankCost(save, species, move);
    const next = rank < MAX_RANK ? fill('tutor.rank.next', { text: rankText(move, rank + 1) }) : fill('tutor.rank.maxed', { text: bothRanks(move) });
    return {
      kind: 'rank',
      move,
      tier: moveTier(move),
      label: `${rankedName(move, rank)} ${rankStars(rank)}`,
      cost,
      locked: null,
      affordable: cost !== null && save.coins >= cost,
      effect: next,
    };
  });
  return [...moves, ...ranks];
}

/** Buys a row from the stored save: the new save, or null (nothing written) when refused. */
export function tutorPurchase(store: KeyValueStore, species: SpeciesId, row: Pick<TutorRow, 'kind' | 'move'>, cleared: Iterable<string> = []): SaveData | null {
  const save = loadSave(store);
  const wallet = row.kind === 'move' ? buyMove({ ...save, cleared }, species, row.move) : rankUp(save, species, row.move);
  if (!wallet) return null;
  const { cleared: _cleared, ...bought } = wallet;
  const next: SaveData = { ...save, ...bought };
  writeSave(store, next);
  return loadSave(store);
}

export interface TutorOptions {
  store: KeyValueStore;
  /** The player's starter: the tutor opens on it. */
  species: SpeciesId;
  /** Dungeons cleared on this device: some Maestro moves wait for one. */
  cleared?: Iterable<string>;
  play?(sound: 'coin' | 'denied'): void;
  onBack(): void;
}

export function tutorWindow(options: TutorOptions): { element: HTMLElement; dispose(): void } {
  let save = loadSave(options.store);
  let species = options.species;
  let filter: SlotFilter = 'all';
  let rows = tutorRows({ ...save, cleared: [...(options.cleared ?? [])] }, species, filter);
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
        // The tier badge (Avanzado, Maestro) beside the name; the original kit has none.
        label: row.tier === 'basic' ? row.label : h('span', {}, [row.label, ' ', h('span', { className: `tier-badge tier-${row.tier}`, textContent: tierName(row.tier) })]),
        value: row.locked ? t('tutor.lockedShort') : row.cost === null ? t(row.kind === 'move' ? 'tutor.learned' : 'shop.max') : coinText(row.cost, (key) => t(key)),
        className: row.affordable ? 'shop-row' : 'shop-row is-disabled',
        tapToSelect: true,
        onConfirm: () => {
          const bought = tutorPurchase(options.store, species, row, options.cleared);
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
    rows = tutorRows({ ...save, cleared: [...(options.cleared ?? [])] }, species, filter);
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
