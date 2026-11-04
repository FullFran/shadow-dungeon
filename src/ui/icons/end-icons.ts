import { PIXEL_ICONS, type PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * Original colour pixel icons of the end screen's stat tiles (src/app/end-screen.ts; .agents/DESIGN.md §4 "End screen"):
 * 16x16, ink outline, the souls palette. Coin, floor (stairs), level (star) and sword reuse the hub's; the rest are drawn here.
 */

/** A round clock face with an ember tick at noon: the time of the trial. */
const clock = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6.6, 'g').disc(8, 8, 5.2, 'w');
  g.line(8, 8, 8, 4, 'd').line(8, 8, 11, 9, 'd').set(8, 8, 'r');
  g.set(8, 3, 'r').set(8, 12, 'd').set(4, 8, 'd').set(12, 8, 'd');
  g.outline();
  return g.icon({ g: '#c9a45a', w: '#efe6d6', d: '#5c4526', r: '#e8283a' });
};

/** A three-pointed gold crown with a red and a blue stone: the best mark. */
const crown = (): PixelIcon => {
  const g = new Grid().rect(3, 9, 10, 4, 'g').rect(3, 5, 2, 4, 'g').rect(7, 3, 2, 6, 'g').rect(11, 5, 2, 4, 'g').rect(5, 7, 2, 2, 'g').rect(9, 7, 2, 2, 'g');
  g.rect(3, 12, 10, 1, 'h').set(7, 3, 'y').set(3, 5, 'y').set(11, 5, 'y');
  g.set(5, 10, 'r').set(8, 10, 'b').set(10, 10, 'r');
  g.outline();
  return g.icon({ g: '#ffbf5e', h: '#c2881f', y: '#fff1c2', r: '#e8283a', b: '#5ab0ff' });
};

/** A bone skull with hollow eyes: how hard the oath was sworn. */
const skull = (): PixelIcon => {
  const g = new Grid().disc(8, 7, 5.4, 'w').rect(5, 10, 6, 4, 'w');
  g.rect(4, 6, 3, 3, 'n').rect(9, 6, 3, 3, 'n').set(8, 10, 'n').set(7, 11, 'n');
  g.set(6, 12, 's').set(8, 12, 's').set(10, 12, 's').set(5, 4, 'f').set(6, 3, 'f');
  g.rect(5, 13, 6, 1, 's');
  g.outline();
  return g.icon({ w: '#efe6d6', n: '#1f171d', s: '#9a8f80', f: '#ffffff' });
};

/** A blood-red heater shield with a gilt cross: the oath kept unscathed. */
const shield = (): PixelIcon => {
  const g = new Grid().rect(3, 2, 10, 6, 'g').rect(3, 8, 10, 2, 'g').rect(4, 10, 8, 2, 'g').rect(5, 12, 6, 1, 'g').rect(7, 13, 2, 1, 'g');
  g.rect(4, 3, 8, 5, 'r').rect(4, 8, 8, 2, 'r').rect(5, 10, 6, 2, 'r').rect(6, 12, 4, 1, 'r').rect(7, 13, 2, 1, 'r');
  g.rect(7, 3, 2, 10, 'y').rect(4, 6, 8, 2, 'y').rect(4, 3, 3, 1, 'h');
  g.outline();
  return g.icon({ g: '#c9a45a', r: '#9e1b2a', y: '#ffbf5e', h: '#c22a37' });
};

/** A captured card: a violet frame, a dark field and a gold star. */
const card = (): PixelIcon => {
  const g = new Grid().rect(3, 1, 10, 14, 'p').rect(4, 2, 8, 12, 'n');
  g.rect(7, 4, 2, 6, 'y').rect(5, 6, 6, 2, 'y').set(6, 5, 'y').set(9, 5, 'y').set(6, 9, 'y').set(9, 9, 'y');
  g.rect(5, 11, 6, 1, 'q').rect(5, 12, 4, 1, 'q').rect(4, 2, 1, 12, 'q');
  g.outline();
  return g.icon({ p: '#8a5cf0', n: '#1f171d', y: '#ffbf5e', q: '#c9b0ff' });
};

/** A cut ember-blue gem: the materials. */
const gem = (): PixelIcon => {
  const g = new Grid().rect(5, 3, 6, 2, 'c').rect(3, 5, 10, 2, 'c').rect(4, 7, 8, 2, 'c').rect(5, 9, 6, 2, 'c').rect(6, 11, 4, 2, 'c').rect(7, 13, 2, 1, 'c');
  g.rect(9, 5, 4, 2, 'd').rect(9, 7, 3, 2, 'd').rect(9, 9, 2, 2, 'd').rect(9, 11, 1, 2, 'd');
  g.set(5, 4, 'w').set(6, 4, 'w').set(4, 6, 'w').rect(3, 5, 10, 1, 'l');
  g.outline();
  return g.icon({ c: '#5ab0ff', d: '#2f6fb8', w: '#ffffff', l: '#9bd0ff' });
};

