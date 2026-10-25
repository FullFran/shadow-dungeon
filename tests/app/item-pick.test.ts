import { describe, expect, it } from 'vitest';
import { heldItems, pickCards, pickIndexForKey, pickPausesSimulation } from '../../src/app/item-pick';
import { setLanguage } from '../../src/i18n';

describe('item pick overlay', () => {
  it('maps 1, 2 and 3 (top row and keypad) to the cards, nothing else', () => {
    expect(pickIndexForKey('Digit1', 3)).toBe(0);
    expect(pickIndexForKey('Numpad3', 3)).toBe(2);
    expect(pickIndexForKey('Digit3', 2)).toBeNull();
    expect(pickIndexForKey('KeyQ', 3)).toBeNull();
  });

  it('builds one card per offered item with name, description, rarity and stacks held', () => {
    setLanguage('es');
    const cards = pickCards(['choice-band', 'scope-lens', 'leftovers'], ['scope-lens']);
    expect(cards.map((c) => c.name)).toEqual(['Cinta Elegida', 'Periscopio', 'Restos']);
    expect(cards[0]).toMatchObject({ rarity: 'rare', rarityLabel: 'Rara', held: null });
    expect(cards[1]!.held).toBe('Llevas 1 de 3');
    expect(cards[2]!.description).toContain('1 %');
  });

  it('lists held items once each with their stack count, in pick order', () => {
    setLanguage('en');
    expect(heldItems(['wide-lens', 'leftovers', 'wide-lens'])).toEqual([
      { id: 'wide-lens', name: 'Wide Lens', description: expect.stringContaining('15%'), count: 2 },
      { id: 'leftovers', name: 'Leftovers', description: expect.stringContaining('1%'), count: 1 },
    ]);
    setLanguage('es');
  });

  it('pauses solo while picking; a shared run keeps going', () => {
    expect(pickPausesSimulation(true, false)).toBe(true);
    expect(pickPausesSimulation(true, true)).toBe(false);
    expect(pickPausesSimulation(false, false)).toBe(false);
  });
});
