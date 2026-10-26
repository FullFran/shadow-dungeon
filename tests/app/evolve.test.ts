import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { evolveAt, evolveRows, materialsText } from '../../src/app/evolve';
import { EMPTY_SAVE, loadSave, writeSave } from '../../src/app/save';
import { setLanguage } from '../../src/i18n';

/** The Lago oracle Phantump's evolutions (odd/tasks/gacha-evolutions.md T5): what the window shows and what Evolve writes. */
describe('evolution rows', () => {
  it('lists each owned species with its next form, price and materials owned/needed per tier', () => {
    const rows = evolveRows({ ...EMPTY_SAVE, coins: 500, owned: ['abra', 'prinplup', 'empoleon'], materials: { abra: { normal: 2, nightmare: 5 }, piplup: { hard: 3 } } });
    expect(rows).toEqual([
      { species: 'abra', to: 'kadabra', coins: 400, materials: [{ tier: 'normal', have: 2, need: 3 }, { tier: 'hard', have: 0, need: 2 }], ready: false },
      { species: 'prinplup', to: 'empoleon', coins: 900, materials: [{ tier: 'hard', have: 3, need: 3 }, { tier: 'nightmare', have: 0, need: 2 }], ready: false },
      { species: 'empoleon', to: null, coins: 0, materials: [], ready: false },
    ]);
    expect(evolveRows({ ...EMPTY_SAVE, coins: 400, owned: ['abra'], materials: { abra: { normal: 3, hard: 2 } } })[0]!.ready).toBe(true);
    expect(evolveRows(EMPTY_SAVE)).toEqual([]);
  });

  it('names each tier by its difficulty', () => {
    setLanguage('es');
    const [row] = evolveRows({ ...EMPTY_SAVE, owned: ['kadabra'], materials: { abra: { hard: 1 } } });
    expect(materialsText(row!)).toBe('Difícil 1/3 · Pesadilla 0/2');
  });
});

describe('evolve', () => {
  it('evolves and saves, or refuses and writes nothing', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 400, owned: ['abra'], materials: { abra: { normal: 3, hard: 1 } } });
    expect(evolveAt(store, 'abra')).toBeNull();
    expect(loadSave(store).owned).toEqual(['abra']);
    writeSave(store, { ...EMPTY_SAVE, coins: 400, owned: ['abra'], materials: { abra: { normal: 3, hard: 2, nightmare: 1 } } });
    expect(evolveAt(store, 'abra')!.owned).toEqual(['kadabra']);
    expect(loadSave(store)).toMatchObject({ coins: 0, owned: ['kadabra'], materials: { abra: { nightmare: 1 } } });
  });
});
