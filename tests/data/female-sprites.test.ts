import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEMALE_ART } from '../../src/core/gender';
import { SPECIES } from '../../src/data/species';
import { femaleKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

/** Female sheets (odd/tasks/pokemon-gender.md): each listed species has them, normal and shiny, with the animations the game plays, on disk. */
const SIX = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint'] as const;
const PUBLIC = join(__dirname, '..', '..', 'public', 'sprites');

describe('female sheets', () => {
  for (const species of FEMALE_ART) {
    for (const shiny of [false, true]) {
      it(`${species}${shiny ? ' shiny' : ''} has its female sheet, like its male one`, () => {
        const base = SPRITES.sprites[SPRITE_KEYS[SPECIES[species].sprite]]!;
        const key = femaleKey(SPRITE_KEYS[SPECIES[species].sprite], shiny);
        const sheet = SPRITES.sprites[key];
        expect(sheet, key).toBeDefined();
        expect(sheet!.species).toBe(species);
        for (const anim of SIX) {
          const meta = sheet!.anims[anim];
          expect(meta, `${key} ${anim}`).toBeDefined();
          expect(meta!.rows).toBe(8);
          expect(existsSync(join(PUBLIC, key, meta!.file)), `${key}/${meta!.file}`).toBe(true);
          // The same animations as the male sheet, so a move's frames line up (a fallback would show here).
          expect(meta!.source, `${key} ${anim}`).toBe(base.anims[anim]!.source);
        }
      });
    }
  }

  it('the catalog holds female sheets for the listed species only (the tool and the list agree)', () => {
    const female = Object.entries(SPRITES.sprites).filter(([key]) => key.endsWith('/0002')).map(([, sheet]) => sheet.species);
    expect([...new Set(female)].sort()).toEqual([...FEMALE_ART].sort());
    expect(female.length).toBe(FEMALE_ART.length * 2);
  });
});
