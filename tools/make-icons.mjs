// Draws the app icons (an original pixel-art eclipse, no franchise art) and writes them as PNGs.
// Reproducible: pure code, no randomness, no external tools. Run: node tools/make-icons.mjs
// Outputs public/icons/icon-192.png, icon-512.png, icon-maskable-512.png and apple-touch-icon.png (180).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

// Colours from src/ui/tokens.ts (ink, eclipse, eclipseGlow) plus a pale rim.
const INK = [5, 6, 13];
const ECLIPSE = [232, 40, 58];
const GLOW = [255, 106, 61];
const RIM = [255, 214, 170];
const STAR = [170, 182, 220];

/** Art grid: the icon is drawn on GRID x GRID cells, each scaled up as a square block (crisp pixel art). */
const GRID = 32;

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));

/** Colour of art cell (cx, cy); `inset` shrinks the artwork towards the centre (maskable safe zone). */
function cell(cx, cy, inset) {
  const u = (cx + 0.5) / GRID - 0.5;
  const v = (cy + 0.5) / GRID - 0.5;
  const s = 1 / inset;
  const x = u * s;
  const y = v * s;
  // The moon sits a little up-left of the sun, so the corona flares bottom-right (as on the title screen).
  const sun = Math.hypot(x, y);
  const moon = Math.hypot(x + 0.035, y + 0.035);
  const R = 0.25;
  if (moon < R - 0.01) return INK;
  if (sun < R + 0.03) return RIM;
  const glow = Math.exp(-(sun - R) / 0.09);
  if (glow > 0.08) return mix(mix(INK, ECLIPSE, glow * 1.3), GLOW, glow * glow);
  // A few fixed stars.
  const stars = [[4, 5], [26, 4], [7, 25], [27, 22], [15, 3], [22, 28], [3, 15]];
  if (inset === 1 && stars.some(([sx, sy]) => sx === cx && sy === cy)) return STAR;
  return INK;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** An RGB PNG of `size` px; `inset` 1 = full bleed art, 0.8 = maskable safe zone. */
export function iconPng(size, inset = 1) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = cell(Math.floor((x * GRID) / size), Math.floor((y * GRID) / size), inset);
      const at = y * (size * 3 + 1) + 1 + x * 3;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
const files = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-maskable-512.png', 512, 0.8],
  ['apple-touch-icon.png', 180, 1],
];
for (const [name, size, inset] of files) {
  writeFileSync(join(out, name), iconPng(size, inset));
  console.log('wrote', name);
}
