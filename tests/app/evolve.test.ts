import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { chainView, evolutionChain, evolveAt, evolveBlock, evolveRows, materialsText, rowLabel, stageDots } from '../../src/app/evolve';
import { EMPTY_SAVE, loadSave, writeSave } from '../../src/app/save';
import { setLanguage } from '../../src/i18n';

/** The Lago oracle Phantump's evolutions (odd/tasks/gacha-evolutions.md T5): what the window shows and what Evolve writes. */
describe('evolution rows', () => {
  it('lists the starters first (Mimikyu awakens, the others evolve), then each owned species, with its next step, price and materials owned/needed per tier', () => {
    const rows = evolveRows({ ...EMPTY_SAVE, coins: 500, owned: ['abra', 'prinplup', 'empoleon'], materials: { abra: { normal: 2, nightmare: 5 }, piplup: { hard: 3 } } });
    expect(rows.slice(0, 4).map((r) => [r.species, r.to])).toEqual([
      ['mimikyu', 'mimikyu'],
      ['zorua', 'zoroark'],
      ['litwick', 'lampent'],
      ['cubone', 'marowak'],
    ]);
    expect(rows[0]!.awaken).toEqual({ awakened: 0, steps: 2 });
    expect(rows.slice(4)).toEqual([
      { species: 'abra', to: 'kadabra', coins: 400, materials: [{ tier: 'normal', have: 2, need: 3 }, { tier: 'hard', have: 0, need: 2 }], ready: false },
      { species: 'prinplup', to: 'empoleon', coins: 900, materials: [{ tier: 'hard', have: 3, need: 3 }, { tier: 'nightmare', have: 0, need: 2 }], ready: false },
      { species: 'empoleon', to: null, coins: 0, materials: [], ready: false },
    ]);
    expect(evolveRows({ ...EMPTY_SAVE, coins: 400, owned: ['abra'], materials: { abra: { normal: 3, hard: 2 } } })[4]!.ready).toBe(true);
    expect(evolveRows(EMPTY_SAVE).map((r) => r.species)).toEqual(['mimikyu', 'zorua', 'litwick', 'cubone']);
  });

  it('an evolved starter takes its starter\'s row; a fully awakened Mimikyu has no step left', () => {
    const rows = evolveRows({ ...EMPTY_SAVE, owned: ['lampent', 'marowak'], awakened: { mimikyu: 2 } });
    expect(rows.map((r) => [r.species, r.to])).toEqual([
      ['mimikyu', null],
      ['zorua', 'zoroark'],
      ['lampent', 'chandelure'],
      ['marowak', null],
    ]);
    setLanguage('es');
    expect(rowLabel(rows[0]!)).toBe('Mimikyu · Despertar 2/2');
    expect(rowLabel(rows[2]!)).toBe('Lampent → Chandelure');
    expect(rowLabel(evolveRows(EMPTY_SAVE)[0]!)).toBe('Mimikyu · Despertar 1/2');
  });

  it('names each tier by its difficulty', () => {
    setLanguage('es');
    const row = evolveRows({ ...EMPTY_SAVE, owned: ['kadabra'], materials: { abra: { hard: 1 } } }).find((r) => r.species === 'kadabra');
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

  it('awakens Mimikyu and evolves a starter in the save', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 1300, materials: { mimikyu: { normal: 3, hard: 2 }, zorua: { hard: 3, nightmare: 2 } } });
    expect(evolveAt(store, 'mimikyu')!.awakened).toEqual({ mimikyu: 1 });
    expect(evolveAt(store, 'zorua')!.owned).toEqual(['zoroark']);
    expect(loadSave(store)).toMatchObject({ coins: 0, awakened: { mimikyu: 1 }, owned: ['zoroark'] });
  });
});

describe('evolution sheet helpers', () => {
  const rowOf = (save: Parameters<typeof evolveRows>[0], species: string) => evolveRows(save).find((r) => r.species === species)!;

  it('lays the line out as its forms, first to last; a species outside a line is alone', () => {
    expect(evolutionChain('kadabra')).toEqual(['abra', 'kadabra', 'alakazam']);
    expect(evolutionChain('abra')).toEqual(['abra', 'kadabra', 'alakazam']);
    expect(evolutionChain('zorua')).toEqual(['zorua', 'zoroark']);
    expect(evolutionChain('mimikyu')).toEqual(['mimikyu']);
  });

  it('knows the forms up to the current one; the ones ahead stay silhouettes', () => {
    expect(chainView('kadabra').map((f) => [f.species, f.known])).toEqual([['abra', true], ['kadabra', true], ['alakazam', false]]);
    expect(chainView('zorua').map((f) => f.known)).toEqual([true, false]);
    expect(chainView('alakazam').every((f) => f.known)).toBe(true);
  });

  it('counts the stage dots: forms of a line, or awakenings plus the base for Mimikyu', () => {
    expect(stageDots(rowOf(EMPTY_SAVE, 'zorua'))).toEqual({ filled: 1, total: 2 });
    expect(stageDots(rowOf({ ...EMPTY_SAVE, owned: ['kadabra'] }, 'kadabra'))).toEqual({ filled: 2, total: 3 });
    expect(stageDots(rowOf(EMPTY_SAVE, 'mimikyu'))).toEqual({ filled: 1, total: 3 });
    expect(stageDots(rowOf({ ...EMPTY_SAVE, awakened: { mimikyu: 2 } }, 'mimikyu'))).toEqual({ filled: 3, total: 3 });
  });

  it('says what blocks the step: nothing, a final form, missing materials (with the shortfall per tier) or missing coins', () => {
    const base = { ...EMPTY_SAVE, owned: ['abra' as const] };
    expect(evolveBlock(rowOf({ ...base, coins: 400, materials: { abra: { normal: 3, hard: 2 } } }, 'abra'), 400)).toEqual({ kind: 'ready' });
    expect(evolveBlock(rowOf({ ...base, coins: 400, materials: { abra: { normal: 1, hard: 2 } } }, 'abra'), 400)).toEqual({ kind: 'materials', missing: [{ tier: 'normal', short: 2 }] });
    expect(evolveBlock(rowOf({ ...base, coins: 100, materials: { abra: { normal: 3, hard: 2 } } }, 'abra'), 100)).toEqual({ kind: 'coins', short: 300 });
    expect(evolveBlock(rowOf({ ...EMPTY_SAVE, owned: ['empoleon'] }, 'empoleon'), 0)).toEqual({ kind: 'final' });
    expect(evolveBlock(rowOf({ ...EMPTY_SAVE, awakened: { mimikyu: 2 } }, 'mimikyu'), 0)).toEqual({ kind: 'final' });
  });
});
