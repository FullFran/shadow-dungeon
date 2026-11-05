import type { PixelIcon } from '../pixel-icons';
import { Grid } from './report-icons';

/**
 * The install card's icon (16x16, ink outline, .agents/DESIGN.md §4): a violet relic crystal with a bone
 * arrow sinking into it, "take it with you". A plain `PixelIcon`, drawn with `pixelSvgOf`.
 */
const crystal = (): PixelIcon => {
  const g = new Grid();
  // A tall diamond: wider to the middle, narrower to the tips.
  for (let y = 1; y <= 14; y++) {
    const half = y <= 6 ? 1 + y * 0.9 : Math.max(1, (14 - y) * 0.9 + 1);
    for (let x = 0; x < 16; x++) if (Math.abs(x + 0.5 - 8) <= half) g.set(x, y, y < 7 ? 'v' : 'd');
  }
  g.outline();
  // Facets: a lit left edge and a bright core streak.
  g.line(5, 5, 7, 2, 'l').line(6, 7, 6, 8, 'l').set(7, 3, 'l');
  // The arrow, bone on the crystal.
  g.rect(7, 4, 2, 5, 'w').set(5, 8, 'w').set(6, 9, 'w').set(7, 10, 'w').set(8, 10, 'w').set(9, 9, 'w').set(10, 8, 'w').set(6, 8, 'w').set(9, 8, 'w');
  g.rect(5, 12, 6, 1, 'e');
  return g.icon({ v: '#8a5cf0', d: '#3b1f73', l: '#c9b0ff', w: '#ece3d3', e: '#ff8a3d' });
};

export const INSTALL_ICON: PixelIcon = crystal();

/**
 * The update notice's icon (16x16, same ink outline): an ember rune stone, a ring of two arrows turning
 * round a lit core, "the dungeon renews itself". A plain `PixelIcon`, drawn with `pixelSvgOf`.
 */
const rune = (): PixelIcon => {
  const g = new Grid();
  // The stone: a rounded slab.
  g.rect(2, 1, 12, 14, 's').rect(3, 0, 10, 16, 's');
  g.outline();
  g.rect(3, 2, 10, 12, 'd');
  // Two arrows chasing round a core (the update cycle).
  g.line(5, 5, 9, 5, 'e').line(9, 5, 10, 6, 'e').line(10, 6, 10, 7, 'e').set(8, 4, 'e').set(9, 3, 'e').set(9, 4, 'e');
  g.line(11, 10, 7, 10, 'e').line(7, 10, 6, 9, 'e').line(6, 9, 6, 8, 'e').set(8, 11, 'e').set(7, 12, 'e').set(7, 11, 'e');
  g.rect(7, 7, 2, 2, 'g').set(7, 7, 'w');
  // Lit upper-left edge of the stone.
  g.line(3, 2, 3, 12, 'l').line(4, 1, 11, 1, 'l');
  return g.icon({ s: '#6b6075', d: '#2b1b3d', l: '#a89bb8', e: '#ff8a3d', g: '#ffbf5e', w: '#ece3d3' });
};

export const UPDATE_ICON: PixelIcon = rune();
