import type { PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * Original colour pixel icons of the places (src/ui/location-plaque.ts; .agents/DESIGN.md §4 "Location plaque"):
 * 16x16, ink outline, the souls palette, one per theme of a town map, a dungeon, a Senda challenge or a boss.
 * The shrine, the tutorial stairs and Zorua's mirror reuse the hub's icons (see location-plaque-model.ts).
 */

/** A cottage with a lit window and an ember over its chimney: the Refugio del Ocaso. */
const refuge = (): PixelIcon => {
  const g = new Grid();
  g.rect(10, 3, 2, 4, 's').set(10, 1, 'e').set(11, 2, 'e');
  for (let y = 0; y < 5; y++) g.rect(7 - y, 3 + y, 2 + 2 * y, 1, 'r');
  g.rect(3, 8, 10, 1, 'R');
  g.rect(4, 9, 8, 5, 'w').rect(4, 9, 8, 1, 'v');
  g.rect(5, 10, 2, 2, 'y').rect(9, 10, 2, 4, 'd').set(10, 12, 'y');
  g.outline();
  return g.icon({ r: '#c22a37', R: '#7a1a26', s: '#7d7480', w: '#b07c4c', v: '#8a5a32', y: '#ffd37a', d: '#4a2f1c', e: '#ff8a3d' });
};

/** A tomb doorway with a sword planted in it: the Crypt of the Sword King (and the ruins above it). */
const crypt = (): PixelIcon => {
  const g = new Grid();
  g.rect(2, 4, 12, 10, 's').rect(4, 2, 8, 2, 's').rect(3, 3, 10, 1, 's');
  g.rect(5, 5, 6, 9, 'n').rect(6, 4, 4, 1, 'n');
  g.rect(2, 4, 1, 10, 'h').rect(2, 13, 12, 1, 'h');
  g.rect(8, 6, 1, 6, 'b').set(8, 5, 'w').rect(6, 11, 5, 1, 'g').set(8, 12, 'g').set(8, 13, 'g');
  g.outline();
  return g.icon({ s: '#9a8f80', h: '#6a6070', n: '#1f171d', b: '#d8dde6', w: '#ffffff', g: '#ffbf5e' });
};

/** A fir with a belt of mist: the Misty Forest. */
const forest = (): PixelIcon => {
  const g = new Grid();
  g.rect(7, 12, 2, 3, 'd');
  g.rect(7, 1, 2, 1, 'f').rect(6, 2, 4, 2, 'f').rect(5, 4, 6, 2, 'f').rect(4, 6, 8, 2, 'f').rect(3, 8, 10, 2, 'f').rect(2, 10, 12, 2, 'f');
  g.rect(8, 2, 1, 9, 'l').set(6, 6, 'l').set(10, 9, 'l').set(5, 10, 'l');
  g.rect(1, 9, 5, 1, 'm').rect(10, 12, 5, 1, 'm').rect(2, 13, 4, 1, 'm');
  g.outline();
  return g.icon({ f: '#2f6b3f', l: '#4e9b5a', d: '#4a2f1c', m: '#cfd8dc' });
};

/** Stalactites over a still pool and a crystal: the Flooded Caves. */
const caves = (): PixelIcon => {
  const g = new Grid();
  g.rect(1, 1, 14, 3, 'r');
  g.rect(2, 4, 3, 2, 'r').rect(3, 6, 1, 2, 'r').rect(7, 4, 2, 3, 'r').rect(8, 7, 1, 2, 'r').rect(11, 4, 3, 2, 'r').rect(12, 6, 1, 1, 'r');
  g.rect(1, 11, 14, 4, 'w').rect(2, 12, 4, 1, 'a').rect(9, 13, 4, 1, 'a');
  g.rect(6, 8, 4, 3, 'c').rect(7, 7, 2, 1, 'c').set(7, 8, 'y').set(7, 9, 'y');
  g.outline();
  return g.icon({ r: '#7d7480', w: '#2b6cb0', a: '#6fb4f0', c: '#5ad8e8', y: '#d8fbff' });
};

/** A poison bubble over a dead branch: the Toxic Swamp. */
const swamp = (): PixelIcon => {
  const g = new Grid();
  g.rect(1, 12, 14, 3, 'm').rect(2, 12, 3, 1, 'p').rect(10, 13, 4, 1, 'p');
  g.disc(8, 8, 4.4, 'g').disc(8, 8, 3.2, 'l');
  g.set(7, 6, 'y').set(8, 6, 'y').set(6, 7, 'y');
  g.disc(12.5, 4, 1.6, 'g').set(12, 3, 'y').disc(3.5, 5, 1.2, 'g').set(3, 4, 'y');
  g.line(2, 12, 4, 9, 'd').line(4, 9, 3, 7, 'd');
  g.outline();
  return g.icon({ m: '#3f3a2a', p: '#8fbf3a', g: '#6a3fa0', l: '#8fcf3a', y: '#e8ff9a', d: '#4a2f1c' });
};

/** The eclipse: a black disc ringed with ember. The Sima del Eclipse. */
const sima = (): PixelIcon => {
  const g = new Grid();
  g.disc(8, 8, 7, 'o').disc(8, 8, 5.6, 'e').disc(8, 8, 4.4, 'n');
  g.rect(7, 0, 2, 2, 'o').rect(7, 14, 2, 2, 'o').rect(0, 7, 2, 2, 'o').rect(14, 7, 2, 2, 'o');
  g.set(5, 4, 'e').set(4, 5, 'e').set(4, 6, 'o');
  g.outline();
  return g.icon({ o: '#e8283a', e: '#ff8a3d', n: '#0c090d' });
};

/** A watchtower with its beacon lit: the Paso del Mirador. */
const lookout = (): PixelIcon => {
  const g = new Grid();
  g.rect(5, 3, 6, 2, 's').rect(4, 2, 2, 2, 's').rect(7, 2, 2, 1, 's').rect(10, 2, 2, 2, 's');
  g.rect(5, 5, 6, 9, 'w').rect(5, 5, 1, 9, 'h').rect(3, 13, 10, 2, 's');
  g.rect(7, 7, 2, 3, 'y').rect(7, 11, 2, 3, 'd');
  g.set(7, 0, 'e').set(8, 0, 'e').set(8, 1, 'f');
  g.outline();
  return g.icon({ s: '#9a8f80', w: '#7d7480', h: '#5c5460', y: '#ffd37a', d: '#2a1f26', e: '#ff8a3d', f: '#ffbf5e' });
};

/** A cone with a lit mouth and drifting ash: the Cráter del Eclipse. */
const crater = (): PixelIcon => {
  const g = new Grid();
  for (let y = 0; y < 8; y++) g.rect(5 - y, 6 + y, 6 + 2 * y, 1, y < 2 ? 'a' : 'b');
  g.rect(5, 6, 6, 1, 'e').rect(6, 5, 4, 1, 'e').rect(7, 6, 2, 1, 'f');
  g.set(6, 3, 'z').set(9, 2, 'z').set(8, 4, 'z').set(11, 4, 'z');
  g.rect(7, 9, 1, 4, 'o').rect(8, 11, 1, 3, 'o');
  g.outline();
  return g.icon({ a: '#6a6070', b: '#4a434d', e: '#ff8a3d', f: '#ffd37a', o: '#c2481a', z: '#b3a690' });
};

/** A crescent over black water: the Aldea del Lago Negro. */
const lake = (): PixelIcon => {
  const g = new Grid();
  g.disc(8, 4.5, 3.4, 'm').disc(9.8, 3.8, 3, '.');
  g.rect(1, 9, 14, 6, 'w');
  g.rect(2, 10, 4, 1, 'a').rect(9, 10, 5, 1, 'a').rect(4, 12, 6, 1, 'a').rect(11, 13, 3, 1, 'a').rect(2, 14, 3, 1, 'a');
  g.rect(7, 9, 2, 1, 'y');
  g.outline();
  return g.icon({ m: '#ece3d3', w: '#1d3f6e', a: '#4a7fc0', y: '#fff1c2' });
};

/** A horned skull with a gold crest: any boss arena. */
const boss = (): PixelIcon => {
  const g = new Grid();
  g.rect(3, 1, 2, 4, 'h').rect(11, 1, 2, 4, 'h').rect(2, 0, 1, 2, 'h').rect(13, 0, 1, 2, 'h');
  g.disc(8, 7, 5.2, 'w').rect(5, 11, 6, 4, 'w');
  g.rect(4, 6, 3, 3, 'n').rect(9, 6, 3, 3, 'n').set(5, 7, 'r').set(10, 7, 'r');
  g.rect(7, 9, 2, 2, 'n');
  g.rect(5, 13, 1, 2, 'n').rect(7, 13, 1, 2, 'n').rect(9, 13, 1, 2, 'n');
  g.rect(5, 3, 6, 1, 'g').set(5, 2, 'g').set(8, 2, 'g').set(10, 2, 'g');
  g.outline();
  return g.icon({ h: '#c9b99a', w: '#ece3d3', n: '#1a0d12', r: '#e8283a', g: '#ffbf5e' });
};

/** A crescent, a star and a drifting z: Abra's dream. */
const dream = (): PixelIcon => {
  const g = new Grid();
  g.disc(7, 8, 5.6, 'm').disc(9.6, 7, 4.8, '.');
  g.set(12, 3, 'y').set(11, 4, 'y').set(12, 4, 'y').set(13, 4, 'y').set(12, 5, 'y');
  g.rect(10, 9, 4, 1, 'z').set(12, 10, 'z').set(11, 11, 'z').rect(10, 12, 4, 1, 'z');
  g.outline();
  return g.icon({ m: '#b8a0f0', y: '#ffe9a0', z: '#8a5cf0' });
};

/** A six-armed ice crystal: Piplup's frozen lake. */
const frost = (): PixelIcon => {
  const g = new Grid();
  g.line(8, 1, 8, 14, 'i').line(2, 4, 13, 11, 'i').line(2, 11, 13, 4, 'i');
  g.line(8, 3, 6, 1, 'w').line(8, 3, 10, 1, 'w').line(8, 12, 6, 14, 'w').line(8, 12, 10, 14, 'w');
  g.disc(8, 7.5, 1.8, 'w');
  g.outline();
  return g.icon({ i: '#6fc8f0', w: '#e6fbff' });
};

/** A thunderhead and its bolt: Shinx's storm. */
const storm = (): PixelIcon => {
  const g = new Grid();
  g.disc(5.5, 6, 3.2, 'c').disc(10.5, 6, 3.6, 'c').disc(8, 4.5, 3.4, 'c').rect(3, 6, 10, 3, 'c');
  g.rect(4, 8, 8, 1, 'd');
  g.rect(8, 9, 3, 1, 'y').rect(7, 10, 3, 1, 'y').rect(6, 11, 5, 1, 'y').rect(8, 12, 2, 1, 'y').rect(7, 13, 2, 1, 'y').set(7, 14, 'y');
  g.outline();
  return g.icon({ c: '#7d8aa8', d: '#56627c', y: '#ffdf5e' });
};

/** Two curved fangs in a red maw: Axew's ravine of fangs. */
const fangs = (): PixelIcon => {
  const g = new Grid();
  g.rect(1, 2, 14, 4, 'r').rect(2, 6, 12, 1, 'r');
  g.rect(3, 6, 3, 3, 'w').rect(4, 9, 2, 3, 'w').set(4, 12, 'w').set(5, 11, 'w');
  g.rect(10, 6, 3, 3, 'w').rect(10, 9, 2, 3, 'w').set(11, 12, 'w').set(10, 11, 'w');
  g.rect(2, 3, 12, 1, 'd');
  g.set(8, 7, 'd').set(8, 8, 'd');
  g.outline();
  return g.icon({ r: '#c22a37', d: '#7a1a26', w: '#ece3d3' });
};

/** A rag-cloth face with two ink eyes and a scrawled smile: Mimikyu's disguise. */
const mask = (): PixelIcon => {
  const g = new Grid();
  g.rect(3, 1, 3, 3, 'c').rect(10, 1, 3, 3, 'c');
  g.disc(8, 8.5, 6, 'c').rect(5, 13, 6, 2, 'c');
  g.rect(5, 7, 2, 3, 'n').rect(9, 7, 2, 3, 'n');
  g.set(4, 11, 'n').set(5, 12, 'n').set(6, 11, 'n').set(7, 12, 'n').set(8, 11, 'n').set(9, 12, 'n').set(10, 11, 'n').set(11, 12, 'n');
  g.rect(3, 4, 2, 1, 'r').rect(11, 4, 2, 1, 'r');
  g.outline();
  return g.icon({ c: '#e8d8a0', n: '#1a0d12', r: '#e8283a' });
};

/** A candle burning with a violet flame: Litwick's flame. */
const flame = (): PixelIcon => {
  const g = new Grid();
  g.rect(5, 8, 6, 7, 'w').rect(5, 8, 1, 7, 'v').rect(6, 8, 4, 1, 'y');
  g.rect(8, 6, 1, 2, 'd');
  g.rect(7, 2, 3, 4, 'p').rect(8, 1, 1, 1, 'p').rect(6, 4, 1, 2, 'p').rect(10, 4, 1, 2, 'p').rect(8, 3, 1, 3, 'q');
  g.rect(3, 14, 10, 1, 's');
  g.outline();
  return g.icon({ w: '#ece3d3', v: '#b3a690', y: '#d9c9a8', d: '#2a1f26', p: '#8a5cf0', q: '#e6dcff', s: '#7d7480' });
};

/** A knotted bone laid across the frame: Cubone's bone. */
const bone = (): PixelIcon => {
  const g = new Grid();
  g.line(4, 12, 12, 4, 'w').line(5, 12, 12, 5, 'w').line(4, 11, 11, 4, 'w');
  g.disc(3.5, 11.5, 1.6, 'w').disc(5, 13.5, 1.6, 'w').disc(12.5, 4.5, 1.6, 'w').disc(11, 2.5, 1.6, 'w');
  g.set(8, 8, 's').set(7, 9, 's').set(9, 7, 's');
  g.outline();
  return g.icon({ w: '#ece3d3', s: '#b3a690' });
};

export const PLACE_ICON_IDS = ['refuge', 'crypt', 'forest', 'caves', 'swamp', 'sima', 'lookout', 'crater', 'lake', 'boss', 'dream', 'frost', 'storm', 'fangs', 'mask', 'flame', 'bone'] as const;
export type PlaceIconId = (typeof PLACE_ICON_IDS)[number];

export const PLACE_ICONS: Record<PlaceIconId, PixelIcon> = {
  refuge: refuge(),
  crypt: crypt(),
  forest: forest(),
  caves: caves(),
  swamp: swamp(),
  sima: sima(),
  lookout: lookout(),
  crater: crater(),
  lake: lake(),
  boss: boss(),
  dream: dream(),
  frost: frost(),
  storm: storm(),
  fangs: fangs(),
  mask: mask(),
  flame: flame(),
  bone: bone(),
};
