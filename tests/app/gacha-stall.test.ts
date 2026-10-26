import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { pullAt, revealText, stallInfo } from '../../src/app/gacha';
import { EMPTY_SAVE, loadSave, writeSave } from '../../src/app/save';
import { GACHA } from '../../src/data/gacha';
import { setLanguage } from '../../src/i18n';

/** Mimikyu's gacha stall (odd/tasks/gacha-evolutions.md T5): what the window shows and what its button writes. */
describe('stall info', () => {
  it('shows the cost, the rates per rarity from the table and the pulls left to a sure rare', () => {
    const info = stallInfo({ ...EMPTY_SAVE, coins: 250, pity: 3 });
    expect(info).toMatchObject({ cost: GACHA.cost, canPull: true, pityLeft: GACHA.hardPity - 3 });
    expect(info.rates).toEqual([
      { rarity: 'common', percent: 85, species: ['piplup', 'shinx'] },
      { rarity: 'rare', percent: 15, species: ['abra', 'axew'] },
    ]);
    expect(stallInfo({ ...EMPTY_SAVE, coins: GACHA.cost - 1 }).canPull).toBe(false);
    expect(stallInfo(EMPTY_SAVE).pityLeft).toBe(GACHA.hardPity);
  });
});

describe('pull at the stall', () => {
  it('refuses without the Pokémonedas and writes nothing', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 99 });
    expect(pullAt(store, 1)).toBeNull();
    expect(loadSave(store).coins).toBe(99);
  });

  it('pays, keeps the new species and the pity in the save', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 300 });
    const pulled = pullAt(store, 12345)!;
    const save = loadSave(store);
    expect(save.owned).toEqual([pulled.result.species]);
    expect(save.coins).toBe(300 - GACHA.cost);
    expect(pulled.save).toEqual(save);
  });

  it('a duplicate refunds and owns nothing new', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 1000, owned: ['kadabra', 'prinplup', 'luxio', 'fraxure'] });
    const pulled = pullAt(store, 7)!;
    expect(pulled.result.duplicate).toBe(true);
    expect(loadSave(store).coins).toBe(1000 - GACHA.cost + GACHA.duplicateRefund);
    expect(loadSave(store).owned).toEqual(['kadabra', 'prinplup', 'luxio', 'fraxure']);
  });

  it('reveals the species, its rarity and any refund in words', () => {
    setLanguage('es');
    expect(revealText({ species: 'abra', rarity: 'rare', duplicate: false, refund: 0 })).toContain('Abra');
    const dup = revealText({ species: 'piplup', rarity: 'common', duplicate: true, refund: 40 });
    expect(dup).toContain('Piplup');
    expect(dup).toContain('40');
  });
});
