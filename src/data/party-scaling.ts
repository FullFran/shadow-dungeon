/**
 * Co-op scaling by party size (docs/gdd.md §8; docs/souls-difficulty-research.md
 * P6 and Appendix A, Elden Ring's Multiplayer Correction). Sub-linear, so a
 * full party fights a longer boss, not an endless one; the enemy count does
 * not change (design over numbers). Index 0 is one player, 3 is four. The
 * values are provisional: the balance harness reads them through
 * `partyScaling`.
 */
export interface PartyScaling {
  /** Players this row is for (1..4). */
  players: number;
  /** Max HP at spawn of boss-class enemies: guardians, mid-bosses and echoes. */
  bossHp: number;
  /** Max HP at spawn of every other enemy. */
  enemyHp: number;
  /** Damage of every enemy hit on a player while a boss-class enemy stands on the floor (victim side). */
  bossDamage: number;
  /** Share of the stagger (hitstun and knockback) a boss-class enemy takes: four players cannot stunlock it. */
  bossStagger: number;
}

export const MAX_PARTY = 4;

export const PARTY_SCALING: readonly PartyScaling[] = [
  { players: 1, bossHp: 1, enemyHp: 1, bossDamage: 1, bossStagger: 1 },
  { players: 2, bossHp: 1.6, enemyHp: 1.25, bossDamage: 1, bossStagger: 0.6 },
  { players: 3, bossHp: 2.1, enemyHp: 1.4, bossDamage: 1.1, bossStagger: 0.4 },
  { players: 4, bossHp: 2.6, enemyHp: 1.55, bossDamage: 1.15, bossStagger: 0.3 },
];

/** A party size as a valid one: whole, between 1 and `MAX_PARTY` (anything else is solo). */
export const clampParty = (n: number): number => (Number.isFinite(n) ? Math.min(MAX_PARTY, Math.max(1, Math.floor(n))) : 1);

/** The multipliers for `n` players (clamped to 1..4): all ones solo. */
export const partyScaling = (n: number): PartyScaling => PARTY_SCALING[clampParty(n) - 1]!;

/**
 * Bosses by party (GDD §8): from `aggroFrom` players a boss changes target
 * every `switchMs` of enemy time, or at once towards a player who dealt it
 * `pressureShare` of its max HP while it was looking at someone else. From
 * `areaCardFrom` players some bosses add one area card to their rotation
 * (data/party-tricks.ts).
 */
export const BOSS_AGGRO = { aggroFrom: 2, switchMs: 6000, pressureShare: 0.08, areaCardFrom: 3 } as const;

/**
 * Co-op revive (GDD §6): stand within `radius` px of a fainted ally for
 * `holdMs` without being hurt and it gets up with `hpShare` of its max HP,
 * `perFloor` times per player per floor. Tiers may forbid it
 * (data/difficulty.ts `TierDef.coopRevive`).
 */
export const COOP_REVIVE = { radius: 44, holdMs: 3000, hpShare: 0.3, perFloor: 1 } as const;
