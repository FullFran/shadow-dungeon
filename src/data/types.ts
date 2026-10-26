/** Pokémon types used by the game's content. Ids are English; display names come from i18n (`type.<id>`). */
export const POKEMON_TYPES = ['normal', 'ghost', 'fairy', 'dark', 'poison', 'steel', 'fire', 'ground', 'grass', 'bug', 'flying', 'water', 'electric', 'fighting', 'rock', 'psychic', 'ice', 'dragon'] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

/**
 * Standard (Gen 6+) attack effectiveness among these types; missing entries
 * are neutral (x1). Immunities are listed as 0 here and softened by
 * `TUNING.combat.immunityMultiplier` at damage time, so a real-time fight
 * never has an attack that does literally nothing.
 */
export const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  normal: { ghost: 0, steel: 0.5, rock: 0.5 },
  ghost: { normal: 0, ghost: 2, dark: 0.5, psychic: 2 },
  fairy: { dark: 2, poison: 0.5, steel: 0.5, fire: 0.5, fighting: 2, dragon: 2 },
  dark: { ghost: 2, dark: 0.5, fairy: 0.5, fighting: 0.5, psychic: 2 },
  poison: { fairy: 2, poison: 0.5, ghost: 0.5, steel: 0, ground: 0.5, grass: 2, rock: 0.5 },
  steel: { fairy: 2, steel: 0.5, fire: 0.5, water: 0.5, electric: 0.5, rock: 2, ice: 2 },
  fire: { steel: 2, fire: 0.5, grass: 2, bug: 2, water: 0.5, rock: 0.5, ice: 2, dragon: 0.5 },
  ground: { fire: 2, poison: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0, electric: 2, rock: 2 },
  grass: { ground: 2, poison: 0.5, steel: 0.5, fire: 0.5, grass: 0.5, bug: 0.5, flying: 0.5, water: 2, rock: 2, dragon: 0.5 },
  bug: { dark: 2, grass: 2, psychic: 2, ghost: 0.5, fairy: 0.5, poison: 0.5, steel: 0.5, fire: 0.5, flying: 0.5, fighting: 0.5 },
  flying: { grass: 2, bug: 2, steel: 0.5, electric: 0.5, fighting: 2, rock: 0.5 },
  water: { fire: 2, ground: 2, water: 0.5, grass: 0.5, rock: 2, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, ground: 0, dragon: 0.5 },
  fighting: { normal: 2, steel: 2, dark: 2, poison: 0.5, flying: 0.5, bug: 0.5, fairy: 0.5, ghost: 0, rock: 2, ice: 2, psychic: 0.5 },
  // Rock (Nihilego, the Toxic Swamp's guardian).
  rock: { fire: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5, ice: 2 },
  // Psychic and Ice: only player moves (the tutor's, the gacha lines'); no enemy has them yet.
  psychic: { fighting: 2, poison: 2, steel: 0.5, psychic: 0.5, dark: 0 },
  ice: { grass: 2, ground: 2, flying: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5, dragon: 2 },
  // Dragon: Axew's line (data/line-moves.ts); no enemy has it yet.
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
};

/**
 * A type chart by effectiveness level: the net count of a move's
 * super-effective defender types over its resisted ones (an immunity is
 * softened apart, `TUNING.combat.immunityMultiplier`). Net 0 is neutral
 * (a super-effective and a resisted type cancel out, as in the games).
 */
export interface TypeLevels {
  /** Net +1. */
  superEffective: number;
  /** Net +2 (both types): the cap. */
  doubleSuper: number;
  /** Net −1. */
  resisted: number;
  /** Net −2. */
  doubleResisted: number;
}

/** The standard chart as levels (x2, x4, x0.5, x0.25): enemies' hits on the player keep it. */
export const GEN6_LEVELS: TypeLevels = { superEffective: 2, doubleSuper: 4, resisted: 0.5, doubleResisted: 0.25 };

/**
 * The compressed chart of the player's hits on enemies (owner decision
 * 2026-10-26, odd/tasks/type-balance.md, reports/balance/type-chart-baseline.md):
 * the bosses' danmaku does not depend on the player's type, so a full x2
 * (x3 with STAB, x6 on both types) let a matching species skip the spell
 * cards. Chart B of the study: advantage still counts (x1.6, x2.2 on both
 * types), never as a shortcut; a resisted move hurts more than before.
 */
export const PLAYER_HIT_LEVELS: TypeLevels = { superEffective: 1.6, doubleSuper: 2.2, resisted: 0.75, doubleResisted: 0.5 };
