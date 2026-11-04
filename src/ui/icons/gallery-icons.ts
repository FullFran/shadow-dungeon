import type { PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * Original colour pixel icons of the lore gallery (16x16, ink outline, .agents/DESIGN.md §4): one emblem per
 * group, keyed by `GalleryGroup.id`. A Senda's emblem is its theme (the dream moon, the frozen flake, the storm
 * bolt, the fang, the mask, the mirror, the flame, the bone); the others are the prologue's book, the Sima's
 * eclipsed crater and the guardians' crown. Plain `PixelIcon` maps drawn with `pixelSvgOf`.
 */
const book = (): PixelIcon => {
  const g = new Grid().rect(2, 3, 6, 10, 'w').rect(8, 3, 6, 10, 'w');
  g.rect(7, 3, 2, 10, 'g');
  for (const y of [5, 7, 9, 11]) g.rect(3, y, 3, 1, 's').rect(10, y, 3, 1, 's');
  g.outline();
  g.set(12, 2, 'e').set(13, 1, 'e');
  return g.icon({ w: '#ece3d3', g: '#c9a45a', s: '#9a8f80', e: '#ff8a3d' });
};

const sima = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6.5, 'd').disc(8, 8, 5.2, 'e', 4.2).disc(8, 8, 4.2, 'n');
  g.disc(9.5, 7, 3.4, 'y');
  g.outline();
  g.set(3, 3, 'e').set(12, 12, 'e');
  return g.icon({ d: '#3a2630', e: '#ff6a3d', n: '#0c090d', y: '#e8283a' });
};

const crown = (): PixelIcon => {
  const g = new Grid().rect(2, 6, 12, 6, 'g').rect(2, 5, 2, 1, 'g').rect(7, 3, 2, 3, 'g').rect(12, 5, 2, 1, 'g').rect(4, 4, 1, 2, 'g').rect(11, 4, 1, 2, 'g');
  g.rect(2, 12, 12, 2, 'o');
  g.set(5, 8, 'r').set(8, 8, 'e').set(11, 8, 'r').set(3, 7, 'l').set(3, 8, 'l');
  g.outline();
  return g.icon({ g: '#ffbf5e', o: '#b9822f', r: '#c22a37', e: '#e8283a', l: '#fff1c2' });
};

const moon = (): PixelIcon => {
  const g = new Grid().disc(7, 8, 5.5, 'y');
  g.disc(10, 6.5, 4.6, '.');
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x + 0.5 - 10, y + 0.5 - 6.5) <= 4.6) g.set(x, y, '.');
  g.set(11, 3, 'w').set(12, 3, 'w').set(13, 3, 'w').set(12, 4, 'w').set(11, 5, 'w').set(12, 5, 'w').set(13, 5, 'w');
  g.outline();
  g.set(13, 10, 'w').set(14, 11, 'w').set(13, 12, 'w');
  return g.icon({ y: '#c9b0ff', w: '#ece3d3' });
};

const flake = (): PixelIcon => {
  const g = new Grid();
  g.line(8, 1, 8, 14, 'i').line(1, 7, 14, 7, 'i').line(3, 2, 12, 12, 'i').line(12, 2, 3, 12, 'i');
  g.line(6, 2, 8, 4, 'i').line(10, 2, 8, 4, 'i').line(6, 13, 8, 11, 'i').line(10, 13, 8, 11, 'i');
  g.set(8, 7, 'w').set(7, 7, 'w').set(8, 6, 'w').set(9, 7, 'w').set(8, 8, 'w');
  g.outline();
  return g.icon({ i: '#7fd4ff', w: '#e8f7ff' });
};

