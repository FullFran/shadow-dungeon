import type { PauseEntry } from '../../app/pause-model';
import type { MarkerKind } from '../../app/pause-map';
import { PIXEL_ICONS, type PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * Original colour pixel icons of the pause menu (src/app/pause-view.ts; .agents/DESIGN.md §4): 16x16, ink
 * outline, the souls palette. Resume, settings and report reuse the hub's; restart, copy and leave are drawn
 * here. One per `PauseEntry`.
 */

/** A circular arrow: the floor starting over. */
const restart = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6.2, 'e', 3.8);
  g.rect(8, 1, 7, 7, '.').rect(8, 1, 5, 2, 'e');
  g.rect(11, 1, 4, 4, 'g').set(14, 1, '.').set(15, 1, '.').set(15, 2, '.');
  g.set(11, 3, 'w').set(12, 3, 'w').set(12, 4, 'w');
  g.disc(8, 8, 1.6, 'f');
  g.outline();
  return g.icon({ e: '#ff8a3d', g: '#ffbf5e', w: '#fff1c2', f: '#c2481a' });
};

/** Two sheets, one behind the other: the technical report copied. */
const copy = (): PixelIcon => {
  const g = new Grid().rect(2, 2, 8, 10, 'b').rect(6, 5, 8, 9, 'p');
  g.rect(7, 7, 6, 1, 'k').rect(7, 9, 6, 1, 'k').rect(7, 11, 4, 1, 'k');
  g.rect(3, 3, 6, 1, 'd').rect(3, 5, 2, 1, 'd');
  g.outline();
  return g.icon({ b: '#7d7480', p: '#efe6d6', k: '#5c4526', d: '#4a434d' });
};

/** An open door with the dark beyond and an arrow out: abandoning the run. */
const leave = (): PixelIcon => {
  const g = new Grid().rect(2, 2, 7, 12, 'w').rect(3, 3, 5, 10, 'd').rect(4, 4, 3, 9, 'n');
  g.rect(7, 8, 1, 1, 'g');
  g.rect(9, 7, 5, 2, 'r').rect(12, 5, 1, 6, 'r').rect(13, 6, 1, 4, 'r').rect(14, 7, 1, 2, 'r');
  g.outline();
  return g.icon({ w: '#9a8f80', d: '#5c4526', n: '#1f171d', g: '#ffbf5e', r: '#e8283a' });
};

/** A cut gem standing for someone on the map: `m` is its body, `c` its light, `r` the glint. */
const gem = (main: string, core: string, rim: string, round = false): PixelIcon => {
  const g = new Grid();
  if (round) g.disc(8, 8, 5.8, 'm');
  else for (let i = 0; i < 6; i++) g.rect(8 - (i + 1), 2 + i, 2 * (i + 1), 1, 'm').rect(8 - (i + 1), 13 - i, 2 * (i + 1), 1, 'm');
  g.rect(6, 5, 4, 6, 'c').rect(7, 6, 2, 3, 'r');
  g.outline();
  return g.icon({ m: main, c: core, r: rim });
};

/** A berry on the floor: a blue fruit with its leaf. */
const berry = (): PixelIcon => {
  const g = new Grid().disc(8, 9, 4.6, 'b').disc(7, 8, 1.6, 'h').rect(8, 3, 1, 2, 'l').rect(9, 3, 3, 2, 'l');
  g.outline();
  return g.icon({ b: '#5b8cff', h: '#bcd2ff', l: '#5fd36a' });
};

/** A foe: a crimson mask with two dark eyes. */
const foe = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 5.4, 'r');
  g.rect(5, 7, 2, 2, 'k').rect(9, 7, 2, 2, 'k').rect(7, 10, 2, 2, 'd');
  g.outline();
  return g.icon({ r: '#e8283a', k: '#140c11', d: '#9e1b2a' });
};

/** The Sima's floor event: a small eclipse (a ring of light round a dark disc). */
const event = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 5.6, 'g').disc(8, 8, 3.6, 'k').disc(8, 8, 5.6, 'w', 5);
  g.outline();
  return g.icon({ g: '#ffbf5e', k: '#140c11', w: '#fff1c2' });
};

/** The markers drawn over the pause map and listed in its legend. */
export const MAP_ICONS: Record<MarkerKind, PixelIcon> = {
  player: gem('#ff8a3d', '#ffbf5e', '#fff1c2'),
  partner: gem('#3f8ef0', '#a8dcff', '#e4fbff', true),
  stairs: PIXEL_ICONS.stairs,
  item: berry(),
  enemy: foe(),
  event: event(),
  gate: PIXEL_ICONS.lock,
};

export const PAUSE_ICONS: Record<PauseEntry, PixelIcon> = {
  resume: PIXEL_ICONS.resume,
  restart: restart(),
  settings: PIXEL_ICONS.settings,
  report: PIXEL_ICONS.report,
  copyReport: copy(),
  quit: leave(),
};
