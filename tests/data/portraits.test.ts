import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasFemaleArt } from '../../src/core/gender';
import { portraitFor, PORTRAIT_MANIFEST } from '../../src/data/portraits';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { lookKey, SPRITE_KEYS } from '../../src/data/sprites';

/** Owner, 2026-11-04: the profile plate shows the partner's face (PMDCollab portraits), not the walking sprite again. */
const ROOT = new URL('../../src/assets/portraits/', import.meta.url).pathname;

describe('face portraits', () => {
  it('records the SpriteCollab commit they were downloaded from', () => {
    expect(PORTRAIT_MANIFEST.source).toMatch(/^[0-9a-f]{40}$/);
  });

  it('every playable species has its own base portrait on disk', () => {
    for (const id of PLAYABLE_SPECIES) {
      const p = portraitFor(lookKey(SPRITE_KEYS[SPECIES[id].sprite]));
      expect(p, id).not.toBeNull();
      expect(p!.kind, id).toBe('own');
      expect(existsSync(`${ROOT}${p!.file}`), `${id}: ${p!.file}`).toBe(true);
    }
  });

  it('every shiny and female look resolves to a file that exists (its own or the declared fallback)', () => {
    for (const id of PLAYABLE_SPECIES) {
      for (const shiny of [false, true]) {
        for (const female of hasFemaleArt(id) ? [false, true] : [false]) {
          const key = lookKey(SPRITE_KEYS[SPECIES[id].sprite], shiny, female);
          const p = portraitFor(key);
          const at = `${id} shiny=${shiny} female=${female} (${key})`;
          expect(p, at).not.toBeNull();
          expect(['own', 'fallback'], at).toContain(p!.kind);
          expect(existsSync(`${ROOT}${p!.file}`), `${at}: ${p!.file}`).toBe(true);
        }
      }
    }
  });

  it('a fallback is declared, never silent: it lands on a base or female-base look of the same form', () => {
    for (const id of PLAYABLE_SPECIES) {
      const shiny = portraitFor(lookKey(SPRITE_KEYS[SPECIES[id].sprite], true))!;
      if (shiny.kind === 'fallback') expect(shiny.file, id).toBe(portraitFor(lookKey(SPRITE_KEYS[SPECIES[id].sprite]))!.file);
    }
  });

  it('an unknown key has no portrait (the view draws a cropped head instead)', () => {
    expect(portraitFor('9999/0000')).toBeNull();
  });
});

describe('bundled art (sd-pre serves assets/ but not the raw public portraits/ and news/ folders, 2026-11-04)', () => {
  it('every portrait and news image is a bundled asset, not a raw public file', async () => {
    const { portraitUrl } = await import('../../src/adapters/portrait');
    const { newsImageUrl } = await import('../../src/adapters/bundled-art');
    const { CHANGELOG, CHANGELOG_SECTIONS } = await import('../../src/data/changelog');
    for (const file of PORTRAIT_MANIFEST.files) {
      const url = portraitUrl(`${file}/Normal.png`);
      expect(url, file).not.toMatch(/^(\.\/|\/)?portraits\//);
      expect(url, file).toMatch(/assets\/portraits\//);
    }
    for (const release of CHANGELOG)
      for (const section of CHANGELOG_SECTIONS)
        for (const item of release.sections[section] ?? [])
          if (item.image) {
            const url = newsImageUrl(item.image);
            expect(url, item.image).toMatch(/assets\/news\//);
          }
  });
});
