/** Pokémon types used by the game's content. Ids are English; display names come from i18n (`type.<id>`). */
export const POKEMON_TYPES = ['normal', 'ghost', 'fairy', 'dark', 'poison', 'steel', 'fire', 'ground', 'grass', 'bug', 'flying', 'water', 'electric', 'fighting'] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];

/**
 * Standard (Gen 6+) attack effectiveness among these types; missing entries
 * are neutral (x1). Immunities are listed as 0 here and softened by
 * `TUNING.combat.immunityMultiplier` at damage time, so a real-time fight
 * never has an attack that does literally nothing.
 */
export const TYPE_CHART: Record<PokemonType, Partial<Record<PokemonType, number>>> = {
  normal: { ghost: 0, steel: 0.5 },
  ghost: { normal: 0, ghost: 2, dark: 0.5 },
  fairy: { dark: 2, poison: 0.5, steel: 0.5, fire: 0.5, fighting: 2 },
  dark: { ghost: 2, dark: 0.5, fairy: 0.5, fighting: 0.5 },
  poison: { fairy: 2, poison: 0.5, ghost: 0.5, steel: 0, ground: 0.5, grass: 2 },
  steel: { fairy: 2, steel: 0.5, fire: 0.5, water: 0.5, electric: 0.5 },
  fire: { steel: 2, fire: 0.5, grass: 2, bug: 2, water: 0.5 },
  ground: { fire: 2, poison: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0, electric: 2 },
  grass: { ground: 2, poison: 0.5, steel: 0.5, fire: 0.5, grass: 0.5, bug: 0.5, flying: 0.5, water: 2 },
  bug: { dark: 2, grass: 2, ghost: 0.5, fairy: 0.5, poison: 0.5, steel: 0.5, fire: 0.5, flying: 0.5, fighting: 0.5 },
  flying: { grass: 2, bug: 2, steel: 0.5, electric: 0.5, fighting: 2 },
  water: { fire: 2, ground: 2, water: 0.5, grass: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, ground: 0 },
  fighting: { normal: 2, steel: 2, dark: 2, poison: 0.5, flying: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
};