const bolt = (): PixelIcon => {
  const g = new Grid();
  for (const [x, y, w] of [[8, 1, 4], [7, 3, 4], [6, 5, 4], [4, 7, 8], [7, 9, 4], [6, 11, 3], [5, 13, 3]] as const) g.rect(x, y, w, 2, 'y');
  g.rect(8, 1, 2, 2, 'l').rect(7, 3, 1, 2, 'l').rect(6, 5, 1, 2, 'l').rect(4, 7, 2, 1, 'l');
  g.outline();
  return g.icon({ y: '#ffd447', l: '#fff1c2' });
};

const fang = (): PixelIcon => {
  const g = new Grid().rect(3, 2, 10, 3, 'w');
  for (let i = 0; i < 9; i++) g.rect(4 + Math.floor(i / 2), 5 + i, 8 - Math.floor(i / 2) * 2, 1, 'w');
  g.rect(4, 3, 1, 3, 'l').rect(5, 6, 1, 3, 'l');
  g.rect(3, 2, 10, 1, 'r');
  g.outline();
  return g.icon({ w: '#ece3d3', l: '#ffffff', r: '#c22a37' });
};

const mask = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6.4, 'w');
  g.rect(4, 6, 3, 3, 'k').rect(9, 6, 3, 3, 'k').rect(6, 11, 4, 1, 'k').set(5, 10, 'k').set(10, 10, 'k');
  g.set(8, 1, 'p').set(8, 2, 'p').set(7, 2, 'p').set(9, 2, 'p');
  g.set(5, 4, 'p').set(10, 4, 'p');
  g.outline();
  return g.icon({ w: '#e8dcc0', p: '#8a5cf0' });
};

const mirror = (): PixelIcon => {
  const g = new Grid().disc(8, 7, 6, 'g').disc(8, 7, 4.6, 'm');
  g.rect(7, 13, 2, 2, 'g');
  g.line(5, 8, 7, 4, 'w').line(6, 9, 9, 4, 'w').set(10, 8, 'a');
  g.outline();
  return g.icon({ g: '#c9a45a', m: '#5a4a8a', w: '#ece3d3', a: '#8a5cf0' });
};

const flame = (): PixelIcon => {
  const g = new Grid();
  for (let y = 2; y <= 13; y++) {
    const half = y < 5 ? (y - 1) * 0.9 : y < 10 ? 3.8 : Math.max(1.2, (14 - y) * 1.1);
    for (let x = 0; x < 16; x++) if (Math.abs(x + 0.5 - 8) <= half) g.set(x, y, 'e');
  }
  g.rect(7, 1, 2, 2, 'e');
  for (let y = 6; y <= 13; y++) for (let x = 0; x < 16; x++) if (Math.abs(x + 0.5 - 8) <= (y < 10 ? 2.3 : Math.max(0.8, (14 - y) * 0.7))) g.set(x, y, 'y');
  g.rect(7, 10, 2, 3, 'l');
  g.outline();
  return g.icon({ e: '#ff6a3d', y: '#ffbf5e', l: '#fff1c2' });
};

const bone = (): PixelIcon => {
  const g = new Grid();
  g.line(4, 11, 11, 4, 'w').line(5, 11, 12, 4, 'w').line(4, 10, 11, 3, 'w');
  g.disc(3.5, 11.5, 1.7, 'w').disc(5.5, 13, 1.7, 'w').disc(12.5, 4.5, 1.7, 'w').disc(10.5, 3, 1.7, 'w');
  g.line(6, 10, 10, 6, 's');
  g.outline();
  return g.icon({ w: '#ece3d3', s: '#b8ab92' });
};

/** One emblem per gallery group id (`galleryGroups()`): the parity test fails when a new group has none. */
export const GALLERY_ICONS: Record<string, PixelIcon> = {
  prologue: book(),
  sima: sima(),
  guardians: crown(),
  'senda-abra': moon(),
  'senda-piplup': flake(),
  'senda-shinx': bolt(),
  'senda-axew': fang(),
  'senda-mimikyu': mask(),
  'senda-zorua': mirror(),
  'senda-litwick': flame(),
  'senda-cubone': bone(),
};
