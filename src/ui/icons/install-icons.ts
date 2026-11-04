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
