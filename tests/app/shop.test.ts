import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { UPGRADE_IDS, UPGRADES } from '../../src/data/upgrades';
import { loadSave, writeSave, EMPTY_SAVE, SAVE_VERSION } from '../../src/app/save';
import { bonusText, buyState, confirmedPurchase, purchase, shopRows, upgradeEffect } from '../../src/app/shop';
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

describe('upgrade sheet helpers', () => {
  it('shows the effect now and at the next level, in the upgrade unit; none next when maxed', () => {
    setLanguage('es');
    expect(upgradeEffect('vitality', 1)).toEqual({ label: 'PS máximos', now: '+4', next: '+8' });
    expect(upgradeEffect('stamina', 0)).toMatchObject({ now: '+0 %', next: '+5 %' });
    expect(upgradeEffect('reflexes', 3)).toMatchObject({ now: '+24 ms', next: null });
    for (const id of UPGRADE_IDS) expect(upgradeEffect(id, 0).label, id).not.toMatch(/^shop\./);
  });

  it('reads the buy state: ready, short by N, or maxed', () => {
    const save = { ...EMPTY_SAVE, coins: 50, upgrades: { stamina: 4 } };
    expect(buyState({ ...save, coins: 60 }, 'vitality')).toEqual({ kind: 'ready', cost: 60, missing: 0 });
    expect(buyState(save, 'vitality')).toEqual({ kind: 'short', cost: 60, missing: 10 });
    expect(buyState(save, 'stamina')).toEqual({ kind: 'max', cost: null, missing: 0 });
  });
});

describe('confirmed purchase', () => {
  it('spends nothing when cancelled, once when confirmed, and never asks when it cannot be bought', async () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 70 });
    expect(await confirmedPurchase(store, 'vitality', async () => false)).toBeNull();
    expect(loadSave(store)).toMatchObject({ coins: 70, upgrades: {} });
    let asked = 0;
    const bought = await confirmedPurchase(store, 'vitality', async () => {
      asked++;
      expect(loadSave(store).coins).toBe(70);
      return true;
    });
    expect(asked).toBe(1);
    expect(bought).toMatchObject({ coins: 10, upgrades: { vitality: 1 } });
    expect(await confirmedPurchase(store, 'vitality', async () => (asked++, true))).toBeNull();
    expect(asked).toBe(1);
    expect(loadSave(store).coins).toBe(10);
  });
});
