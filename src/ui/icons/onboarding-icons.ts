import type { PixelIcon } from '../pixel-icons';

/**
 * Original colour pixel icons of the onboarding (16x16, ink outline, the souls palette of .agents/DESIGN.md): one
 * for every answer of the personality questionnaire (24, named `question.n`), the "already have a game on this
 * device" mark and the two oath runes of the progress rail. Drawn with a tiny canvas (shapes, then an automatic
 * ink outline) so they share one hand; rendered with `pixelSvgOf`. Objects, never faces (DESIGN.md §1 anti-references).
 */
const SIZE = 16;
const INK = '#140c11';

type Cells = string[][];

class Canvas {
  readonly cells: Cells = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));

  px(x: number, y: number, c: string): this {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 1 && ix < SIZE - 1 && iy >= 1 && iy < SIZE - 1) this.cells[iy]![ix] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }

  ell(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.px(x, y, c);
    return this;
  }

  disc(cx: number, cy: number, r: number, c: string): this {
    return this.ell(cx, cy, r, r, c);
  }

  /** A line `w` cells thick (square brush). */
  line(x0: number, y0: number, x1: number, y1: number, c: string, w = 1): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) this.rect(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps, w, w, c);
    return this;
  }

  /** Paints `c` on every cell where `test` holds. */
  where(test: (x: number, y: number) => boolean, c: string): this {
    for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) if (test(x, y)) this.cells[y]![x] = c;
    return this;
  }

  /** Rows with an ink outline round every painted cell (diagonals included). */
  rows(): string[] {
    const out = this.cells.map((row) => [...row]);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.cells[y]![x] !== '.') continue;
        const near = [-1, 0, 1].some((j) => [-1, 0, 1].some((i) => (this.cells[y + j]?.[x + i] ?? '.') !== '.'));
        if (near) out[y]![x] = 'k';
      }
    }
    return out.map((row) => row.join(''));
  }
}

const icon = (palette: Record<string, string>, draw: (c: Canvas) => void): PixelIcon => {
  const canvas = new Canvas();
  draw(canvas);
  return { palette: { k: INK, ...palette }, rows: canvas.rows() };
};

/** Shared colours: bone, shaded bone, gold, deep gold, ember, flame, blood, bright red, violet, deep violet, steel, deep steel, brown, skin, green, blue, stone. */
const C = { w: '#efe6d6', s: '#b3a690', g: '#c9a45a', d: '#7a5f2c', e: '#ff8a3d', y: '#ffbf5e', r: '#9e1b2a', R: '#e8283a', v: '#8a5cf0', V: '#3b1f73', t: '#c8d2dc', T: '#6d7a88', o: '#a87a46', O: '#5e3f1e', p: '#e0b890', m: '#e8607a', n: '#5cc23a', b: '#3f8ef0', z: '#2c2128' } as const;
const pick = (...keys: (keyof typeof C)[]): Record<string, string> => Object.fromEntries(keys.map((k) => [k, C[k]]));

