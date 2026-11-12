import type { Rarity } from './items';

/**
 * Consumables (docs/research/items-and-prep.md §2.1, odd/tasks/items-bag.md): items packed before a run in a bag of
 * `BAG.slots` slots and used by hand during it. They come from a persistent stock (the save's `stock`), filled by the
 * item gacha (`ITEM_GACHA`) and by fixed-price rows for the kinds already unlocked. Only the units used in a run leave
 * the stock (owner's option 2a). Names and effects are our own; the numbers here are provisional.
 *
 * - `dew-tonic`: heals `tonicHeal` of max HP over `tonicMs` (a hit stops it). Two per slot.
 * - `clear-salt`: cures poison and keeps it away for `saltMs`.
 * - `ember-dust`: every hit deals `dustDamage` times more for `dustMs` (a spell card's floor still holds).
 * - `wind-feather`: stamina comes back `featherRegen` times faster for `featherMs`.
 * - `hush-lantern`: every enemy shot on screen fades (like the "tu turno" fade); the card under way is not captured.
 * - `spore-bomb`: stuns ordinary enemies within `sporeRadius` for `sporeStunMs` and scratches bosses (`sporeBossDamage`).
 * - `second-sprout`: packed, it stands the player up once with `sproutHp` of max HP on fainting. Never on Nightmare (option 3b).
 * - `exit-cord`: leaves the run keeping every Pokémoneda earned (a defeat keeps `COINS.defeatShare`). Not in a boss arena, not a guest.
 * - `fog-lamp`: reveals the whole floor on the minimap, berries included.
 */
export const CONSUMABLE_IDS = ['dew-tonic', 'clear-salt', 'wind-feather', 'ember-dust', 'spore-bomb', 'fog-lamp', 'second-sprout', 'hush-lantern', 'exit-cord'] as const;
export type ConsumableId = (typeof CONSUMABLE_IDS)[number];

export type ConsumableKind = 'heal' | 'cure' | 'boost' | 'bomb' | 'revive' | 'escape' | 'utility';

export interface ConsumableDef {
  id: ConsumableId;
  kind: ConsumableKind;
  rarity: Rarity;
  /** Fixed price per unit once the kind is unlocked (Pokémonedas). */
  price: number;
  /** Units one bag slot holds. */
  perSlot: number;
  /** Used by itself (the sprout, on fainting) instead of by hand. */
  passive?: boolean;
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  'dew-tonic': { id: 'dew-tonic', kind: 'heal', rarity: 'common', price: 20, perSlot: 2 },
  'clear-salt': { id: 'clear-salt', kind: 'cure', rarity: 'common', price: 20, perSlot: 1 },
  'wind-feather': { id: 'wind-feather', kind: 'boost', rarity: 'common', price: 35, perSlot: 1 },
  'ember-dust': { id: 'ember-dust', kind: 'boost', rarity: 'uncommon', price: 35, perSlot: 1 },
  'spore-bomb': { id: 'spore-bomb', kind: 'bomb', rarity: 'uncommon', price: 40, perSlot: 1 },
  'fog-lamp': { id: 'fog-lamp', kind: 'utility', rarity: 'uncommon', price: 40, perSlot: 1 },
  'second-sprout': { id: 'second-sprout', kind: 'revive', rarity: 'rare', price: 80, perSlot: 1, passive: true },
  'hush-lantern': { id: 'hush-lantern', kind: 'bomb', rarity: 'rare', price: 80, perSlot: 1 },
  'exit-cord': { id: 'exit-cord', kind: 'escape', rarity: 'rare', price: 80, perSlot: 1 },
};

export const CONSUMABLE_EFFECTS = {
  tonicHeal: 0.3,
  tonicMs: 1000,
  saltMs: 4000,
  dustDamage: 1.2,
  dustMs: 20_000,
  featherRegen: 1.5,
  featherMs: 20_000,
  sporeRadius: 72,
  sporeStunMs: 2000,
  /** Flat damage a spore bomb deals to every enemy in reach (bosses are only scratched: no stun). */
  sporeBossDamage: 6,
  sproutHp: 0.35,
} as const;

/** The bag: slots per run, and how many units of a kind the stock may hold. */
export const BAG = { slots: 3, stockCap: 9 } as const;

/**
 * The item gacha (owner's option 1a): a pull costs `cost`. Common (`rates.common`) pays `commonUnits` of an unlocked
 * common kind; uncommon pays `uncommonUnits` of an uncommon kind and unlocks it if new; rare unlocks a rare kind (one
 * unit), or pays a unit of one once all are unlocked. An uncommon or better is sure by the `uncommonPity`-th pull since
 * the last one, a rare by the `rarePity`-th. Units over the stock cap refund `overflowRefund` each.
 */
export const ITEM_GACHA = {
  cost: 50,
  rates: { common: 0.75, uncommon: 0.22, rare: 0.03 },
  commonUnits: [2, 3],
  uncommonUnits: [1, 2],
  rareUnits: 1,
  uncommonPity: 5,
  rarePity: 30,
  overflowRefund: 10,
} as const;

export const isConsumableId = (id: unknown): id is ConsumableId => typeof id === 'string' && (CONSUMABLE_IDS as readonly string[]).includes(id);

/** The kinds every player has from the start (the commons); the others are unlocked by the gacha. */
export const STARTER_CONSUMABLES: readonly ConsumableId[] = CONSUMABLE_IDS.filter((id) => CONSUMABLES[id].rarity === 'common');
