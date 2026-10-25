import { describe, expect, it } from 'vitest';
import { EVOLUTIONS, isEvolved, lineRoot } from '../../src/data/evolutions';
import { PROGRESSION } from '../../src/data/progression';
import { SPECIES } from '../../src/data/species';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { catalog, LANGUAGES } from '../../src/i18n';

const SIX = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt'] as const;

describe('evolved forms: species and sprites', () => {
  it('about twenty evolutions, each of an existing, unevolved-or-evolved form, none a boss', () => {
    expect(EVOLUTIONS.length).toBeGreaterThanOrEqual(15);
    expect(EVOLUTIONS.length).toBeLessThanOrEqual(20);
    expect(new Set(EVOLUTIONS.map((e) => e.species)).size).toBe(EVOLUTIONS.length);
    for (const e of EVOLUTIONS) {
      expect(SPECIES[e.from], e.species).toBeDefined();
      expect(['lanturn', 'salazzle', 'trevenant']).not.toContain(e.species);
    }
    expect(lineRoot('gengar')).toBe('gastly');
    expect(isEvolved('gengar')).toBe(true);
    expect(isEvolved('gastly')).toBe(false);
  });

  for (const { species, from } of EVOLUTIONS) {
    it(`${species}: native Idle/Walk/Attack/Shoot/Charge/Hurt sheets, tougher than ${from}, pays more, named in every language`, () => {
      const def = SPECIES[species];
      const sprite = SPRITES.sprites[SPRITE_KEYS[def.sprite]];
      expect(sprite, species).toBeDefined();
      for (const anim of SIX) expect(sprite!.anims[anim]?.source, `${species} ${anim}`).toBe(anim);
      expect(def.maxHp).toBeGreaterThan(SPECIES[from].maxHp);
      expect(PROGRESSION.xpBySpecies[species]).toBeGreaterThan(PROGRESSION.xpBySpecies[from]!);
      for (const lang of LANGUAGES) expect(catalog(lang)[`species.${species}`], `${lang} ${species}`).toBeTruthy();
    });
  }
});
