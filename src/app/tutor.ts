import { costsOf } from '../core/move-power';
import { buyMove, knownMoves, moveRank, rankCost, rankUp, tutorLock, tutorPrice, type TutorWallet } from '../core/tutor';
import { dungeonById } from '../data/dungeons';
import { RANK_EFFECTS, type RankEffect } from '../data/rank-effects';
import { MOVES, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import type { PokemonType } from '../data/types';
import { isStarter, type SpeciesId } from '../data/species';
import { MAX_RANK, moveTier, RANK_EFFECT, RECOMMENDED_BUILD, tutorOffer, type MoveTier } from '../data/tutor';
import type { KeyValueStore } from '../adapters/storage';
import { getLanguage, t } from '../i18n';
import type { ListItem } from '../ui/cursor-list';
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

/** "Recomendado: Sombra Furtiva · Carantoña · Danza Espada · Golpe Fantasma" (a starter's; none for the others). */
export function buildHint(species: SpeciesId): string {
  if (!isStarter(species)) return '';
  const build = RECOMMENDED_BUILD[species];
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
  const offer = tutorOffer(species).filter(fits);
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

/** Why a card's action is refused right now (the lock wins over the price), or null when it can be done. */
export type CardBlock = { kind: 'locked'; dungeon: string } | { kind: 'coins'; missing: number };

/** One card of the tutor grid: a move `species` knows or can be taught, with what the sheet and the chip need. */
export interface MoveCard {
  move: MoveId;
  type: PokemonType;
  slot: SlotKind;
  tier: MoveTier;
  power: number;
  /** Known now (its original kit, bought or awakened). */
  known: boolean;
  /** Owned ranks (0..MAX_RANK). */
  rank: number;
  /** locked: a Maestro move waiting for a dungeon; buy: for sale; rank: known and can rank up; maxed: known at the top rank. */
  state: 'locked' | 'buy' | 'rank' | 'maxed';
  /** What Enter does: learn the move, rank it up, or nothing. */
  action: 'learn' | 'rank' | null;
  /** Price of the action; null when there is none. */
  cost: number | null;
  affordable: boolean;
  /** The dungeon to clear first (its name), when locked. */
  lockedBy: string | null;
}

/** The cards of `species` under `filter`: what it knows (its kit first), then what the tutor sells. */
export function tutorCards(wallet: TutorWallet, species: SpeciesId, filter: SlotFilter = 'all'): MoveCard[] {
  const known = knownMoves(wallet, species);
  const moves = [...known, ...tutorOffer(species).filter((m) => !known.includes(m))];
  return moves
    .filter((move) => filter === 'all' || MOVES[move].slot === filter)
    .map((move): MoveCard => {
      const def = MOVES[move];
      const isKnown = known.includes(move);
      const rank = isKnown ? moveRank(wallet, species, move) : 0;
      const base = { move, type: def.type, slot: def.slot, tier: moveTier(move), power: def.power, known: isKnown, rank };
      if (isKnown) {
        const cost = rankCost(wallet, species, move);
        return { ...base, state: cost === null ? 'maxed' : 'rank', action: cost === null ? null : 'rank', cost, affordable: cost !== null && wallet.coins >= cost, lockedBy: null };
      }
      const price = tutorPrice(species, move);
      const lock = tutorLock(wallet, species, move);
      if (lock) return { ...base, state: 'locked', action: null, cost: price, affordable: false, lockedBy: t(dungeonById(lock).lore.nameKey) };
      return { ...base, state: 'buy', action: 'learn', cost: price, affordable: price !== null && wallet.coins >= price, lockedBy: null };
    });
}

/** Why the card's action cannot be done with `coins`, or null when it can (or it has no action to refuse: a maxed move). */
export function cardBlock(card: MoveCard, coins: number): CardBlock | null {
  if (card.lockedBy) return { kind: 'locked', dungeon: card.lockedBy };
  if (card.cost !== null && card.action !== null && coins < card.cost) return { kind: 'coins', missing: card.cost - coins };
  return null;
}

/** What the next rank of a known move adds ("+1: +10 % de daño, ..."), or null when it is maxed or not known. */
export function nextRankText(card: MoveCard): string | null {
  return card.known && card.rank < MAX_RANK ? rankText(card.move, card.rank + 1) : null;
}

/** The cost note of a paid move ("A cambio: retroceso."), empty for the original kit and the moves that cost nothing extra. */
export function paidText(move: MoveId): string {
  const costs = costsOf(MOVES[move]);
  return moveTier(move) !== 'basic' && costs.length > 0 ? fill('tutor.costs', { list: costs.map((c) => t(`tutor.cost.${c}`)).join(', ') }) : '';
}
