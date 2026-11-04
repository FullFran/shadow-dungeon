import type { MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import type { MoveCard } from './tutor';

/**
 * The Maestro's list as accordions (owner, 2026-11-04: "pon los acordeones con scroll interno y que se vea en una sola
 * columna hacia abajo"). One group per move category (Rápida, Fuerte, Potencia, Área), each move in exactly one; the
 * category tabs are gone because the groups are the filter (Hick: four headers instead of twenty cards).
 */
export interface MoveGroup {
  slot: SlotKind;
  cards: MoveCard[];
  /** How many of its moves are at max rank. */
  maxed: number;
}

/** The cards split by slot, in the slot order of the loadout; a slot with no card has no group. */
export function moveGroups(cards: readonly MoveCard[]): MoveGroup[] {
  return PLAYER_SLOT_LAYOUT.flatMap((slot): MoveGroup[] => {
    const own = cards.filter((c) => c.slot === slot);
    return own.length ? [{ slot, cards: own, maxed: own.filter((c) => c.state === 'maxed').length }] : [];
  });
}

/** The group open on arrival (Miller: one): the one holding `focused`, else the first with an affordable action, else the first. */
export function defaultOpen(groups: readonly MoveGroup[], focused?: MoveId | null): Set<SlotKind> {
  const pick = (focused ? groups.find((g) => g.cards.some((c) => c.move === focused)) : undefined) ?? groups.find((g) => g.cards.some((c) => c.action !== null && c.affordable)) ?? groups[0];
  return new Set(pick ? [pick.slot] : []);
}

/** What Up and Down walk: every header, and the rows of the groups that are open. */
export type NavItem = { kind: 'header'; slot: SlotKind } | { kind: 'row'; slot: SlotKind; move: MoveId };

export function navItems(groups: readonly MoveGroup[], open: ReadonlySet<SlotKind>): NavItem[] {
  return groups.flatMap((g): NavItem[] => [{ kind: 'header', slot: g.slot }, ...(open.has(g.slot) ? g.cards.map((c): NavItem => ({ kind: 'row', slot: g.slot, move: c.move })) : [])]);
}

/** One step through `items`, stopping at both ends (a list, not a ring); from nothing, the first. */
export function navMove(items: readonly NavItem[], at: number, delta: -1 | 1): number {
  if (items.length === 0) return -1;
  if (at < 0) return 0;
  return Math.max(0, Math.min(items.length - 1, at + delta));
}

/** Left and Right: collapse / expand a header, climb from a row to its header; null when there is nothing to do. */
export type Horizontal = { kind: 'open' | 'close' | 'toHeader'; slot: SlotKind } | null;

export function horizontal(item: NavItem, dir: 'left' | 'right', open: ReadonlySet<SlotKind>): Horizontal {
  if (item.kind === 'row') return dir === 'left' ? { kind: 'toHeader', slot: item.slot } : null;
  if (dir === 'left') return open.has(item.slot) ? { kind: 'close', slot: item.slot } : null;
  return open.has(item.slot) ? null : { kind: 'open', slot: item.slot };
}
