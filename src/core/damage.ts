import { TUNING } from '../data/tuning';
import { TYPE_CHART, type PokemonType } from '../data/types';

const { combat } = TUNING;

/** Product of the chart multipliers against each defender type, with immunities softened. */
export function typeEffectiveness(moveType: PokemonType, defenderTypes: readonly PokemonType[]): number {
  return defenderTypes.reduce((product, defender) => {
    const multiplier = TYPE_CHART[moveType][defender] ?? 1;
    return product * (multiplier === 0 ? combat.immunityMultiplier : multiplier);
  }, 1);
}

export interface DamageQuery {
  power: number;
  moveType: PokemonType;
  attackerTypes: readonly PokemonType[];
  defenderTypes: readonly PokemonType[];
  /** Product of charge, perfect-dodge buff and any other multipliers. */
  multiplier?: number;
}

/** Simplified Pokémon damage: no levels or stats in M0, just power, STAB, types and multipliers. */
export function computeDamage(query: DamageQuery): { damage: number; effectiveness: number } {
  const effectiveness = typeEffectiveness(query.moveType, query.defenderTypes);
  const stab = query.attackerTypes.includes(query.moveType) ? combat.stab : 1;
  const raw = query.power * combat.damagePerPower * stab * effectiveness * (query.multiplier ?? 1);
  return { damage: Math.max(1, Math.round(raw)), effectiveness };
}
