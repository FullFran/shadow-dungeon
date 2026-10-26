import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { shinyKey, SPRITE_KEYS, SPRITES } from '../../src/data/sprites';

/** Shiny skins (odd/tasks/shiny-echo.md): every playable sheet has its shiny, with the same animations as the normal one, on disk. */
const SIX = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt'] as const;
const PUBLIC = join(__dirname, '..', '..', 'public', 'sprites');

describe('shiny sheets', () => {
  for (const species of PLAYABLE_SPECIES) {
    it(`${species} has a shiny sheet (its spent form too) with the same animations as its normal sheet`, () => {
      const def = SPECIES[species];
      for (const name of [def.sprite, ...(def.spentSprite ? [def.spentSprite] : [])]) {
        const base = SPRITES.sprites[SPRITE_KEYS[name]]!;
        const key = shinyKey(SPRITE_KEYS[name]);
        const shiny = SPRITES.sprites[key];
        expect(shiny, key).toBeDefined();
        expect(shiny!.species).toBe(base.species);
        for (const anim of [...SIX, 'Faint']) {
          const meta = shiny!.anims[anim];
          expect(meta, `${key} ${anim}`).toBeDefined();
          expect(meta!.rows).toBe(8);
          expect(existsSync(join(PUBLIC, key, meta!.file)), `${key}/${meta!.file}`).toBe(true);
        }
        // The same sheets as the normal form (Litwick's and Cubone's Shoot is their Charge in both).
        for (const anim of SIX) expect(shiny!.anims[anim]!.source, `${key} ${anim}`).toBe(base.anims[anim]!.source);
      }
    });
  }
});
