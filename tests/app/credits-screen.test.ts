import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS_SECTIONS, TEAM, creditedArtists, splitSprites } from '../../src/app/credits';
import { catalog, LANGUAGES } from '../../src/i18n';

const md = readFileSync('CREDITS.md', 'utf8');

describe('credits team', () => {
  it('credits the creator and Álvaro Fernández as designer and frontend developer', () => {
    expect(TEAM.map((m) => m.name)).toEqual(['Fran', 'Álvaro Fernández']);
    expect(catalog('es')[TEAM[1]!.roleKey]).toBe('Diseñador y Desarrollador Frontend');
    expect(catalog('en')[TEAM[1]!.roleKey]).toBe('Designer and Frontend Developer');
    // Owner, 2026-11-03: GitHub users from the repository, Fran as creator and developer.
    expect(TEAM.map((m) => m.github)).toEqual(['FullFran', 'alvaroofernaandez']);
    for (const m of TEAM) expect(m.link).toBe(`https://github.com/${m.github}`);
    expect(catalog('es')[TEAM[0]!.roleKey]).toBe('Creador y Desarrollador');
    expect(catalog('en')[TEAM[0]!.roleKey]).toBe('Creator and Developer');
  });

  it('every section and role is named in both languages, without em dashes', () => {
    const keys = [...CREDITS_SECTIONS.map((s) => s.titleKey), ...TEAM.map((m) => m.roleKey), 'credits.spriteCount', 'credits.spriteOne', 'credits.showSprites', 'credits.hideSprites', 'credits.licence'];
    for (const language of LANGUAGES) {
      for (const key of keys) {
        expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
        expect(catalog(language)[key], key).not.toContain('—');
      }
    }
  });

  it('orders the sections: team first, sprites, fonts, tiles, music, libraries, legal notice', () => {
    expect(CREDITS_SECTIONS.map((s) => s.id)).toEqual(['team', 'sprites', 'fonts', 'tiles', 'music', 'libraries', 'legal']);
  });
});

describe('credited sprites survive the cards', () => {
  it('splitting an artist keeps every species entry and rejoins to the original text', () => {
    expect(splitSprites('abra shiny (0063/0000/0001), pawniard (0624)')).toEqual(['abra shiny (0063/0000/0001)', 'pawniard (0624)']);
    for (const artist of creditedArtists(md)) expect(splitSprites(artist.sprites).join(', '), artist.name).toBe(artist.sprites);
  });

  it('every entry of every row of CREDITS.md is a card entry (count equality)', () => {
    const rows = md.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Artist') && !line.startsWith('| ---'));
    const expected = rows.reduce((sum, line) => sum + (line.split('|')[3] ?? '').split(/\),/).length, 0);
    const got = creditedArtists(md).reduce((sum, a) => sum + splitSprites(a.sprites).length, 0);
    expect(got).toBe(expected);
  });
});