const ICONS: Record<string, PixelIcon> = {
  // lantern: the light goes out
  'lantern.1': icon(pick('o', 'O', 'd', 'y'), (c) => {
    // A worn boot, toe to the right, stepping on.
    c.rect(4, 2, 5, 8, 'o').rect(4, 9, 10, 4, 'o').rect(12, 9, 2, 3, 'o').rect(4, 2, 5, 1, 'y').rect(4, 5, 5, 1, 'O').rect(4, 12, 10, 2, 'd').rect(9, 10, 4, 1, 'O');
    c.px(5, 3, 'y').px(5, 4, 'y');
  }),
  'lantern.2': icon(pick('w', 's', 'y', 'd'), (c) => {
    // An ear, listening; the sound arrives as three small sparks.
    c.ell(7, 8, 4.5, 6.2, 'w').ell(7, 8.6, 2.6, 3.8, 's').rect(6, 7, 1, 4, 'k').rect(7, 6, 2, 1, 'k').rect(8, 7, 1, 2, 'k').rect(5, 12, 3, 2, 'w').rect(11, 3, 2, 1, 'y').rect(12, 6, 2, 1, 'y').rect(12, 9, 2, 1, 'y').rect(11, 12, 1, 1, 'd');
  }),
  'lantern.3': icon(pick('e', 'y', 'O', 'n', 'r'), (c) => {
    // A carved pumpkin with a lit grin: someone is having a joke.
    c.ell(7.5, 9, 6, 5, 'e').rect(7, 2, 2, 3, 'n').rect(9, 3, 2, 1, 'n').where((x, y) => y > 5 && x === 7 && ((x - 7.5) / 6) ** 2 + ((y - 9) / 5) ** 2 <= 1, 'O');
    c.rect(4, 7, 2, 2, 'y').rect(10, 7, 2, 2, 'y').rect(4, 11, 8, 1, 'y').rect(5, 12, 1, 1, 'y').rect(10, 12, 1, 1, 'y').rect(6, 11, 1, 2, 'r').rect(9, 11, 1, 2, 'r');
  }),
  // mask: a face that is not yours
  'mask.1': icon(pick('y', 'g', 'e', 'r', 'R'), (c) => {
    // A comedy mask: a mask for pranks, grin first.
    c.ell(7.5, 7.5, 6, 6.5, 'y').where((x, y) => x > 11 && y > 3, 'g').rect(3, 5, 3, 1, 'k').rect(4, 6, 2, 1, 'k').rect(10, 5, 3, 1, 'k').rect(10, 6, 2, 1, 'k').rect(2, 8, 2, 2, 'e').rect(12, 8, 2, 2, 'e');
    c.rect(4, 9, 8, 1, 'r').rect(5, 10, 6, 2, 'R').rect(6, 12, 4, 1, 'r').rect(4, 9, 1, 1, 'k').rect(11, 9, 1, 1, 'k');
  }),
  'mask.2': icon(pick('w', 's', 'R', 'r'), (c) => {
    // A mask struck through: no, I keep my own face.
    c.ell(7.5, 7.5, 5.5, 6, 'w').where((x, y) => y > 8 && x < 5, 's').rect(4, 6, 3, 2, 'k').rect(9, 6, 3, 2, 'k').rect(6, 10, 4, 1, 'k');
    c.line(2, 2, 13, 13, 'R', 2).line(3, 2, 13, 12, 'r', 1);
  }),
  'mask.3': icon(pick('V', 'v', 'y', 'w'), (c) => {
    // A hood with no face: only two lit eyes in the dark.
    c.ell(7.5, 8, 6, 6.5, 'V').rect(2, 12, 12, 2, 'V').where((x, y) => ((x - 7.5) / 3.8) ** 2 + ((y - 8.2) / 4.4) ** 2 <= 1, 'k').rect(5, 8, 2, 2, 'y').rect(9, 8, 2, 2, 'y');
    c.line(3, 4, 5, 2, 'v', 1).line(10, 2, 12, 4, 'v', 1).rect(7, 1, 2, 1, 'v');
  }),
  // friend: someone dear is crying
  'friend.1': icon(pick('V', 'v', 'w', 's', 'z'), (c) => {
    // Two figures side by side, close, not speaking.
    const body = (cx: number, fill: string, edge: string) => c.where((x, y) => y >= 8 && y <= 13 && Math.abs(x - cx) <= 2.4 + (y - 8) * 0.35, fill).rect(cx - 1, 8, 3, 1, edge);
    c.disc(4.5, 5, 2.4, 'v');
    body(4.5, 'V', 'v');
    c.disc(11, 5.5, 2.4, 'w');
    body(11, 's', 'w');
    c.rect(2, 14, 12, 1, 'z');
  }),
  'friend.2': icon(pick('w', 's', 'R', 'r'), (c) => {
    // A speech bubble with a cheeky exclamation.
    c.rect(1, 2, 14, 9, 'w').rect(2, 11, 12, 1, 's').rect(3, 11, 3, 3, 'w').rect(3, 14, 1, 1, 'w').rect(1, 10, 14, 1, 's');
    c.rect(7, 3, 2, 4, 'R').rect(7, 8, 2, 2, 'R').rect(4, 5, 1, 1, 'r').rect(11, 5, 1, 1, 'r');
  }),
  'friend.3': icon(pick('t', 'T', 'g', 'd', 'R', 'O'), (c) => {
    // A dagger, a drop of blood on its point: whoever did this will answer.
    c.line(13, 2, 6, 9, 't', 2).line(14, 3, 7, 10, 'T', 1).line(4, 8, 9, 13, 'g', 2).line(3, 11, 1, 13, 'O', 2).rect(4, 12, 1, 2, 'd');
    c.rect(2, 4, 2, 3, 'R').rect(2, 7, 1, 1, 'R').rect(3, 3, 1, 1, 'R');
  }),
  // mirror: the reflection is late
  'mirror.1': icon(pick('r', 'R', 'w', 'm'), (c) => {
    // Lips and a tongue put out at the glass.
    c.ell(7.5, 5.5, 6, 3.4, 'R').rect(2, 5, 12, 1, 'k').rect(4, 4, 8, 1, 'w').rect(5, 6, 6, 5, 'm').rect(6, 11, 4, 2, 'm').rect(7, 7, 2, 5, 'r').rect(3, 6, 2, 1, 'r').rect(11, 6, 2, 1, 'r').rect(6, 2, 4, 1, 'r');
  }),
  'mirror.2': icon(pick('s', 'w', 'T'), (c) => {
    // Two footprints leaving, the farther one fainter.
    c.ell(5, 10, 2.2, 3.2, 's').rect(3, 5, 1, 2, 's').rect(5, 4, 1, 2, 's').rect(7, 5, 1, 2, 's').rect(4, 13, 3, 1, 'T');
    c.ell(11, 6.5, 2.2, 3.2, 'w').rect(9, 2, 1, 2, 'w').rect(11, 1, 1, 2, 'w').rect(13, 2, 1, 2, 'w').rect(10, 9, 3, 1, 's');
  }),
  'mirror.3': icon(pick('p', 'o', 'O'), (c) => {
    // An open hand, waving hello.
    c.rect(3, 8, 11, 6, 'p').rect(3, 4, 2, 4, 'p').rect(6, 2, 2, 6, 'p').rect(9, 3, 2, 5, 'p').rect(12, 5, 2, 3, 'p').rect(1, 9, 2, 3, 'p');
    c.rect(5, 3, 1, 5, 'k').rect(8, 3, 1, 5, 'k').rect(11, 4, 1, 4, 'k').rect(3, 13, 11, 1, 'o').rect(1, 11, 2, 1, 'o').rect(5, 10, 1, 1, 'O').rect(8, 10, 1, 1, 'O').rect(11, 10, 1, 1, 'O');
  }),
  // storm: shut in a cabin with strangers
  'storm.1': icon(pick('g', 'd', 'e', 'y', 'w'), (c) => {
    // An hourglass: we will take turns on watch.
    c.rect(3, 2, 10, 2, 'g').rect(3, 12, 10, 2, 'g').rect(4, 4, 8, 1, 'w').rect(5, 5, 6, 1, 'w').rect(6, 6, 4, 1, 'w').rect(7, 7, 2, 2, 'w').rect(6, 9, 4, 1, 'w').rect(5, 10, 6, 1, 'w').rect(4, 11, 8, 1, 'w');
    c.rect(5, 5, 6, 1, 'y').rect(6, 6, 4, 1, 'e').rect(7, 8, 2, 1, 'e').rect(6, 10, 4, 1, 'e').rect(5, 11, 6, 1, 'y').rect(3, 3, 10, 1, 'd').rect(3, 13, 10, 1, 'd');
  }),
  'storm.2': icon(pick('w', 's', 'v'), (c) => {
    // A ghost in a sheet: scary stories round the fire.
    c.ell(7.5, 6.5, 5.5, 5, 'w').rect(2, 7, 12, 6, 'w').rect(2, 13, 3, 1, 'w').rect(6, 13, 4, 1, 'w').rect(11, 13, 3, 1, 'w').rect(5, 13, 1, 1, 's').rect(10, 13, 1, 1, 's').rect(12, 7, 2, 6, 's').rect(4, 6, 2, 3, 'k').rect(9, 6, 2, 3, 'k').rect(6, 10, 4, 2, 'k').rect(1, 5, 1, 1, 'v').rect(14, 3, 1, 1, 'v');
  }),
  'storm.3': icon(pick('y', 'g', 'd', 'w'), (c) => {
    // A crescent moon: a quiet corner and the wait for it to pass.
    const moon = (x: number, y: number) => (x - 7.5) ** 2 + (y - 8) ** 2 <= 36 && (x - 10.5) ** 2 + (y - 6.5) ** 2 > 25;
    c.where(moon, 'y').where((x, y) => moon(x, y) && x < 5, 'g').where((x, y) => moon(x, y) && x < 3, 'd').rect(11, 10, 2, 2, 'w').rect(12, 3, 1, 1, 'w').rect(13, 6, 1, 1, 'w');
  }),
  // keepsake: what a vanished person left
  'keepsake.1': icon(pick('g', 'd', 'R', 'r', 'w'), (c) => {
    // A locket on its chain, worn close.
    c.line(3, 1, 7, 8, 'd', 1).line(12, 1, 8, 8, 'd', 1).disc(7.5, 10, 4, 'g').disc(7.5, 10, 2.2, 'r').rect(7, 9, 2, 2, 'R').rect(5, 8, 1, 1, 'w').rect(7, 6, 2, 1, 'g').rect(5, 13, 6, 1, 'd');
  }),
  'keepsake.2': icon(pick('z', 'T', 'b', 'w', 's'), (c) => {
    // A bare plinth, and a gem left on it as it was found.
    c.rect(3, 8, 10, 2, 'T').rect(5, 10, 6, 3, 'z').rect(3, 13, 10, 1, 'T').rect(3, 8, 10, 1, 's');
    c.rect(7, 4, 2, 1, 'w').rect(6, 5, 4, 1, 'b').rect(5, 6, 6, 1, 'b').rect(6, 7, 4, 1, 'b').rect(7, 3, 2, 1, 'b').rect(7, 5, 1, 1, 'w');
  }),
  'keepsake.3': icon(pick('V', 'v', 'g', 'y', 'd'), (c) => {
    // A pointed hat, tried on to see how it fits.
    c.rect(1, 11, 14, 2, 'V').line(8, 2, 5, 11, 'V', 4).rect(4, 9, 8, 2, 'g').rect(4, 10, 8, 1, 'd').rect(6, 6, 4, 3, 'v').rect(8, 2, 2, 3, 'v').rect(9, 4, 2, 1, 'v').px(7, 5, 'y').px(8, 8, 'y').rect(2, 11, 12, 1, 'v');
  }),
  // voice: a name called from a dark corridor
  'voice.1': icon(pick('g', 'd', 'y', 'o'), (c) => {
    // A horn: answering the dark out loud.
    c.line(2, 9, 9, 5, 'g', 3).line(2, 11, 9, 9, 'g', 3).rect(8, 3, 3, 9, 'g').rect(10, 1, 2, 13, 'd').rect(2, 8, 2, 5, 'o').rect(3, 8, 1, 1, 'y').rect(9, 4, 1, 3, 'y');
    c.px(13, 5, 'y').px(14, 7, 'y').px(13, 9, 'y');
  }),
  'voice.2': icon(pick('v', 'V', 's', 'w'), (c) => {
    // A shut eye under a calm brow: I heard nothing.
    for (let x = 2; x <= 13; x++) {
      const u = (x - 7.5) / 5.75;
      const y = 6 + 3 * (1 - u * u);
      c.rect(x, y, 1, 2, 'v');
      c.rect(x, y - 4, 1, 1, 'V');
    }
    c.rect(3, 8, 1, 3, 's').rect(5, 10, 1, 3, 's').rect(7, 11, 1, 3, 's').rect(9, 11, 1, 3, 's').rect(11, 10, 1, 3, 's').rect(7, 8, 2, 1, 'w');
  }),
  'voice.3': icon(pick('z', 'T', 'y', 'w', 'e'), (c) => {
    // An archway full of light: I go towards the voice.
    c.rect(2, 4, 12, 10, 'T').ell(7.5, 5, 6, 4, 'T').rect(5, 6, 6, 8, 'y').ell(7.5, 6, 3, 3, 'y').rect(7, 8, 2, 6, 'w').rect(2, 4, 2, 10, 'z').rect(12, 4, 2, 10, 'z').rect(6, 12, 4, 2, 'e').rect(1, 14, 14, 1, 'z');
  }),
  // wish: one wish for tonight
  'wish.1': icon(pick('R', 'r', 'e', 'y'), (c) => {
    // A great heart and a small one pressed against it: nobody alone.
    const stamp = (x: number, y: number, rows: string[], fill: string) => rows.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && c.px(x + i, y + j, fill)));
    stamp(2, 2, ['.XXX.XXX.', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'], 'R');
    stamp(8, 7, ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'], 'e');
    c.rect(3, 3, 2, 1, 'y').rect(3, 4, 1, 1, 'y').rect(3, 7, 2, 1, 'r').rect(4, 8, 2, 1, 'r');
  }),
  'wish.2': icon(pick('t', 'T', 'g', 'd'), (c) => {
    // A shield: never to be afraid again.
    c.rect(2, 2, 12, 7, 't').where((x, y) => y >= 9 && Math.abs(x - 7.5) <= 6 - (y - 8) * 0.9, 't').rect(7, 2, 2, 11, 'T').rect(2, 2, 12, 1, 'g').disc(7.5, 6.5, 2, 'g').rect(7, 6, 1, 1, 'd').rect(3, 3, 1, 4, 'T');
  }),
  'wish.3': icon(pick('v', 'V', 'w', 'y'), (c) => {
    // A spiral: let the world be a little stranger.
    for (let a = 0; a < 15; a += 0.12) {
      const r = 0.45 * a + 0.4;
      c.px(7.5 + Math.cos(a) * r, 7.5 + Math.sin(a) * r, 'v').px(8.5 + Math.cos(a) * r, 7.5 + Math.sin(a) * r, 'V');
    }
    c.rect(7, 7, 2, 2, 'w').rect(13, 2, 1, 1, 'y').rect(2, 13, 1, 1, 'y').rect(2, 3, 1, 1, 'w');
  }),
};

/** Key of an answer's icon: `question.n` (n from 1). */
export const answerIconId = (questionId: string, index: number): string => `${questionId}.${index + 1}`;

export const ANSWER_ICONS: Readonly<Record<string, PixelIcon>> = ICONS;

export type OnboardingIconId = 'device' | 'runeLit' | 'runeDim';

const rune = (inner: string, rim: string, glow: string | null): ((c: Canvas) => void) => (c) => {
  c.where((x, y) => Math.abs(x - 7.5) + Math.abs(y - 7.5) <= 6.5, rim);
  c.where((x, y) => Math.abs(x - 7.5) + Math.abs(y - 7.5) <= 4.5, inner);
  c.rect(7, 4, 2, 8, rim).rect(5, 7, 6, 2, rim);
  if (glow) c.rect(7, 6, 2, 4, glow);
};

export const ONBOARDING_ICONS: Readonly<Record<OnboardingIconId, PixelIcon>> = {
  device: icon(pick('T', 'z', 's', 'g', 'e'), (c) => {
    // A carved stone tablet with a lit rune: the game already kept on this device.
    c.rect(3, 2, 10, 12, 'T').rect(3, 2, 10, 1, 's').rect(4, 3, 8, 10, 'z').rect(3, 2, 1, 12, 's').rect(6, 5, 4, 1, 'g').rect(6, 7, 4, 1, 'g').rect(6, 9, 2, 1, 'g').rect(7, 11, 2, 1, 'e').rect(12, 2, 1, 1, 'g').rect(3, 13, 10, 1, 'T');
  }),
  runeLit: icon(pick('g', 'd', 'e', 'y', 'z'), rune('z', 'g', 'y')),
  runeDim: icon(pick('d', 'T', 'z'), rune('z', 'T', null)),
};
