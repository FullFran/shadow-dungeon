import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  creditsMarkdown,
  decodePng,
  mergeCredits,
  parseAnimData,
  parseCreditNames,
  parseCredits,
  pickAnim,
  resolveAuthor,
  shadowAnchor,
} from '../tools/sprite-lib.mjs';
import { SPRITE_KEYS, SPRITES } from '../src/data/sprites';

const ANIM_DATA = `<?xml version="1.0"?>
<AnimData>
  <ShadowSize>2</ShadowSize>
  <Anims>
    <Anim><Name>Walk</Name><FrameWidth>32</FrameWidth><FrameHeight>40</FrameHeight>
      <Durations><Duration>8</Duration><Duration>10</Duration></Durations></Anim>
    <Anim><Name>Attack</Name><FrameWidth>72</FrameWidth><FrameHeight>72</FrameHeight>
      <RushFrame>1</RushFrame><HitFrame>3</HitFrame><ReturnFrame>6</ReturnFrame>
      <Durations><Duration>2</Duration><Duration>6</Duration></Durations></Anim>
    <Anim><Name>Strike</Name><CopyOf>Attack</CopyOf></Anim>
  </Anims>
</AnimData>`;

function crc32(bytes: Buffer): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Builds a 4x2 RGBA PNG with "up" filter rows where only pixels (1,1) and (3,1) are opaque. */
function tinyPng(): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(4, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const row0 = [0, ...new Array(16).fill(0)];
  // Filter 2 (up): row 0 is all zero, so raw bytes equal the pixel values.
  const row1 = [2, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 255];
  const raw = Buffer.from([...row0, ...row1]);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('AnimData parsing', () => {
  const { shadowSize, anims } = parseAnimData(ANIM_DATA);

  it('reads frame size, durations, timing markers and shadow size', () => {
    expect(shadowSize).toBe(2);
    expect(anims.Walk).toEqual({ frameWidth: 32, frameHeight: 40, durations: [8, 10] });
    expect(anims.Attack).toMatchObject({ rushFrame: 1, hitFrame: 3, returnFrame: 6, durations: [2, 6] });
  });

  it('resolves CopyOf and fallbacks to a concrete sheet', () => {
    expect(pickAnim(anims, 'Strike')?.name).toBe('Attack');
    expect(pickAnim(anims, 'Faint', ['Hurt', 'Walk'])?.name).toBe('Walk');
    expect(pickAnim(anims, 'Faint', ['Hurt'])).toBeNull();
  });
});

describe('credits', () => {
  const names = parseCreditNames('Name\tDiscord\tContact\nAudino\t<@!117>\thttps://github.com/audinowho\nCHUNSOFT\tCHUNSOFT\t\n');

  it('maps Discord ids and plain names to display names', () => {
    const [credit] = parseCredits('2022-07-26 02:27:38\t<@!117>\tCUR\tPMDCollab_1\tIdle,Walk\n');
    expect(credit?.anims).toEqual(['Idle', 'Walk']);
    expect(resolveAuthor(names, credit!.author)).toEqual({ name: 'Audino', contact: 'https://github.com/audinowho' });
    expect(resolveAuthor(names, 'CHUNSOFT').name).toBe('CHUNSOFT');
    expect(resolveAuthor(names, '<@!999>').name).toBe('<@!999>');
  });
});

describe('CREDITS.md regeneration', () => {
  const perArtist = new Map([
    ['Zed', { contact: '', sprites: new Set(['gastly (0092)']) }],
    ['amy', { contact: 'https://a.example', sprites: new Set(['mimikyu (0778)']) }],
  ]);
  const generated = creditsMarkdown(perArtist);

  it('writes the sprite table sorted by artist, "-" for a missing contact', () => {
    expect(generated).toContain('| amy | https://a.example | mimikyu (0778) |\n| Zed | - | gastly (0092) |');
    expect(generated.startsWith('# Credits\n')).toBe(true);
  });

  it('keeps every hand-written section (Font, Music, Audio...) and replaces only the sprites', () => {
    const existing = `${creditsMarkdown(new Map([['Old', { contact: '', sprites: new Set(['x (0001)']) }]]))}\n## Music\n\nTrack by someone.\n\n## Font\n\nPixel font.\n`;
    const merged = mergeCredits(existing, generated);
    expect(merged).not.toContain('| Old |');
    expect(merged).toContain('| Zed | - | gastly (0092) |');
    expect(merged.indexOf('## Music')).toBeGreaterThan(merged.indexOf('## Sprites'));
    expect(merged).toContain('## Music\n\nTrack by someone.\n');
    expect(merged).toContain('## Font\n\nPixel font.\n');
    expect(merged.indexOf('## Music')).toBeLessThan(merged.indexOf('## Font'));
    expect(mergeCredits(merged, generated)).toBe(merged);
  });

  it('is just the generated file when there is nothing to keep', () => {
    expect(mergeCredits(null, generated)).toBe(generated);
    expect(mergeCredits(generated, generated)).toBe(generated);
  });

  it('round-trips the real CREDITS.md: regenerating keeps its Font and Music sections', () => {
    const real = readFileSync(join(__dirname, '..', 'CREDITS.md'), 'utf8');
    const merged = mergeCredits(real, generated);
    for (const heading of ['## Sprites', '## Music', '## Font']) expect(merged, heading).toContain(heading);
  });
});

describe('PNG decoding and shadow anchor', () => {
  it('decodes filtered RGBA rows and finds the opaque centroid of the first frame', () => {
    const image = decodePng(tinyPng());
    expect([image.width, image.height]).toEqual([4, 2]);
    expect(shadowAnchor(image, 4, 2)).toEqual({ x: 2, y: 1 });
    expect(shadowAnchor(image, 2, 2)).toEqual({ x: 1, y: 1 });
    expect(shadowAnchor(image, 1, 1)).toBeNull();
  });
});

describe('generated sprite meta', () => {
  it('covers every M0 sprite with the seven core animations in 8 directions', () => {
    expect(SPRITES.directions).toHaveLength(8);
    for (const key of Object.values(SPRITE_KEYS)) {
      const sprite = SPRITES.sprites[key];
      expect(sprite, key).toBeDefined();
      for (const anim of ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Faint']) {
        const meta = sprite!.anims[anim];
        expect(meta, `${key} ${anim}`).toBeDefined();
        expect(meta!.rows).toBe(8);
        expect(meta!.durations).toHaveLength(meta!.frameCount);
      }
    }
  });
});
