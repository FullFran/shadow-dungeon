import type { PixelIcon } from '../pixel-icons';

/**
 * Original colour pixel icons of the gacha page (src/app/gacha-page.ts; .agents/DESIGN.md §4):
 * 16x16 maps in the souls palette, drawn with `pixelSvgOf`. Each letter is one colour of the
 * icon's palette, '.' is clear. The capsule exists whole and as its two halves, so the reveal
 * can crack it open on the same pixels. No art from other games.
 */
const INK = '#140c11';

const CAPSULE_PALETTE = { k: INK, r: '#c22a37', R: '#ff6b5e', d: '#7a1220', G: '#e2b866', u: '#6a4a78', v: '#3d2a4a', w: '#24152e' } as const;

/** An upright capsule: a crimson lid over a dusk-violet body, a gold band between and an ink outline. */
const CAPSULE_ROWS = [
  '................',
  '.....kkkkkk.....',
  '....krrrrrrk....',
  '...krRRrrrrdk...',
  '...krRrrrrrdk...',
  '...krrrrrrrdk...',
  '...krrrrrrddk...',
  '...kGGGGGGGGk...',
  '...kGGGGGGGGk...',
  '...kuuvvvvwwk...',
  '...kuvvvvvwwk...',
  '...kvvvvvvwwk...',
  '....kvvvvwwk....',
  '....kvvvvvwk....',
  '.....kwwwwk.....',
  '................',
] as const;

const BLANK = '.'.repeat(16);
/** The lid: rows down to the seam. */
const TOP_ROWS = CAPSULE_ROWS.map((row, i) => (i < 8 ? row : BLANK));
/** The body: rows under the seam. */
const BOTTOM_ROWS = CAPSULE_ROWS.map((row, i) => (i >= 8 ? row : BLANK));

/** One small capsule, 5x7. */
const PILL = ['.kkk.', 'krRrk', 'krrrk', 'kGGGk', 'kuvvk', 'kvvwk', '.kkk.'] as const;

/** Three of them in a triangle on a 16x16 map. */
const PILLS: readonly string[] = (() => {
  const grid = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => '.'));
  for (const [x, y] of [[1, 1], [10, 1], [5, 8]] as const) PILL.forEach((row, dy) => [...row].forEach((ch, dx) => (ch !== '.' ? (grid[y + dy]![x + dx] = ch) : undefined)));
  return grid.map((row) => row.join(''));
})();

export const GACHA_ICON_IDS = ['capsule', 'capsuleTop', 'capsuleBottom', 'pull', 'pullTen', 'back', 'skip', 'sparkle', 'owned', 'unknown'] as const;

export const GACHA_ICONS: Record<string, PixelIcon> = {
  capsule: { palette: CAPSULE_PALETTE, rows: CAPSULE_ROWS },
  capsuleTop: { palette: CAPSULE_PALETTE, rows: TOP_ROWS },
  capsuleBottom: { palette: CAPSULE_PALETTE, rows: BOTTOM_ROWS },
  /** A coin falling into the slot: one pull. */
  pull: {
    palette: { k: INK, G: '#ffbf5e', y: '#fff1c2', g: '#c9a45a', s: '#9a8f80' },
    rows: [
      '................',
      '.....kkkkkk.....',
      '...kkGGGGGGkk...',
      '..kGyyGGGGGGGk..',
      '..kGyGGggGGGGk..',
      '..kGGGGggGGGGk..',
      '..kGGGGGGGGGgk..',
      '..kGGGGGGGGggk..',
      '...kkGGGGggkk...',
      '.....kkkkkk.....',
      '................',
      '..kkkkkkkkkkkk..',
      '.kssssskksssssk.',
      '.kssssskksssssk.',
      '..kkkkkkkkkkkk..',
      '................',
    ],
  },
  /** Three small capsules together: ten pulls. */
  pullTen: {
    palette: { k: INK, r: '#c22a37', R: '#ff6b5e', G: '#e2b866', u: '#6a4a78', v: '#3d2a4a', w: '#24152e' },
    rows: PILLS,
  },
  /** A left arrow: back to where you came from. */
  back: {
    palette: { k: INK, w: '#ece3d3', s: '#9a8f80' },
    rows: [
      '................',
      '................',
      '.......kk.......',
      '......kwwk......',
      '.....kwwwk......',
      '....kwwwwkkkkkk.',
      '...kwwwwwwwwwwk.',
      '..kwwwwwwwwwwsk.',
      '..kswwwwwwwwssk.',
      '....kswwwkkkkkk.',
      '.....kswwk......',
      '......kssk......',
      '.......kk.......',
      '................',
      '................',
      '................',
    ],
  },
  /** A triangle against a bar: skip the reveal. */
  skip: {
    palette: { k: INK, w: '#ece3d3', s: '#9a8f80' },
    rows: [
      '................',
      '................',
      '............kkk.',
      '..kk........kwk.',
      '..kwkk......kwk.',
      '..kwwwkk....kwk.',
      '..kwwwwwkk..kwk.',
      '..kwwwwwwwkkkwk.',
      '..kwwwwwwwkkkwk.',
      '..kwwwwwkk..kwk.',
      '..kwwwkk....kwk.',
      '..kskk......kwk.',
      '..kk........kwk.',
      '............kkk.',
      '................',
      '................',
    ],
  },
  /** A four-point glint: a shiny. */
  sparkle: {
    palette: { k: INK, y: '#fff1c2', G: '#ffbf5e', w: '#ffffff' },
    rows: [
      '................',
      '.......kk.......',
      '......kyyk......',
      '......kyyk......',
      '.....kyGGyk.....',
      '.kkkkyGGGGykkkk.',
      'kyyyyGGwwGGyyyyk',
      'kyyyyGGwwGGyyyyk',
      '.kkkkyGGGGykkkk.',
      '.....kyGGyk.....',
      '......kyyk......',
      '......kyyk......',
      '.......kk.......',
      '................',
      '................',
      '................',
    ],
  },
  /** A gold tick: this line is in the collection. */
  owned: {
    palette: { k: INK, G: '#ffbf5e', y: '#fff1c2' },
    rows: [
      '................',
      '................',
      '................',
      '................',
      '...........kk...',
      '..........kGGk..',
      '.........kGGk...',
      '.kk.....kGGk....',
      'kyGk...kGGk.....',
      '.kGGk.kGGk......',
      '..kGGkGGk.......',
      '...kGGGk........',
      '....kGk.........',
      '.....k..........',
      '................',
      '................',
    ],
  },
  /** A question mark: a line not yet in the collection. */
  unknown: {
    palette: { k: INK, w: '#ece3d3', s: '#9a8f80' },
    rows: [
      '................',
      '................',
      '.....kkkkkk.....',
      '....kwwwwwwk....',
      '...kwwkkkkwwk...',
      '...kwwk..kwsk...',
      '...kkkk..kwsk...',
      '........kwsk....',
      '.......kwsk.....',
      '......kwsk......',
      '......kwsk......',
      '......kkkk......',
      '................',
      '......kwsk......',
      '......kwsk......',
      '......kkkk......',
    ],
  },
};
