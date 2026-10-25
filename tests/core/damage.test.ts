import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { computeDamage, typeEffectiveness } from '../../src/core/damage';
import { SPECIES } from '../../src/data/species';

const { combat } = TUNING;

describe('type effectiveness', () => {
  it('makes the GDD matchups matter from minute one', () => {
    expect(typeEffectiveness('ghost', SPECIES.gastly.types)).toBe(2);
    expect(typeEffectiveness('ghost', SPECIES.aegislash.types)).toBe(2);
    expect(typeEffectiveness('fairy', SPECIES.poochyena.types)).toBe(2);
    expect(typeEffectiveness('ghost', SPECIES.poochyena.types)).toBe(0.5);
    expect(typeEffectiveness('fairy', SPECIES.aegislash.types)).toBe(0.5);
  });

  it('multiplies dual types and softens immunities', () => {
    expect(typeEffectiveness('dark', ['ghost', 'fairy'])).toBe(1); // 2 x 0.5
    expect(typeEffectiveness('normal', ['ghost'])).toBe(combat.immunityMultiplier);
    expect(typeEffectiveness('poison', ['steel', 'ghost'])).toBe(combat.immunityMultiplier * 0.5);
    expect(typeEffectiveness('normal', ['dark'])).toBe(1);
  });
});

describe('computeDamage', () => {
  it('applies power scale, STAB, effectiveness and multipliers', () => {
    const base = computeDamage({ power: 100, moveType: 'normal', attackerTypes: ['dark'], defenderTypes: ['dark'] });
    expect(base).toEqual({ damage: Math.round(100 * combat.damagePerPower), effectiveness: 1 });

    const stab = computeDamage({ power: 100, moveType: 'ghost', attackerTypes: ['ghost'], defenderTypes: ['normal', 'dark'] });
    expect(stab.effectiveness).toBe(combat.immunityMultiplier * 0.5);

    const buffed = computeDamage({ power: 100, moveType: 'fairy', attackerTypes: ['fairy'], defenderTypes: ['dark'], multiplier: 1.5 });
    expect(buffed.damage).toBe(Math.round(100 * combat.damagePerPower * combat.stab * 2 * 1.5));
  });

  it('never deals less than 1 damage', () => {
    expect(computeDamage({ power: 1, moveType: 'normal', attackerTypes: [], defenderTypes: ['ghost'] }).damage).toBe(1);
  });
});
