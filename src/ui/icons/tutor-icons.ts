import type { PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * Original colour pixel icons of the move tutor (src/app/tutor-screen.ts;
 * .agents/DESIGN.md §4): 16x16, ink outline, 3 to 8 colours of the souls
 * palette. One per slot filter (`all`, `fast`, `heavy`, `boost`, `area`, the
 * keys of `SlotFilter`) and one per sheet stat (`power`, `stamina`,
 * `cooldown`) plus `rankup`; plain `PixelIcon` maps, drawn with `pixelSvgOf`.
 */

/** A filled triangle pointing up with its apex at (cx, top), `rows` tall. */
const arrowHead = (g: Grid, cx: number, top: number, rows: number, ch: string): Grid => {
  for (let i = 0; i < rows; i++) g.rect(cx - i, top + i, 2 * i + 2, 1, ch);
  return g;
};

const all = (): PixelIcon => {
  const g = new Grid().rect(2, 2, 5, 5, 'e').rect(9, 2, 5, 5, 'g').rect(2, 9, 5, 5, 'v').rect(9, 9, 5, 5, 't');
  g.rect(2, 2, 5, 1, 'w').rect(9, 2, 5, 1, 'w').rect(2, 9, 5, 1, 'w').rect(9, 9, 5, 1, 'w');
  g.outline();
  return g.icon({ e: '#ff8a3d', g: '#c9a45a', v: '#8a5cf0', t: '#5fd0e8', w: '#ece3d3' });
};

const fast = (): PixelIcon => {
  const g = new Grid();
  for (const x of [4, 10]) g.line(x, 2, x + 2, 13, 'w').line(x + 1, 2, x + 3, 13, 'w').set(x + 2, 13, 'r').set(x + 3, 13, 'r').set(x + 2, 12, 'r');
  g.line(4, 2, 5, 6, 's').line(10, 2, 11, 6, 's');
  g.outline();
  return g.icon({ w: '#ece3d3', s: '#9a8f80', r: '#c22a37' });
};

const heavy = (): PixelIcon => {
  const g = new Grid().rect(2, 2, 12, 5, 's').rect(7, 7, 2, 7, 'd');
  g.rect(2, 2, 12, 1, 'w').rect(2, 6, 12, 1, 'm').rect(7, 12, 2, 2, 'g').set(2, 2, '.').set(13, 2, '.');
  g.outline();
  return g.icon({ s: '#9a8f80', w: '#ece3d3', m: '#5c5560', d: '#7a4a28', g: '#c9a45a' });
};

const boost = (): PixelIcon => {
  const g = new Grid();
  arrowHead(g, 7, 2, 6, 'e').rect(5, 8, 5, 5, 'e');
  g.rect(7, 2, 1, 6, 'G').rect(6, 8, 1, 5, 'G').set(6, 5, 'G');
  g.set(2, 12, 'r').set(13, 12, 'r').set(3, 10, 'r').set(12, 10, 'r');
  g.outline();
  return g.icon({ e: '#ff8a3d', G: '#ffbf5e', r: '#c22a37' });
};

const area = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6.3, 'e', 3.7).disc(8, 8, 1.8, 'G');
  g.disc(8, 8, 6.3, 'r', 5.4);
  g.set(4, 4, 'G').set(5, 3, 'G').set(3, 5, 'G');
  g.outline();
  return g.icon({ e: '#ff8a3d', G: '#ffbf5e', r: '#c22a37' });
};

const power = (): PixelIcon => {
  const g = new Grid().line(4, 11, 12, 3, 'w').line(5, 11, 12, 4, 'w').line(4, 10, 11, 3, 's').set(12, 3, 'w').set(13, 2, 'w');
  g.line(3, 9, 7, 13, 'g').line(3, 10, 6, 13, 'g');
  g.line(2, 12, 4, 10, 'd').line(2, 13, 4, 11, 'd').set(2, 12, 'd');
  g.outline();
  return g.icon({ w: '#ece3d3', s: '#9a8f80', g: '#c9a45a', d: '#7a4a28' });
};

const stamina = (): PixelIcon => {
  const g = new Grid();
  const rows: [number, number][] = [[9, 11], [8, 10], [7, 9], [6, 12], [7, 11], [8, 10], [7, 9], [6, 8], [5, 7], [5, 6]];
  rows.forEach(([a, b], i) => g.rect(a, 2 + i, b - a + 1, 1, 'y'));
  g.line(10, 2, 7, 5, 'w').set(8, 3, 'w').set(9, 2, 'w');
  g.outline();
  return g.icon({ y: '#ffcf4a', w: '#fff1c2' });
};

const cooldown = (): PixelIcon => {
  const g = new Grid().rect(3, 2, 10, 1, 'g').rect(3, 13, 10, 1, 'g');
  for (let i = 0; i < 5; i++) {
    g.rect(4 + i, 3 + i, 8 - 2 * i, 1, 'b').rect(4 + i, 12 - i, 8 - 2 * i, 1, 'b');
  }
  g.rect(7, 7, 2, 2, 'b');
  g.rect(6, 4, 4, 1, 'c').rect(7, 5, 2, 1, 'c').rect(5, 11, 6, 1, 'c').rect(6, 10, 4, 1, 'c').rect(7, 9, 2, 1, 'c');
  g.outline();
  return g.icon({ g: '#c9a45a', b: '#b7ecf7', c: '#ffbf5e' });
};

const rankup = (): PixelIcon => {
  const g = new Grid();
  for (const top of [2, 7]) {
    for (let i = 0; i < 5; i++) g.rect(7 - i, top + i, 2, 1, 'G').rect(8 + i - 1, top + i, 2, 1, 'G');
    for (let i = 0; i < 5; i++) g.set(7 - i, top + i, 'w');
  }
  g.outline();
  return g.icon({ G: '#ffbf5e', w: '#fff1c2' });
};

export const TUTOR_ICONS: Record<string, PixelIcon> = { all: all(), fast: fast(), heavy: heavy(), boost: boost(), area: area(), power: power(), stamina: stamina(), cooldown: cooldown(), rankup: rankup() };
