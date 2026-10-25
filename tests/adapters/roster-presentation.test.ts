import { describe, expect, it } from 'vitest';
import { enemyAttackType, enemyShotLook } from '../../src/adapters/move-vfx';
import { enemyAnim } from '../../src/adapters/sprite-anim';
import { EXPERIMENTAL_ENEMIES } from '../../src/data/enemies';
import { SPECIES, type SpeciesId } from '../../src/data/species';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { TYPE_COLORS } from '../../src/ui/tokens';

const enemy = (species: SpeciesId, attack?: string) => {
  const e = spawnEnemy(createWorld({ seed: 1, arena: { width: 400, height: 400 }, playerPos: vec(0, 0) }), species, vec(100, 100)).enemies[0]!;
  return { ...e, ai: { ...e.ai, mode: 'telegraph' as const, modeDurationMs: 500, ...(attack ? { attack } : {}) } };
};

describe('experimental roster presentation', () => {
  it('tints each telegraph by the attack it winds up', () => {
    expect(enemyAttackType(enemy('houndour'))).toBe('fire');
    expect(enemyAttackType(enemy('chinchou'))).toBe('electric');
    expect(enemyAttackType(enemy('clauncher'))).toBe('water');
    expect(enemyAttackType(enemy('croagunk', 'counter'))).toBe('fighting');
    expect(enemyAttackType(enemy('croagunk', 'jab'))).toBe('poison');
    expect(enemyAttackType(enemy('koffing', 'explode'))).toBe('poison');
    expect(enemyAttackType(enemy('wooper'))).toBe('ground');
  });

  it('draws still shots as puddles in their type colours, Poison keeping the spore look', () => {
    expect(enemyShotLook({ type: 'fire', vel: vec(0, 0) })).toEqual({ kind: 'cloud', puff: TYPE_COLORS.fire.core, speck: TYPE_COLORS.fire.glow, edge: TYPE_COLORS.fire.edge });
    expect(enemyShotLook({ type: 'poison', vel: vec(0, 0) })).toMatchObject({ puff: TYPE_COLORS.poison.core, speck: TYPE_COLORS.grass.glow });
  });

  it('animates every roster species winding up with its sheets', () => {
    for (const { species } of EXPERIMENTAL_ENEMIES) {
      expect(SPECIES[species].sprite).toBeTruthy();
      expect(enemyAnim(enemy(species), { timeMs: 0, sinceDefeatMs: Number.POSITIVE_INFINITY }).anim).toBe('Charge');
    }
  });
});
