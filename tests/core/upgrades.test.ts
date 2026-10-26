import { describe, expect, it } from 'vitest';
import { UPGRADE_IDS, UPGRADES } from '../../src/data/upgrades';
import { RUN } from '../../src/data/dungeon';
import { stageBonus } from '../../src/core/evolution';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { playerStats } from '../../src/core/items';
import { creditDefeats, xpFor } from '../../src/core/progression';
import { followToFloor, startRun } from '../../src/core/run';
import { buyUpgrade, upgradeBonuses, upgradeCost, upgradeLevel } from '../../src/core/upgrades';
import { createPlayer, spawnEnemy } from '../../src/core/world';
import type { GameEvent } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { IDLE, run, world } from './helpers';

describe('upgrade data', () => {
  it('has 3 to 5 levels per upgrade with rising costs', () => {
    expect(UPGRADE_IDS.length).toBeGreaterThanOrEqual(4);
    for (const id of UPGRADE_IDS) {
      const { costs } = UPGRADES[id];
      expect(costs.length).toBeGreaterThanOrEqual(3);
      expect(costs.length).toBeLessThanOrEqual(5);
      for (let i = 1; i < costs.length; i++) expect(costs[i]!).toBeGreaterThan(costs[i - 1]!);
    }
  });
});

describe('buying upgrades', () => {
  it('costs the next level and nothing past the max', () => {
    expect(upgradeCost({}, 'vitality')).toBe(UPGRADES.vitality.costs[0]);
    expect(upgradeCost({ vitality: 2 }, 'vitality')).toBe(UPGRADES.vitality.costs[2]);
    expect(upgradeCost({ vitality: UPGRADES.vitality.costs.length }, 'vitality')).toBeNull();
  });

  it('deducts the exact cost and raises the level by one, without mutating the wallet', () => {
    const wallet = { coins: 500, upgrades: { stamina: 1 } };
    const after = buyUpgrade(wallet, 'stamina');
    expect(after).toEqual({ coins: 500 - UPGRADES.stamina.costs[1]!, upgrades: { stamina: 2 } });
    expect(wallet).toEqual({ coins: 500, upgrades: { stamina: 1 } });
    expect(upgradeLevel(after!.upgrades, 'stamina')).toBe(2);
  });

  it('refuses when unaffordable or maxed', () => {
    expect(buyUpgrade({ coins: UPGRADES.respite.costs[0]! - 1, upgrades: {} }, 'respite')).toBeNull();
    expect(buyUpgrade({ coins: 99_999, upgrades: { respite: UPGRADES.respite.costs.length } }, 'respite')).toBeNull();
  });
});

describe('upgrades at run start', () => {
  const all = { vitality: 2, stamina: 2, respite: 1, reflexes: 3, insight: 2 };

  it('sums the bonuses of the owned levels', () => {
    expect(upgradeBonuses({})).toEqual({ maxHp: 0, staminaRegen: 1, floorHeal: 0, perfectWindowMs: 0, xpGain: 1 });
    const b = upgradeBonuses(all);
    expect(b.maxHp).toBe(2 * UPGRADES.vitality.perLevel);
    expect(b.staminaRegen).toBeCloseTo(1 + 2 * UPGRADES.stamina.perLevel);
    expect(b.floorHeal).toBeCloseTo(UPGRADES.respite.perLevel);
    expect(b.perfectWindowMs).toBe(3 * UPGRADES.reflexes.perLevel);
    expect(b.xpGain).toBeCloseTo(1 + 2 * UPGRADES.insight.perLevel);
  });

  it('raises max HP (full) for every playable species', () => {
    for (const species of PLAYABLE_SPECIES) {
      const player = createPlayer(vec(0, 0), species, undefined, { vitality: 3 });
      // On top of the species' HP (an evolved form's stage bonus included: core/evolution.ts).
      expect(player.maxHp).toBe(Math.round(SPECIES[species].maxHp * (1 + stageBonus(species, 1).hp)) + 3 * UPGRADES.vitality.perLevel);
      expect(player.hp).toBe(player.maxHp);
    }
    const started = startRun(7, { species: 'zorua', upgrades: all }).world.player;
    expect(started.maxHp).toBe(SPECIES.zorua.maxHp + 2 * UPGRADES.vitality.perLevel);
  });

  it('feeds the stats pipeline: perfect-dodge window and stamina regen', () => {
    const player = createPlayer(vec(0, 0), 'mimikyu', undefined, all);
    expect(playerStats(player).perfectWindowMs).toBe(TUNING.perfectDodge.windowMs + 3 * UPGRADES.reflexes.perLevel);
    expect(playerStats(createPlayer(vec(0, 0))).perfectWindowMs).toBe(TUNING.perfectDodge.windowMs);
    const tired = (upgrades = {}) => {
      const base = world();
      return { ...base, player: { ...createPlayer(base.player.pos, 'mimikyu', undefined, upgrades), stamina: 0 } };
    };
    const plain = run(tired(), IDLE, 30).player.stamina;
    const trained = run(tired({ stamina: 4 }), IDLE, 30).player.stamina;
    expect(trained).toBeGreaterThan(plain);
  });

  it('heals more on a new floor', () => {
    const start = startRun(3, { upgrades: { respite: 2 } });
    const hurt = { ...start.world, player: { ...start.world.player, hp: 10 } };
    const down = followToFloor(start.run, hurt, 2).world.player;
    expect(down.hp).toBeCloseTo(10 + (RUN.floorHeal + 2 * UPGRADES.respite.perLevel) * down.maxHp);
  });

  it('gives more experience per defeat', () => {
    const fallen = (upgrades = {}) => {
      const base = spawnEnemy(world(), 'poochyena', vec(100, 100));
      const player = createPlayer(base.player.pos, 'mimikyu', undefined, upgrades);
      return { ...base, player, enemies: base.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    };
    const events: GameEvent[] = [];
    expect(creditDefeats(fallen(), events).player.xp).toBe(xpFor('poochyena', 1));
    expect(creditDefeats(fallen({ insight: 4 }), events).player.xp).toBeCloseTo(xpFor('poochyena', 1) * (1 + 4 * UPGRADES.insight.perLevel));
  });
});
