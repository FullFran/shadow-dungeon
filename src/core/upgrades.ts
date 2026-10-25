import { UPGRADE_IDS, UPGRADES, type UpgradeId, type UpgradeLevels } from '../data/upgrades';

/**
 * Permanent upgrades (docs/gdd.md §11), pure: what the next level costs,
 * buying one, and the bonuses of the owned levels. The bonuses enter the run
 * through `createPlayer` (max HP) and the stats pipeline (`playerStats`:
 * stamina regen, floor heal, perfect-dodge window, experience).
 */
export interface Wallet {
  coins: number;
  upgrades: UpgradeLevels;
}

export interface UpgradeBonuses {
  maxHp: number;
  /** Stamina regen multiplier. */
  staminaRegen: number;
  /** Extra fraction of max HP healed on entering a new floor. */
  floorHeal: number;
  perfectWindowMs: number;
  /** Experience multiplier. */
  xpGain: number;
}

/** Owned level of an upgrade, clamped to its table. */
export const upgradeLevel = (levels: UpgradeLevels, id: UpgradeId): number => Math.min(Math.max(0, Math.floor(levels[id] ?? 0)), UPGRADES[id].costs.length);

/** Cost of the next level, or null when maxed. */
export function upgradeCost(levels: UpgradeLevels, id: UpgradeId): number | null {
  return UPGRADES[id].costs[upgradeLevel(levels, id)] ?? null;
}

/** The wallet after buying the next level of `id`, or null when it is maxed or unaffordable. */
export function buyUpgrade(wallet: Wallet, id: UpgradeId): Wallet | null {
  const cost = upgradeCost(wallet.upgrades, id);
  if (cost === null || wallet.coins < cost) return null;
  return { coins: wallet.coins - cost, upgrades: { ...wallet.upgrades, [id]: upgradeLevel(wallet.upgrades, id) + 1 } };
}

const NONE: UpgradeBonuses = { maxHp: 0, staminaRegen: 1, floorHeal: 0, perfectWindowMs: 0, xpGain: 1 };

export function upgradeBonuses(levels: UpgradeLevels | undefined): UpgradeBonuses {
  if (!levels) return NONE;
  const per = (id: UpgradeId) => upgradeLevel(levels, id) * UPGRADES[id].perLevel;
  return {
    maxHp: per('vitality'),
    staminaRegen: 1 + per('stamina'),
    floorHeal: per('respite'),
    perfectWindowMs: per('reflexes'),
    xpGain: 1 + per('insight'),
  };
}

/** Every upgrade id, in shop order. */
export const SHOP_ORDER: readonly UpgradeId[] = UPGRADE_IDS;
