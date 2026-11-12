import { describe, expect, it } from 'vitest';
import { CARD_BOSSES, CARD_TIERS, cardWorld, startsOf } from '../../src/sim/prove';
import { fightIn } from '../../src/sim/prove';

/**
 * The beatability proof runs without consumables (odd/tasks/items-bag.md, docs/research/items-and-prep.md §4): every
 * proof world, for every card boss, tier, card and start, carries no consumable effect and no armed sprout, so no
 * bag can make a card look survivable or breakable.
 */
describe('npm run prove is consumable-free', () => {
  it('every card world of every boss and tier starts with no consumables', () => {
    for (const c of CARD_BOSSES) {
      for (const tier of CARD_TIERS) {
        const base = cardWorld(c, tier, 0);
        const cards = fightIn(base, c.species)?.cards.length ?? 1;
        for (let i = 0; i < cards; i++) {
          for (const start of startsOf(c)) expect(cardWorld(c, tier, i, start).player.consumables, `${c.species} ${tier} ${i}`).toBeUndefined();
        }
      }
    }
  });
});
