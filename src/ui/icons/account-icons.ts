import type { PixelIcon } from '../pixel-icons';

/**
 * Original colour pixel icons of the account drawer (16x16, ink outline, the
 * souls palette of .agents/DESIGN.md): the two sign-in providers, the email
 * form, the guest and the cloud. They are plain `PixelIcon` maps drawn with
 * `pixelSvgOf`. The provider marks are our own drawings (a coloured ring-G and
 * a controller face), not the brands' logos.
 */
const SIZE = 16;
const INK = '#140c11';

/** A ring-shaped G from four colours, built on a grid and ringed with ink: red top, yellow left, green bottom, blue right with the bar. */
function ringG(): string[] {
  const cells: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));
  const centre = 7.5;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - centre;
      const dy = y - centre;
      const d = Math.hypot(dx, dy);
      if (d < 3.1 || d > 6.3) continue;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      // The opening on the right, between -28 and 8 degrees.
      if (angle > -28 && angle < 8) continue;
      cells[y]![x] = angle >= -140 && angle < -28 ? 'r' : angle >= 8 && angle < 70 ? 'b' : angle >= 70 && angle < 140 ? 'g' : 'y';
    }
  }
  // The bar: from the middle to the right edge of the ring.
  for (let x = 8; x <= 13; x++) for (const y of [7, 8]) cells[y]![x] = 'b';
  // Ink outline round every coloured cell.
  const out = cells.map((row) => [...row]);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (cells[y]![x] !== '.') continue;
      const near = [-1, 0, 1].some((j) => [-1, 0, 1].some((i) => (cells[y + j]?.[x + i] ?? '.') !== '.'));
      if (near) out[y]![x] = 'k';
    }
  }
  return out.map((row) => row.join(''));
}

export type AccountIconId = 'google' | 'discord' | 'mail' | 'guest' | 'cloud';

export const ACCOUNT_ICONS: Record<AccountIconId, PixelIcon> = {
  google: { palette: { k: INK, r: '#e8503f', y: '#f6bd3a', g: '#34a853', b: '#4a86f2' }, rows: ringG() },
  discord: {
    palette: { k: INK, b: '#5865f2', d: '#3a43b0', w: '#f2f0ff', p: '#23272f' },
    rows: [
      '................',
      '................',
      '...kkkkkkkkkk...',
      '..kbbbbbbbbbbk..',
      '.kbbbbbbbbbbbbk.',
      'kbbbbbbbbbbbbbbk',
      'kbbwwwbbbbwwwbbk',
      'kbwwppwbbwwppwbk',
      'kbwwppwbbwwppwbk',
      'kbbwwwbbbbwwwbbk',
      'kbbbbbbbbbbbbbbk',
      'kbbbbkkkkkkbbbbk',
      'kbbbkddddddkbbbk',
      '.kbkdddkkdddkbk.',
      '..kkkkk..kkkkk..',
      '................',
    ],
  },
  mail: {
    palette: { k: INK, w: '#efe6d6', s: '#b3a690', r: '#e8283a', g: '#c9a45a' },
    rows: [
      '................',
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kwwwwwwwwwwwwk.',
      '.ksswwwwwwwwssk.',
      '.kwwsswwwwsswwk.',
      '.kwwwwssssswwwk.',
      '.kwwwwwgrgwwwwk.',
      '.kwwwwwwrwwwwwk.',
      '.kwwwwwwwwwwwwk.',
      '.ksswwwwwwwwssk.',
      '.kkkkkkkkkkkkkk.',
      '................',
      '................',
      '................',
    ],
  },
  guest: {
    palette: { k: INK, h: '#6b5a7a', H: '#8d7aa0', v: '#2a1d2e', e: '#ffbf5e' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '....khhHHhhk....',
      '...khhHHHHhhk...',
      '..khhHHHHHHhhk..',
      '..khHkkkkkkHhk..',
      '..khkvvvvvvkhk..',
      '..khkvevvevkhk..',
      '..khkvvvvvvkhk..',
      '..khhkvvvvkhhk..',
      '.khhhhkkkkhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '.khhhhhhhhhhhhk.',
      '..kkhhhhhhhhkk..',
      '....kkkkkkkk....',
    ],
  },
  cloud: {
    palette: { k: INK, w: '#efe6d6', s: '#b3a690', b: '#7fd8ff', B: '#4a9fd0' },
    rows: [
      '................',
      '................',
      '................',
      '......kkkk......',
      '....kkwwwwkk....',
      '...kwwwwwwwwk...',
      '..kkwwwwwwwwkkk.',
      '.kwwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwwwk',
      'kwwwwwwwwwwwwwwk',
      'kbbwwwwwwwwwwbbk',
      '.kBbbbbbbbbbbBk.',
      '..kkBBBBBBBBkk..',
      '....kkkkkkkk....',
      '................',
      '................',
    ],
  },
};
