import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CREDITS_SECTIONS, TEAM, creditedArtists, splitSentences, splitSprites } from '../../src/app/credits';
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

describe('credits text that pages on a phone', () => {
  it('splits a paragraph into sentences without losing a character', () => {
    expect(splitSentences('Uno dos. Tres cuatro! ¿Cinco? Seis')).toEqual(['Uno dos.', 'Tres cuatro!', '¿Cinco?', 'Seis']);
    expect(splitSentences('Solo una frase sin punto final')).toEqual(['Solo una frase sin punto final']);
  });

  it('does not cut at a dot inside a version, a domain or a name', () => {
    expect(splitSentences('Licencia CC BY-NC 4.0 (uso no comercial). Otra frase en patch.gg, de Inc., y más.')).toEqual(['Licencia CC BY-NC 4.0 (uso no comercial).', 'Otra frase en patch.gg, de Inc., y más.']);
  });

  it('rejoins every credits paragraph of both languages to its original text', () => {
    const keys = ['credits.sprites', 'credits.font', 'credits.fontText', 'credits.music', 'credits.audio', 'credits.effects', 'credits.tiles', 'credits.data', 'credits.code', 'notice.fanProject'];
    for (const language of LANGUAGES) for (const key of keys) expect(splitSentences(catalog(language)[key]!).join(' '), `${language} ${key}`).toBe(catalog(language)[key]);
  });
});

describe('portrait credits (issue #47 S8)', () => {
  it('the screen credits PMDCollab for sprites and portraits in every language, and lists the portrait artists of CREDITS.md', () => {
    for (const lang of LANGUAGES) {
      const text = (catalog(lang) as Record<string, string>)['credits.sprites']!;
      expect(text, lang).toContain('PMDCollab SpriteCollab');
      expect(text, lang).toMatch(/retratos|portraits/);
    }
    const portraits = md.slice(md.indexOf('## Portraits'));
    const section = portraits.slice(0, portraits.indexOf('\n## ') > 0 ? portraits.indexOf('\n## ') : undefined);
    const listed = creditedArtists(section);
    expect(listed.length).toBeGreaterThan(20);
    const all = creditedArtists(md).map((a) => `${a.name}|${a.sprites}`);
    for (const artist of listed) expect(all, artist.name).toContain(`${artist.name}|${artist.sprites}`);
  });
});
