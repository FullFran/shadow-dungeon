import { describe, expect, it } from 'vitest';
import { tutorCards } from '../../src/app/tutor';
import { defaultOpen, horizontal, moveGroups, navItems, navMove } from '../../src/app/tutor-groups';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { MAX_RANK } from '../../src/data/tutor';
import { catalog, LANGUAGES } from '../../src/i18n';

/** Owner, 2026-11-04: "pon los acordeones con scroll interno y que se vea en una sola columna hacia abajo". */
const RICH = { coins: 99999, cleared: ['misty-forest', 'crypt-of-the-sword-king', 'flooded-caves'] };

describe('Maestro accordion groups', () => {
  it('every move of every playable species lands in exactly one group, in slot order', () => {
    for (const species of PLAYABLE_SPECIES) {
      const cards = tutorCards(RICH, species, 'all');
      const groups = moveGroups(cards);
      const seen = groups.flatMap((g) => g.cards.map((c) => c.move));
      expect(seen.length, species).toBe(cards.length);
      expect(new Set(seen).size, species).toBe(seen.length);
      expect([...seen].sort(), species).toEqual(cards.map((c) => c.move).sort());
      for (const g of groups) {
        expect(g.cards.length, `${species} ${g.slot}`).toBeGreaterThan(0);
        for (const c of g.cards) expect(c.slot).toBe(g.slot);
      }
      const order = groups.map((g) => PLAYER_SLOT_LAYOUT.indexOf(g.slot));
      expect(order, species).toEqual([...order].sort((a, b) => a - b));
      expect(order.every((i) => i >= 0), species).toBe(true);
    }
  });

  it('counts the moves at max rank per group', () => {
    const kit = tutorCards({ coins: 0 }, 'cubone', 'all').filter((c) => c.known);
    const ranks = { cubone: Object.fromEntries(kit.map((c) => [c.move, MAX_RANK])) };
    const cards = tutorCards({ coins: 0, ranks }, 'cubone', 'all');
    const groups = moveGroups(cards);
    for (const g of groups) expect(g.maxed).toBe(g.cards.filter((c) => c.state === 'maxed').length);
    expect(groups.reduce((n, g) => n + g.maxed, 0)).toBe(kit.length);
    expect(kit.length).toBeGreaterThan(0);
  });

  it('opens exactly one group by default: the focused move group, else the first with something to buy, else the first', () => {
    const cards = tutorCards(RICH, 'mimikyu', 'all');
    const groups = moveGroups(cards);
    expect(groups.length).toBeGreaterThan(1);
    const open = defaultOpen(groups, null);
    expect(open.size).toBe(1);
    const last = groups[groups.length - 1]!;
    const target = last.cards[0]!.move;
    expect([...defaultOpen(groups, target)]).toEqual([last.slot]);
    expect(defaultOpen([], null).size).toBe(0);
  });

  it('flattens headers and the rows of open groups for the keyboard, and stops at both ends', () => {
    const groups = moveGroups(tutorCards(RICH, 'mimikyu', 'all'));
    const closed = navItems(groups, new Set());
    expect(closed.every((i) => i.kind === 'header')).toBe(true);
    expect(closed).toHaveLength(groups.length);
    const first = groups[0]!;
    const items = navItems(groups, new Set([first.slot]));
    expect(items[0]).toEqual({ kind: 'header', slot: first.slot });
    expect(items.slice(1, 1 + first.cards.length).every((i) => i.kind === 'row' && i.slot === first.slot)).toBe(true);
    expect(items).toHaveLength(groups.length + first.cards.length);
    expect(navMove(items, 0, 1)).toBe(1);
    expect(navMove(items, 0, -1)).toBe(0);
    expect(navMove(items, items.length - 1, 1)).toBe(items.length - 1);
    expect(navMove(items, -1, 1)).toBe(0);
  });

  it('Left collapses a header (or climbs from a row to its header), Right expands', () => {
    const open = new Set<'fast'>(['fast']);
    expect(horizontal({ kind: 'header', slot: 'fast' }, 'left', open)).toEqual({ kind: 'close', slot: 'fast' });
    expect(horizontal({ kind: 'header', slot: 'fast' }, 'right', open)).toBeNull();
    expect(horizontal({ kind: 'header', slot: 'heavy' }, 'right', open)).toEqual({ kind: 'open', slot: 'heavy' });
    expect(horizontal({ kind: 'header', slot: 'heavy' }, 'left', open)).toBeNull();
    expect(horizontal({ kind: 'row', slot: 'fast', move: 'ember' }, 'left', open)).toEqual({ kind: 'toHeader', slot: 'fast' });
    expect(horizontal({ kind: 'row', slot: 'fast', move: 'ember' }, 'right', open)).toBeNull();
  });

  it('has es and en copy for every accordion string', () => {
    for (const lang of LANGUAGES) {
      const c = catalog(lang);
      for (const key of ['tutor.group.count', 'tutor.group.maxed', 'tutor.group.aria', 'tutor.group.noneMaxed']) expect(c[key], `${lang} ${key}`).toBeTruthy();
    }
  });
});
