import { describe, expect, it } from 'vitest';
import { cardBlock, nextRankText, tutorCards, SLOT_FILTERS } from '../../src/app/tutor';
import { MOVES } from '../../src/data/moves';
import { originalKit } from '../../src/data/species';
import { MAX_RANK, TUTOR_OFFER } from '../../src/data/tutor';
import { setLanguage } from '../../src/i18n';
import es from '../../src/i18n/es.json';
import en from '../../src/i18n/en.json';

describe('move tutor cards', () => {
  setLanguage('es');

  it('one card per known or offered move, the kit first, each once', () => {
    const cards = tutorCards({ coins: 0 }, 'zorua', 'all');
    const moves = cards.map((c) => c.move);
    expect(new Set(moves).size).toBe(moves.length);
    expect(moves.slice(0, originalKit('zorua').length)).toEqual(originalKit('zorua'));
    for (const m of TUTOR_OFFER.zorua) expect(moves).toContain(m);
  });

  it('the kit is rank-ready, an offered move is for sale, a Maestro move waits for its dungeon', () => {
    const wallet = { coins: 9999 };
    const cards = tutorCards(wallet, 'mimikyu', 'all');
    const kit = cards.find((c) => c.move === originalKit('mimikyu')[0])!;
    expect(kit.state).toBe('rank');
    expect(kit.action).toBe('rank');
    expect(kit.cost).toBeGreaterThan(0);
    const thunder = cards.find((c) => c.move === 'thunder')!;
    expect(thunder.state).toBe('locked');
    expect(thunder.lockedBy).toBe('Bosque Brumoso');
    expect(thunder.action).toBeNull();
    const open = tutorCards({ ...wallet, cleared: ['misty-forest'] }, 'mimikyu', 'all').find((c) => c.move === 'thunder')!;
    expect(open.state).toBe('buy');
    expect(open.action).toBe('learn');
    expect(open.affordable).toBe(true);
  });

  it('a maxed move has no action and full pips', () => {
    const kit = originalKit('cubone')[0]!;
    const card = tutorCards({ coins: 0, ranks: { cubone: { [kit]: MAX_RANK } } }, 'cubone', 'all').find((c) => c.move === kit)!;
    expect(card.state).toBe('maxed');
    expect(card.rank).toBe(MAX_RANK);
    expect(card.action).toBeNull();
    expect(nextRankText(card)).toBeNull();
  });

  it('the slot filter keeps one slot kind and every slot filter has cards for a starter', () => {
    for (const f of SLOT_FILTERS) {
      const cards = tutorCards({ coins: 0 }, 'cubone', f);
      expect(cards.length, f).toBeGreaterThan(0);
      if (f !== 'all') expect(cards.every((c) => MOVES[c.move].slot === f)).toBe(true);
    }
  });

  it('cardBlock says why an action is refused: lock first, then coins, nothing when it can be done', () => {
    const cards = tutorCards({ coins: 0 }, 'mimikyu', 'all');
    expect(cardBlock(cards.find((c) => c.move === 'thunder')!, 0)).toEqual({ kind: 'locked', dungeon: 'Bosque Brumoso' });
    const buy = cards.find((c) => c.state === 'buy')!;
    expect(cardBlock(buy, 0)).toEqual({ kind: 'coins', missing: buy.cost });
    expect(cardBlock(buy, buy.cost!)).toBeNull();
  });

  it('the next rank text previews +1 for an unranked move and +2 after', () => {
    const kit = originalKit('zorua')[0]!;
    const one = tutorCards({ coins: 0 }, 'zorua', 'all').find((c) => c.move === kit)!;
    expect(nextRankText(one)!.startsWith('+1:')).toBe(true);
    const two = tutorCards({ coins: 0, ranks: { zorua: { [kit]: 1 } } }, 'zorua', 'all').find((c) => c.move === kit)!;
    expect(nextRankText(two)!.startsWith('+2:')).toBe(true);
  });

  it('every tutor key exists in both languages with no em dash, and the screen keys are defined', () => {
    const keys = Object.keys(es).filter((k) => k.startsWith('tutor.'));
    for (const k of keys) {
      expect((en as Record<string, string>)[k], k).toBeTruthy();
      expect((es as Record<string, string>)[k], k).not.toMatch(/—/);
      expect((en as Record<string, string>)[k], k).not.toMatch(/—/);
    }
    for (const k of ['tutor.act.learn', 'tutor.act.rank', 'tutor.act.maxed', 'tutor.reason.coins', 'tutor.stat.stamina', 'tutor.stat.cooldown', 'tutor.stat.shape', 'tutor.inBuild', 'tutor.empty', 'tutor.hint.keys']) expect(keys, k).toContain(k);
  });
});
