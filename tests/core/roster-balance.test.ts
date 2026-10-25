import { describe, expect, it } from 'vitest';
import { ENEMY_BEHAVIOUR, EXPERIMENTAL_ENEMIES, type EnemyAttackDef } from '../../src/data/enemies';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { TUNING } from '../../src/data/tuning';
import { computeDamage } from '../../src/core/damage';

/** Every damaging attack of an experimental species, with the souls windows around it. */
function attacksOf(species: (typeof EXPERIMENTAL_ENEMIES)[number]['species']): { name: string; attack: EnemyAttackDef; telegraphMs: number }[] {
  const def = ENEMY_BEHAVIOUR[species]!;
  switch (def.kind) {
    case 'lunger':
      return [{ name: 'lunge', attack: def.attack, telegraphMs: def.telegraphMs }];
    case 'slammer':
      return [
        { name: 'slam', attack: def.attack, telegraphMs: def.telegraphMs },
        ...(def.puddle ? [{ name: 'puddle', attack: def.puddle, telegraphMs: def.telegraphMs }] : []),
        ...(def.trail ? [{ name: 'trail', attack: def.trail.puddle, telegraphMs: Number.POSITIVE_INFINITY }] : []),
      ];
    case 'caster':
      return [{ name: 'ball', attack: def.projectile, telegraphMs: def.telegraphMs }];
    case 'beam':
    case 'pulse':
    case 'cone':
      return [{ name: def.kind, attack: def.attack, telegraphMs: def.telegraphMs }];
    case 'mortar':
      return [
        { name: 'lob', attack: def.attack, telegraphMs: def.telegraphMs + def.flightMs - def.impactMs },
        { name: 'pool', attack: def.pool, telegraphMs: def.telegraphMs + def.flightMs },
      ];
    case 'bomber':
      return [
        { name: 'puff', attack: def.cloud, telegraphMs: def.telegraphMs },
        { name: 'explode', attack: def.explode.attack, telegraphMs: def.explode.telegraphMs },
      ];
    case 'counter':
      return [
        { name: 'counter', attack: def.counter.attack, telegraphMs: def.counter.telegraphMs },
        { name: 'jab', attack: def.jab.attack, telegraphMs: def.jab.telegraphMs + def.stanceMs },
      ];
    default:
      return [];
  }
}

describe('experimental roster balance (provisional budget)', () => {
  for (const { species } of EXPERIMENTAL_ENEMIES) {
    it(`${species}: no single hit takes more than ${TUNING.roster.maxHitShare * 100}% of any starter's HP, and slow wind-ups pay for big hits`, () => {
      for (const { name, attack, telegraphMs } of attacksOf(species)) {
        for (const playable of PLAYABLE_SPECIES) {
          const target = SPECIES[playable];
          const { damage } = computeDamage({ power: attack.power, moveType: attack.type, attackerTypes: SPECIES[species].types, defenderTypes: target.types });
          expect(damage / target.maxHp, `${species} ${name} vs ${playable}`).toBeLessThanOrEqual(TUNING.roster.maxHitShare);
        }
        // Readable on a stream: no damaging wind-up shorter than a roll can answer.
        expect(telegraphMs, `${species} ${name}`).toBeGreaterThanOrEqual(TUNING.roster.minTelegraphMs);
      }
    });
  }
});
