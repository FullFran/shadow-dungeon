// Pure helpers for tools/fetch-sprites.mjs: SpriteCollab AnimData/credits
// parsing and a minimal PNG decoder (8-bit, non-interlaced) used to find the
// ground anchor from each animation's -Shadow.png. No network, no file I/O.
import { inflateSync } from 'node:zlib';

/** Row order of every SpriteCollab sheet (one row per facing direction). */
export const DIRECTIONS = ['down', 'downRight', 'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft'];

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}>([^<]*)</${name}>`));
  return match ? match[1].trim() : undefined;
}

function intTag(block, name) {
  const value = tag(block, name);
  return value === undefined ? undefined : Number.parseInt(value, 10);
}

/**
 * Parses AnimData.xml into { shadowSize, anims } where each anim is either
 * { copyOf } or { frameWidth, frameHeight, durations, rushFrame?, hitFrame?, returnFrame? }.
 * Durations are in 1/60 s ticks.
 */
export function parseAnimData(xml) {
  /** @type {Record<string, any>} */
  const anims = {};
  for (const [, block] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const name = tag(block, 'Name');
    if (!name) continue;
    const copyOf = tag(block, 'CopyOf');
    if (copyOf) {
      anims[name] = { copyOf };
      continue;
    }
    const frameWidth = intTag(block, 'FrameWidth');
    const frameHeight = intTag(block, 'FrameHeight');
    if (frameWidth === undefined || frameHeight === undefined) continue;
    const durations = [...block.matchAll(/<Duration>(\d+)<\/Duration>/g)].map((m) => Number(m[1]));
    const anim = { frameWidth, frameHeight, durations };
    for (const [key, xmlName] of [['rushFrame', 'RushFrame'], ['hitFrame', 'HitFrame'], ['returnFrame', 'ReturnFrame']]) {
      const value = intTag(block, xmlName);
      if (value !== undefined) anim[key] = value;
    }
    anims[name] = anim;
  }
  return { shadowSize: intTag(xml, 'ShadowSize') ?? 1, anims };
}

/** Follows CopyOf chains. Returns { name, anim } of the concrete anim, or null. */
export function resolveAnim(anims, name) {
  const seen = new Set();
  let current = name;
  while (current in anims && !seen.has(current)) {
    seen.add(current);
    const anim = anims[current];
    if (!anim.copyOf) return { name: current, anim };
    current = anim.copyOf;
  }
  return null;
}

/** Picks the first available candidate (wanted name, then its fallbacks). */
export function pickAnim(anims, wanted, fallbacks = []) {
  for (const candidate of [wanted, ...fallbacks]) {
    const resolved = resolveAnim(anims, candidate);
    if (resolved) return resolved;
  }
  return null;
}

/** credit_names.txt: header line, then Name<TAB>Discord<TAB>Contact. Keyed by both name and Discord id. */
export function parseCreditNames(text) {
  const names = new Map();
  for (const line of text.split(/\r?\n/).slice(1)) {
    const [display, discord, contact = ''] = line.split('\t').map((part) => part.trim());
    if (!display) continue;
    const entry = { name: display, contact };
    names.set(display, entry);
    if (discord) names.set(discord, entry);
  }
  return names;
}

/** credits.txt (no header): date<TAB>author<TAB>status<TAB>license<TAB>anims. */
export function parseCredits(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((part) => part.trim()))
    .filter((parts) => parts.length >= 2 && parts[1])
    .map(([date, author, status = '', license = '', anims = '']) => ({
      date,
      author,
      status,
      license,
      anims: anims ? anims.split(',') : [],
    }));
}

/** Maps a raw author (name or Discord id like "<@!123>") to a display name and contact. */
export function resolveAuthor(names, author) {
  return names.get(author) ?? { name: author, contact: '' };
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** Decodes an 8-bit, non-interlaced PNG (grey, RGB, palette, grey+alpha, RGBA) to RGBA pixels. */
export function decodePng(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('not a PNG');
  let offset = 8;
  let header;
  let palette;
  let transparency;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      header = {
        width: chunk.readUInt32BE(0),
        height: chunk.readUInt32BE(4),
        bitDepth: chunk[8],
        colorType: chunk[9],
        interlace: chunk[12],
      };
    } else if (type === 'PLTE') palette = chunk;
    else if (type === 'tRNS') transparency = chunk;
    else if (type === 'IDAT') data.push(chunk);
    else if (type === 'IEND') break;
  }
  if (!header) throw new Error('missing IHDR');
  const { width, height, bitDepth, colorType, interlace } = header;
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`unsupported PNG (depth ${bitDepth}, interlace ${interlace})`);
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error(`unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      let value = row[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value += pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      }
      pixels[y * stride + x] = value & 0xff;
    }
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    let r, g, b, a = 255;
    if (colorType === 3) {
      const index = pixels[i];
      [r, g, b] = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
      if (transparency && index < transparency.length) a = transparency[index];
    } else if (colorType === 0 || colorType === 4) {
      r = g = b = pixels[i * channels];
      if (colorType === 4) a = pixels[i * channels + 1];
    } else {
      [r, g, b] = [pixels[i * channels], pixels[i * channels + 1], pixels[i * channels + 2]];
      if (colorType === 6) a = pixels[i * channels + 3];
    }
    rgba.set([r, g, b, a], i * 4);
  }
  return { width, height, rgba };
}

/**
 * Ground anchor of an animation: centroid of the opaque pixels of the
 * first frame (first row, "down") of its -Shadow.png. Null if empty.
 */
export function shadowAnchor(image, frameWidth, frameHeight) {
  let sumX = 0;
  let sumY = 0;
  let count = 0;
  for (let y = 0; y < Math.min(frameHeight, image.height); y++) {
    for (let x = 0; x < Math.min(frameWidth, image.width); x++) {
      if (image.rgba[(y * image.width + x) * 4 + 3] > 40) {
        sumX += x;
        sumY += y;
        count++;
      }
    }
  }
  return count ? { x: Math.round((sumX / count) * 10) / 10, y: Math.round((sumY / count) * 10) / 10 } : null;
}
