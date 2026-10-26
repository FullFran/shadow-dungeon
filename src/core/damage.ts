import { TUNING } from '../data/tuning';
import { GEN6_LEVELS, PLAYER_HIT_LEVELS, TYPE_CHART, type PokemonType, type TypeLevels } from '../data/types';

const { combat } = TUNING;

/**
 * Effectiveness of `moveType` on `defenderTypes` under a chart by levels
 * (data/types.ts `TypeLevels`): the net count of super-effective over resisted
 * defender types picks the level; each immunity multiplies in the softened
 * `immunityMultiplier`, so a real-time fight never has an attack that does
 * literally nothing.
 */
export function levelEffectiveness(levels: TypeLevels, moveType: PokemonType, defenderTypes: readonly PokemonType[]): number {
  let net = 0;
  let immune = 1;
  for (const defender of defenderTypes) {
    const multiplier = TYPE_CHART[moveType][defender] ?? 1;
    if (multiplier === 0) immune *= combat.immunityMultiplier;
    else if (multiplier > 1) net += 1;
    else if (multiplier < 1) net -= 1;
  }
  const level = net >= 2 ? levels.doubleSuper : net === 1 ? levels.superEffective : net === 0 ? 1 : net === -1 ? levels.resisted : levels.doubleResisted;
  return immune * level;
}

/** The standard (Gen 6+) chart, immunities softened: the enemies' hits on the player. */
export const typeEffectiveness = (moveType: PokemonType, defenderTypes: readonly PokemonType[]): number => levelEffectiveness(GEN6_LEVELS, moveType, defenderTypes);

/** The compressed chart of the player's hits on enemies (data/types.ts `PLAYER_HIT_LEVELS`). */
export const hitEffectiveness = (moveType: PokemonType, defenderTypes: readonly PokemonType[]): number => levelEffectiveness(PLAYER_HIT_LEVELS, moveType, defenderTypes);

export interface DamageQuery {
  power: number;
  moveType: PokemonType;
  attackerTypes: readonly PokemonType[];
  defenderTypes: readonly PokemonType[];
  /** Product of charge, perfect-dodge buff and any other multipliers. */
  multiplier?: number;
  /** A player's hit on an enemy: the compressed chart (`hitEffectiveness`); absent = the standard one. */
  onEnemy?: boolean;
}

/** Simplified Pokémon damage: no levels or stats in M0, just power, STAB, types and multipliers. */
export function computeDamage(query: DamageQuery): { damage: number; effectiveness: number } {
  const effectiveness = (query.onEnemy ? hitEffectiveness : typeEffectiveness)(query.moveType, query.defenderTypes);
  const stab = query.attackerTypes.includes(query.moveType) ? combat.stab : 1;
  const raw = query.power * combat.damagePerPower * stab * effectiveness * (query.multiplier ?? 1);
  return { damage: Math.max(1, Math.round(raw)), effectiveness };
}
