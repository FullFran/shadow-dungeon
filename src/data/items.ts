/**
 * Held items (docs/gdd.md §3 "Progresión dentro de la partida"): on entering
 * each floor after the first, each player picks one of three, offered by
 * rarity weight. Items stack for the run up to `maxStacks` (an item at its cap
 * is no longer offered). Stat modifiers apply per stack (multipliers compound,
 * additions add); the hooks of the other items live in core/items.ts and read
 * their numbers from here. Values are provisional.
 */
export type ItemId =
  | 'choice-band'
  | 'leftovers'
  | 'quick-claw'
  | 'sitrus-berry'
  | 'scope-lens'
  | 'focus-sash'
  | 'shell-bell'
  | 'muscle-band'
  | 'expert-belt'
  | 'bright-powder'
  | 'wide-lens'
  | 'rocky-helmet';

export type Rarity = 'common' | 'uncommon' | 'rare';

/** Per-stack stat changes. Multipliers (`damage`, `staminaCost`...) compound; `critChance` and `perfectWindowMs` add. */
export interface StatModifiers {
  /** Every move's damage. */
  damage?: number;
  /** Damage of moves in the heavy slot. */
  heavyDamage?: number;
  /** Damage of super effective hits. */
  superEffective?: number;
  /** Stamina cost of moves and rolls. */
  staminaCost?: number;
  /** Wind-up, active and recovery time of moves (the charge hold is unchanged). */
  actionTime?: number;
  /** Chance of a critical hit. */
  critChance?: number;
  /** Extra perfect-dodge window. */
  perfectWindowMs?: number;
  /** Arc range, dash and projectile radius. */
  reach?: number;
}

export interface ItemDef {
  id: ItemId;
  rarity: Rarity;
  maxStacks: number;
  stats?: StatModifiers;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  'choice-band': { id: 'choice-band', rarity: 'rare', maxStacks: 1, stats: { damage: 1.3, staminaCost: 1.3 } },
  // Two stacks at most (odd/tasks/degenerate-builds.md B2): three regenerated 3 % max HP/s, more than a face-tanked Nightmare card deals.
  leftovers: { id: 'leftovers', rarity: 'uncommon', maxStacks: 2 },
  'quick-claw': { id: 'quick-claw', rarity: 'uncommon', maxStacks: 2, stats: { actionTime: 0.85 } },
  'sitrus-berry': { id: 'sitrus-berry', rarity: 'common', maxStacks: 2 },
  'scope-lens': { id: 'scope-lens', rarity: 'common', maxStacks: 3, stats: { critChance: 0.1 } },
  'focus-sash': { id: 'focus-sash', rarity: 'rare', maxStacks: 1 },
  'shell-bell': { id: 'shell-bell', rarity: 'uncommon', maxStacks: 2 },
  'muscle-band': { id: 'muscle-band', rarity: 'common', maxStacks: 3, stats: { heavyDamage: 1.2 } },
  'expert-belt': { id: 'expert-belt', rarity: 'common', maxStacks: 2, stats: { superEffective: 1.2 } },
  'bright-powder': { id: 'bright-powder', rarity: 'uncommon', maxStacks: 2, stats: { perfectWindowMs: 40 } },
  'wide-lens': { id: 'wide-lens', rarity: 'common', maxStacks: 2, stats: { reach: 1.15 } },
  'rocky-helmet': { id: 'rocky-helmet', rarity: 'uncommon', maxStacks: 3 },
};

export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

/** Numbers of the hook items (per stack unless noted). */
export const ITEM_EFFECTS = {
  /** Leftovers: max HP fraction healed per second. */
  leftoversPerSecond: 0.01,
  /**
   * The most the held items heal over time together (Leftovers and Shell
   * Bell's budget), as a max HP fraction per second: Shell Bell's rate fills
   * only what Leftovers leaves under it (odd/tasks/degenerate-builds.md B1).
   */
  sustainPerSecond: 0.02,
  /** Sitrus Berry: below this HP fraction, heal `sitrusHeal` of max HP; one use per stack per floor. */
  sitrusThreshold: 0.5,
  sitrusHeal: 0.25,
  /**
   * Shell Bell: fraction of the damage a direct hit really dealt that is
   * healed (zone ticks, chain jumps, split shards, rethrows, burns and mark
   * bursts heal nothing), within a budget of `shellBellPerSecond` of max HP
   * per second (per stack) that holds at most `shellBellBurstSeconds` of it:
   * it rewards landing hits without out-healing a boss
   * (odd/tasks/degenerate-builds.md B1).
   */
  shellBellHeal: 0.12,
  shellBellPerSecond: 0.01,
  shellBellBurstSeconds: 3,
  /** Rocky Helmet: damage to an enemy whose melee attack touches the player. */
  rockyHelmetDamage: 8,
  /** Scope Lens: damage multiplier of a critical hit. */
  critMultiplier: 1.5,
  /** Focus Sash: lethal attacks survived at 1 HP per floor (attacks only, not the collapse). */
  focusSashUses: 1,
} as const;

/** Offer: how many items, and the weight of each rarity (per item). */
export const ITEM_OFFER = {
  size: 3,
  rarityWeights: { common: 6, uncommon: 3, rare: 1 } as Record<Rarity, number>,
} as const;

/**
 * Oran Berries lying on generated floors (docs/gdd.md §3): each room but the
 * start one may hold one (seeded from the floor seed); walking over it heals.
 * Provisional values.
 */
export const ORAN_BERRY = {
  /** Chance per non-start room. */
  roomChance: 0.35,
  /** HP healed. */
  heal: 20,
  /** Pickup distance from the player's centre (world px). */
  pickupRadius: 14,
} as const;
