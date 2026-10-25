import { describe, expect, it } from 'vitest';
import { EXPERIMENTAL_ENEMIES } from '../../src/data/enemies';
import { PROGRESSION } from '../../src/data/progression';
import { SPECIES } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { POKEMON_TYPES, TYPE_CHART } from '../../src/data/types';
import { typeEffectiveness } from '../../src/core/damage';
import { TYPE_COLORS } from '../../src/ui/tokens';
import { catalog } from '../../src/i18n';

const CORE_ANIMS = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt'];

describe('experimental roster data', () => {
  const ids = EXPERIMENTAL_ENEMIES.map((e) => e.species);

  it('lists 14 distinct species, none of them the Crypt remaster ones', () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(14);
    for (const taken of ['duskull', 'golett', 'pawniard', 'sableye']) expect(ids).not.toContain(taken);
  });

  it('has at least two Fire species for Flash Fire to absorb', () => {
    expect(ids.filter((id) => SPECIES[id].types.includes('fire')).length).toBeGreaterThanOrEqual(2);
  });

  for (const entry of EXPERIMENTAL_ENEMIES) {
    it(`${entry.species}: species, sprite with native core animations, XP, name and a sane spawn entry`, () => {
      const species = SPECIES[entry.species];
      expect(species.movepool).toEqual([]);
      expect(species.maxHp).toBeGreaterThan(0);
      const meta = SPRITES.sprites[SPRITE_KEYS[species.sprite]];
      expect(meta).toBeDefined();
      for (const anim of CORE_ANIMS) expect(meta!.anims[anim]?.source).toBe(anim);
      expect(PROGRESSION.xpBySpecies[entry.species]).toBeGreaterThan(0);
      expect(catalog('es')[`species.${entry.species}`]).toBeTruthy();
      expect(entry.minDepth).toBeGreaterThanOrEqual(1);
      expect(entry.weight).toBeGreaterThan(0);
      expect(entry.coins).toBeGreaterThan(0);
    });
  }
});

describe('new types', () => {
  it('every type has a colour and a chart row', () => {
    for (const type of POKEMON_TYPES) {
      expect(TYPE_COLORS[type]).toBeDefined();
      expect(TYPE_CHART[type]).toBeDefined();
    }
  });

  it('follows the standard chart for Water, Electric and Fighting', () => {
    expect(typeEffectiveness('water', ['fire'])).toBe(2);
    expect(typeEffectiveness('fire', ['water'])).toBe(0.5);
    expect(typeEffectiveness('electric', ['water', 'flying'])).toBe(4);
    expect(typeEffectiveness('grass', ['water', 'ground'])).toBe(4);
    expect(typeEffectiveness('fighting', ['dark'])).toBe(2);
    expect(typeEffectiveness('fairy', ['fighting'])).toBe(2);
  });
});
