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
