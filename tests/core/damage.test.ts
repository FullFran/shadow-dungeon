import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import { computeDamage, hitEffectiveness, typeEffectiveness } from '../../src/core/damage';
import { GEN6_LEVELS, PLAYER_HIT_LEVELS, POKEMON_TYPES } from '../../src/data/types';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../../src/data/species';

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

describe("the player's chart (odd/tasks/type-balance.md)", () => {
  it("compresses the player's hits on enemies: x1.6, x2.2 cap, x0.75, x0.5; immunities as before", () => {
    expect(PLAYER_HIT_LEVELS).toEqual({ superEffective: 1.6, doubleSuper: 2.2, resisted: 0.75, doubleResisted: 0.5 });
    expect(hitEffectiveness('ghost', ['ghost'])).toBe(1.6);
    expect(hitEffectiveness('ground', SPECIES.salazzle.types)).toBe(2.2); // x4 on the standard chart
    expect(typeEffectiveness('ground', SPECIES.salazzle.types)).toBe(4);
    expect(hitEffectiveness('ghost', ['dark'])).toBe(0.75);
    expect(hitEffectiveness('bug', SPECIES.aegislash.types)).toBe(0.5); // x0.25 on the standard chart
    expect(hitEffectiveness('dark', ['ghost', 'fairy'])).toBe(1);
    expect(hitEffectiveness('normal', ['ghost'])).toBe(combat.immunityMultiplier);
    expect(hitEffectiveness('normal', SPECIES.aegislash.types)).toBe(combat.immunityMultiplier * 0.75);
  });

  it('keeps every matchup on the same side of neutral, never past its cap, for every move type on every species', () => {
    for (const type of POKEMON_TYPES) {
      for (const id of Object.keys(SPECIES) as SpeciesId[]) {
        const raw = typeEffectiveness(type, SPECIES[id].types);
        const hit = hitEffectiveness(type, SPECIES[id].types);
        expect(Math.sign(hit - 1)).toBe(Math.sign(raw - 1));
        expect(hit).toBeLessThanOrEqual(PLAYER_HIT_LEVELS.doubleSuper);
        expect(hit).toBeGreaterThanOrEqual(combat.immunityMultiplier * PLAYER_HIT_LEVELS.doubleResisted);
      }
    }
  });

  it("leaves the enemies' hits on the player on the standard chart (enemy fairness untouched)", () => {
    expect(GEN6_LEVELS).toEqual({ superEffective: 2, doubleSuper: 4, resisted: 0.5, doubleResisted: 0.25 });
    for (const id of PLAYABLE_SPECIES) {
      for (const type of POKEMON_TYPES) {
        const onPlayer = computeDamage({ power: 100, moveType: type, attackerTypes: [], defenderTypes: SPECIES[id].types });
        expect(onPlayer.effectiveness).toBe(typeEffectiveness(type, SPECIES[id].types));
      }
    }
  });

  it("computeDamage reads the player's chart only for a hit on an enemy", () => {
    const onEnemy = computeDamage({ power: 100, moveType: 'ground', attackerTypes: ['ground'], defenderTypes: SPECIES.salazzle.types, onEnemy: true });
    expect(onEnemy.effectiveness).toBe(2.2);
    expect(onEnemy.damage).toBe(Math.round(100 * combat.damagePerPower * combat.stab * 2.2));
  });
});
