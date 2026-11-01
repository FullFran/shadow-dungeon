import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { creditedArtists } from '../../src/app/credits';

describe('credits screen', () => {
  it('reads the artist table rows (name, contact, sprites) and skips the header and separator', () => {
    const md = ['# Credits', '', '| Artist | Contact | Sprites |', '|---|---|---|', '| JFain | - | mimikyu (0778) |', '| CHUNSOFT | https://x | poochyena (0261), gastly (0092) |', '', '## Font'].join('\n');
    expect(creditedArtists(md)).toEqual([
      { name: 'JFain', contact: null, sprites: 'mimikyu (0778)' },
      { name: 'CHUNSOFT', contact: 'https://x', sprites: 'poochyena (0261), gastly (0092)' },
    ]);
  });

  it('finds every artist of the real CREDITS.md', () => {
    const md = readFileSync(join(__dirname, '../../CREDITS.md'), 'utf8');
    const rows = md.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Artist'));
    expect(creditedArtists(md)).toHaveLength(rows.length);
    expect(rows.length).toBeGreaterThan(0);
  });
});

describe('everything the game builds on is credited', () => {
  const md = readFileSync('CREDITS.md', 'utf8');
  const screen = readFileSync('src/app/credits.ts', 'utf8');

  it.each([
    ['pixelfx', 'https://github.com/patch-gg/pixelfx'],
    ['Patch', 'Patch'],
    ['Sprite Fusion', 'Hugo Duprez'],
    ['Hollow Crown', 'rehan-remade'],
    ['Ninja Adventure', 'Pixel-Boy and AAA'],
    ['PokeAPI', 'https://pokeapi.co'],
    ['Smogon sets', 'https://data.pkmn.cc'],
    ['Trystero', 'https://github.com/dmotz/trystero'],
    ['PocketBase', 'https://github.com/pocketbase/pocketbase'],
  ])('%s is in CREDITS.md', (_name, text) => {
    expect(md).toContain(text);
  });

  it.each(['credits.effects', 'credits.tiles', 'credits.data', 'credits.code'])('the credits screen shows %s, in both languages', (key) => {
    expect(screen).toContain(`t('${key}')`);
    for (const file of ['es', 'en']) {
      const strings = JSON.parse(readFileSync(`src/i18n/${file}.json`, 'utf8')) as Record<string, string>;
      expect(strings[key]?.length, `${file} ${key}`).toBeGreaterThan(20);
    }
  });

  it('the screen names the effects library and its authors', () => {
    const strings = JSON.parse(readFileSync('src/i18n/es.json', 'utf8')) as Record<string, string>;
    for (const name of ['pixelfx', 'Patch', 'Hugo Duprez', 'rehan-remade']) expect(strings['credits.effects']).toContain(name);
  });

  it.each(['pixelfx', 'trystero'])('the published game carries the licence text of %s, whose code it ships', (name) => {
    const text = readFileSync(`public/licenses/${name}.txt`, 'utf8');
    expect(text).toMatch(/MIT License|Permission is hereby granted/);
    expect(md).toContain(`public/licenses/${name}.txt`);
  });

  it('regenerating the sprite section keeps the other sections', async () => {
    const { mergeCredits } = await import('../../tools/sprite-lib.mjs');
    const merged = mergeCredits(md, '# Credits\n\n## Sprites\n\nnew\n') as string;
    for (const heading of ['## Visual effects', '## Data', '## Code', '## Tiles', '## Music', '## Font']) expect(merged).toContain(heading);
  });
});
