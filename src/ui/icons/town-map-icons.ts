import { PALETTE, RELIC } from '../tokens';
import { hash2, mixHex } from '../../town/sheet-raster';
import type { PixelIcon } from '../pixel-icons';

/**
 * Original pixel marks of the town menu's map (.agents/DESIGN.md §4 "Town map menu"): the wax seal a service pin sits on
 * (a 20x20 backing, 2 cells wider than the 16x16 service icon it frames) and the red cross that says "you are here".
 * Both are generated from a fixed seed, so they are the same every time, and use only token colours.
 */
const SEAL_SIZE = 20;

/** The wax seal: an irregular round blob with a dark edge, a lit upper left, a shaded lower right and a pressed ring. */
function sealRows(): string[] {
  const c = (SEAL_SIZE - 1) / 2;
  const inside = (x: number, y: number): boolean => {
    const a = Math.atan2(y - c, x - c);
    const bump = hash2(Math.round(((a + Math.PI) / (2 * Math.PI)) * 18), 5, 91);
    return Math.hypot(x - c, y - c) <= 8.4 + bump * 1.3;
  };
  const rows: string[] = [];
  for (let y = 0; y < SEAL_SIZE; y++) {
    let row = '';
    for (let x = 0; x < SEAL_SIZE; x++) {
      if (!inside(x, y)) {
        row += '.';
        continue;
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const d = Math.hypot(x - c, y - c);
      row += edge ? 'k' : d > 7.2 && x + y > c * 2 ? 'd' : d > 7.2 ? 'h' : x + y > c * 2 + 5 ? 'd' : 'r';
    }
    rows.push(row);
  }
  return rows;
}

export const SEAL_BACKING: PixelIcon = {
  palette: { k: PALETTE.ink, r: RELIC.blood, d: mixHex(RELIC.blood, PALETTE.ink, 0.45), h: mixHex(RELIC.blood, PALETTE.eclipseGlow, 0.45) },
  rows: sealRows(),
};

/** A bold X as on a treasure map: wax red with a dark outline, and a lit upper edge. */
function crossRows(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 16; y++) {
    let row = '';
    for (let x = 0; x < 16; x++) {
      const onA = Math.abs(x - y) <= 1 && x >= 2 && x <= 13;
      const onB = Math.abs(x + y - 15) <= 1 && x >= 2 && x <= 13;
      const nearA = Math.abs(x - y) <= 2 && x >= 1 && x <= 14;
      const nearB = Math.abs(x + y - 15) <= 2 && x >= 1 && x <= 14;
      row += onA || onB ? (y < 8 && x < 8 ? 'h' : 'r') : nearA || nearB ? 'k' : '.';
    }
    rows.push(row);
  }
  return rows;
}

export const YOU_ARE_HERE: PixelIcon = {
  palette: { k: PALETTE.ink, r: RELIC.blood, h: PALETTE.eclipseGlow },
  rows: crossRows(),
};