/** A bone die with five pips: the seed of the run. */
const seed = (): PixelIcon => {
  const g = new Grid().rect(3, 3, 10, 10, 'w').rect(3, 11, 10, 2, 's').rect(11, 3, 2, 10, 's');
  g.rect(5, 5, 2, 2, 'r').rect(9, 5, 2, 2, 'r').rect(7, 7, 2, 2, 'r').rect(5, 9, 2, 2, 'r').rect(9, 9, 2, 2, 'r');
  g.outline();
  return g.icon({ w: '#efe6d6', s: '#9a8f80', r: '#9e1b2a' });
};

/** A leather pouch tied with a gold cord: the items carried. */
const bag = (): PixelIcon => {
  const g = new Grid().disc(8, 10, 4.8, 'b').rect(6, 4, 4, 3, 'b').rect(5, 3, 6, 1, 'b');
  g.rect(5, 6, 6, 1, 'g').set(8, 7, 'g').set(8, 8, 'g');
  g.rect(5, 10, 2, 3, 'l').set(10, 11, 'y').set(11, 10, 'y').rect(5, 13, 6, 1, 'd');
  g.outline();
  return g.icon({ b: '#b07c4c', l: '#d39a63', d: '#6b4524', g: '#ffbf5e', y: '#fff1c2' });
};

/** Two travellers side by side, one red one blue: the party. */
const party = (): PixelIcon => {
  const g = new Grid().disc(5, 5, 2.2, 's').rect(2, 8, 6, 6, 'r').disc(11, 5, 2.2, 's').rect(8, 8, 6, 6, 'b');
  g.rect(2, 8, 6, 1, 'h').rect(8, 8, 6, 1, 'l').set(4, 5, 'd').set(6, 5, 'd').set(10, 5, 'd').set(12, 5, 'd');
  g.outline();
  return g.icon({ s: '#f1d3b0', r: '#c22a37', h: '#ff6b5e', b: '#3f6fb8', l: '#7fb0ee', d: '#4a2f1c' });
};

/** A gilt medal on two ribbons: the rank on the board. */
const medal = (): PixelIcon => {
  const g = new Grid().rect(4, 1, 3, 6, 'r').rect(9, 1, 3, 6, 'b').disc(8, 10, 4.8, 'g').disc(8, 10, 3.2, 'y');
  g.rect(7, 8, 2, 4, 'd').rect(6, 9, 4, 2, 'd').set(5, 7, 'w');
  g.outline();
  return g.icon({ r: '#c22a37', b: '#3f6fb8', g: '#c9a45a', y: '#ffd37a', d: '#7a5f2c', w: '#fff1c2' });
};

/** A rolled parchment with lines of script: the events of the run. */
const scroll = (): PixelIcon => {
  const g = new Grid().rect(3, 3, 10, 10, 'p').rect(2, 2, 12, 2, 'r').rect(2, 12, 12, 2, 'r');
  g.rect(5, 6, 6, 1, 'd').rect(5, 8, 6, 1, 'd').rect(5, 10, 4, 1, 'd').rect(3, 4, 1, 8, 'h');
  g.outline();
  return g.icon({ p: '#efe6d6', r: '#9e1b2a', d: '#5c4526', h: '#b3a690' });
};

/** A pennant on a pole: the mode of the run. */
const mode = (): PixelIcon => {
  const g = new Grid().rect(3, 1, 2, 14, 's').rect(5, 2, 9, 6, 'r').set(13, 8, 'r').set(12, 8, 'r').set(11, 8, 'r');
  g.rect(5, 2, 9, 1, 'h').rect(7, 4, 3, 2, 'y').set(3, 1, 'g');
  g.outline();
  return g.icon({ s: '#9a8f80', r: '#9e1b2a', h: '#c22a37', y: '#ffbf5e', g: '#ffd37a' });
};

export const END_ICONS = {
  clock: clock(),
  crown: crown(),
  skull: skull(),
  shield: shield(),
  card: card(),
  gem: gem(),
  seed: seed(),
  bag: bag(),
  party: party(),
  medal: medal(),
  scroll: scroll(),
  mode: mode(),
  coin: PIXEL_ICONS.coin,
  floor: PIXEL_ICONS.stairs,
  level: PIXEL_ICONS.star,
  sword: PIXEL_ICONS.sword,
} as const satisfies Record<string, PixelIcon>;

export type EndIconId = keyof typeof END_ICONS;
export const END_ICON_IDS = Object.keys(END_ICONS) as EndIconId[];
