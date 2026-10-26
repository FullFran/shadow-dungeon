import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { UPGRADE_IDS, UPGRADES } from '../../src/data/upgrades';
import { loadSave, writeSave, EMPTY_SAVE, SAVE_VERSION } from '../../src/app/save';
import { bonusText, purchase, shopRows } from '../../src/app/shop';
import { setLanguage } from '../../src/i18n';

describe('shop rows', () => {
  it('lists every upgrade with its level, next cost and whether it is affordable', () => {
    setLanguage('es');
    const rows = shopRows({ ...EMPTY_SAVE, coins: 100, upgrades: { vitality: 5, stamina: 1 } });
    expect(rows.map((r) => r.id)).toEqual([...UPGRADE_IDS]);
    const vitality = rows.find((r) => r.id === 'vitality')!;
    expect(vitality).toMatchObject({ level: 5, max: 5, cost: null, affordable: false });
    const stamina = rows.find((r) => r.id === 'stamina')!;
    expect(stamina).toMatchObject({ level: 1, cost: UPGRADES.stamina.costs[1], affordable: false });
    const insight = rows.find((r) => r.id === 'insight')!;
    expect(insight).toMatchObject({ level: 0, cost: 90, affordable: true });
    expect(insight.name).not.toBe('upgrade.insight');
    expect(insight.effect).toContain('5 %');
  });

  it('formats bonuses in their unit', () => {
    expect(bonusText('vitality', 3)).toBe('+12');
    expect(bonusText('stamina', 2)).toBe('+10 %');
    expect(bonusText('reflexes', 1)).toBe('+8 ms');
  });
});

describe('purchase', () => {
  it('saves the bought level and the new balance, or refuses and changes nothing', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 70 });
    expect(purchase(store, 'vitality')).toEqual({ version: SAVE_VERSION, coins: 10, upgrades: { vitality: 1 } });
    expect(loadSave(store)).toEqual({ version: SAVE_VERSION, coins: 10, upgrades: { vitality: 1 } });
    expect(purchase(store, 'vitality')).toBeNull();
    expect(loadSave(store).coins).toBe(10);
  });
});
