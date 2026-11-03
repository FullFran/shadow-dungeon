import type { PixelIcon } from '../pixel-icons';

/**
 * Original colour pixel icons of the report window (16x16, outline #140c11,
 * 3 to 8 colours, the souls palette of .agents/DESIGN.md). Each is composed in
 * code from a few shapes on a grid, then ringed with the ink outline, so every
 * icon is the same weight; they are plain `PixelIcon` maps, drawn with
 * `pixelSvgOf`. One per report type, plus the small marks of the form.
 */
const SIZE = 16;
export const INK = '#140c11';

export class Grid {
  private readonly cells: string[][] = Array.from({ length: SIZE }, () => Array<string>(SIZE).fill('.'));

  set(x: number, y: number, ch: string): this {
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.cells[y]![x] = ch;
    return this;
  }
  get(x: number, y: number): string {
    return this.cells[y]?.[x] ?? '.';
  }
  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch);
    return this;
  }
  /** Cells whose centre lies within `r` of (cx, cy), optionally only the ring from `inner` outwards. */
  disc(cx: number, cy: number, r: number, ch: string, inner = 0): this {
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d >= inner) this.set(x, y, ch);
      }
    }
    return this;
  }
  line(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / (steps || 1)), Math.round(y0 + ((y1 - y0) * i) / (steps || 1)), ch);
    return this;
  }
  /** Rings every drawn shape with the ink outline (4-neighbour). */
  outline(): this {
    const marks: [number, number][] = [];
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (this.cells[y]![x] !== '.') continue;
        const near = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => this.cells[ny!]?.[nx!] !== undefined && this.cells[ny!]![nx!] !== '.');
        if (near) marks.push([x, y]);
      }
    }
    for (const [x, y] of marks) this.set(x, y, 'k');
    return this;
  }
  icon(palette: Record<string, string>): PixelIcon {
    return { palette: { k: INK, ...palette }, rows: this.cells.map((row) => row.join('')) };
  }
}

const bug = (): PixelIcon => {
  const g = new Grid().disc(8, 9.5, 4.6, 'r').disc(8, 4.4, 2.3, 's');
  g.outline();
  // Legs reach out of the shell, the seam and the spots break the red.
  for (const y of [7, 9, 11]) g.line(1, y, 3, y, 'k').line(12, y, 14, y, 'k');
  g.line(8, 6, 8, 13, 'k').set(5, 9, 'k').set(11, 9, 'k').set(6, 12, 'k').set(10, 12, 'k');
  g.set(5, 8, 'R').set(6, 7, 'R').set(6, 4, 'w').set(9, 4, 'w').set(5, 7, 'R');
  g.line(6, 1, 5, 2, 'k').line(10, 1, 11, 2, 'k');
  return g.icon({ r: '#c22a37', R: '#ff6b5e', s: '#9a8f80', w: '#ece3d3' });
};

const online = (): PixelIcon => {
  const g = new Grid().disc(8, 8, 6, 't');
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const ring = ((x + 0.5 - 8) / 3.1) ** 2 + ((y + 0.5 - 8) / 6) ** 2;
      if (g.get(x, y) === 't' && ring >= 0.7 && ring <= 1.15) g.set(x, y, 'b');
    }
  }
  g.line(2, 8, 13, 8, 'b').line(3, 5, 12, 5, 'b').line(3, 11, 12, 11, 'b');
  g.set(4, 4, 'T').set(5, 3, 'T').set(4, 5, 'T').set(6, 3, 'T');
  g.outline();
  return g.icon({ t: '#5fd0e8', T: '#b7ecf7', b: '#2a7f9a' });
};

const performance = (): PixelIcon => {
  const g = new Grid().disc(8, 9, 5, 'w').disc(8, 9, 5, 'g', 4);
  g.rect(7, 2, 2, 1, 'g').rect(7, 3, 2, 1, 's');
  g.line(8, 9, 11, 6, 'r').set(8, 9, 'k').set(8, 5, 'e').set(12, 9, 'e').set(4, 9, 'e').set(8, 13, 'e');
  g.outline();
  return g.icon({ w: '#ece3d3', g: '#c9a45a', s: '#9a8f80', r: '#c22a37', e: '#ff8a3d' });
};

const interfaceIcon = (): PixelIcon => {
  const g = new Grid().rect(2, 3, 12, 10, 'n').rect(2, 3, 12, 3, 'g');
  g.set(3, 4, 'r').set(5, 4, 'G').set(7, 4, 't');
  g.rect(4, 8, 3, 1, 's').rect(4, 10, 2, 1, 's');
  g.outline();
  // The pointer, over the window's edge.
  for (const [x, y] of [[9, 7], [9, 8], [10, 8], [9, 9], [10, 9], [11, 9], [9, 10], [10, 10], [11, 10], [12, 10], [9, 11], [10, 11], [9, 12], [11, 12], [11, 13]]) g.set(x!, y!, 'w');
  g.set(9, 6, 'k').set(8, 7, 'k').set(8, 8, 'k').set(8, 9, 'k').set(8, 10, 'k').set(8, 11, 'k').set(8, 12, 'k').set(9, 13, 'k').set(10, 12, 'k').set(10, 13, 'k').set(12, 11, 'k').set(13, 10, 'k').set(12, 9, 'k').set(11, 8, 'k').set(10, 7, 'k').set(12, 12, 'k').set(11, 14, 'k').set(12, 13, 'k');
  return g.icon({ n: '#2a2130', g: '#c9a45a', G: '#ffbf5e', r: '#c22a37', t: '#5fd0e8', s: '#9a8f80', w: '#ece3d3' });
};

const progress = (): PixelIcon => {
  const g = new Grid().rect(2, 9, 3, 4, 'g').rect(6, 6, 3, 7, 'G').rect(10, 3, 3, 10, 'e');
  g.rect(2, 13, 11, 1, 's');
  g.set(2, 9, 'w').set(2, 10, 'w').set(6, 6, 'w').set(6, 7, 'w').set(6, 8, 'w').set(10, 3, 'w').set(10, 4, 'w').set(10, 5, 'w').set(10, 6, 'w');
  g.outline();
  return g.icon({ g: '#c9a45a', G: '#ffbf5e', e: '#ff8a3d', s: '#9a8f80', w: '#ece3d3' });
};

const balance = (): PixelIcon => {
  const g = new Grid().rect(7, 3, 2, 10, 'g').rect(4, 12, 8, 2, 'g');
  g.line(2, 6, 13, 3, 'G');
  g.line(2, 6, 1, 10, 's').line(2, 6, 5, 10, 's').line(13, 3, 10, 6, 's').line(13, 3, 14, 6, 's');
  g.rect(0, 10, 6, 2, 'g').rect(9, 6, 6, 2, 'g');
  g.set(8, 2, 'w').set(7, 3, 'w').set(1, 10, 'w').set(9, 6, 'w');
  g.outline();
  return g.icon({ g: '#c9a45a', G: '#ffbf5e', s: '#9a8f80', w: '#ece3d3' });
};

const textIcon = (): PixelIcon => {
  const g = new Grid().rect(2, 2, 12, 9, 'w');
  g.set(2, 2, '.').set(13, 2, '.').set(2, 10, '.').set(13, 10, '.');
  g.set(4, 11, 'w').set(5, 11, 'w').set(4, 12, 'w');
  g.set(5, 3, 'v').set(4, 4, 'v').set(6, 4, 'v').set(4, 5, 'v').set(5, 5, 'v').set(6, 5, 'v').set(4, 6, 'v').set(6, 6, 'v').set(4, 7, 'v').set(6, 7, 'v');
  g.rect(8, 4, 5, 1, 's').rect(8, 6, 4, 1, 's').rect(4, 9, 8, 1, 's');
  g.outline();
  return g.icon({ w: '#ece3d3', v: '#8a5cf0', s: '#9a8f80' });
};

const suggestion = (): PixelIcon => {
  const g = new Grid().disc(8, 6.5, 4.6, 'G').rect(6, 11, 4, 2, 's').rect(6, 13, 4, 1, 'd');
  g.set(6, 4, 'w').set(5, 5, 'w').set(6, 5, 'w').set(5, 6, 'w');
  g.line(7, 9, 7, 7, 'e').line(7, 7, 9, 7, 'e').set(9, 8, 'e').set(9, 9, 'e');
  g.outline();
  return g.icon({ G: '#ffbf5e', w: '#ece3d3', s: '#9a8f80', d: '#4a2f1c', e: '#ff8a3d' });
};

const other = (): PixelIcon => {
  const g = new Grid().disc(8, 7, 5.2, 'v').set(6, 12, 'v').set(5, 12, 'v').set(5, 13, 'v');
  g.set(4, 4, 'V').set(5, 3, 'V').set(4, 5, 'V').set(6, 2, 'V');
  for (const [x, y] of [[7, 4], [8, 4], [9, 4], [6, 5], [10, 5], [10, 6], [8, 7], [9, 7], [8, 8], [8, 10]]) g.set(x!, y!, 'w');
  g.outline();
  return g.icon({ v: '#8a5cf0', V: '#c9b0ff', w: '#ece3d3' });
};

/** One per report type (src/app/report-forms.ts). */
export const REPORT_ICONS: Record<string, PixelIcon> = {
  bug: bug(),
  online: online(),
  performance: performance(),
  interface: interfaceIcon(),
  progress: progress(),
  balance: balance(),
  text: textIcon(),
  suggestion: suggestion(),
  other: other(),
};

const caret = (): PixelIcon => {
  const g = new Grid();
  for (let i = 0; i < 4; i++) g.rect(3 + i, 6 + i, 10 - 2 * i, 1, 'G');
  g.outline();
  return g.icon({ G: '#ffbf5e', g: '#c9a45a', s: '#9a8f80' });
};

const check = (): PixelIcon => {
  const g = new Grid().line(3, 8, 6, 11, 'T').line(6, 11, 13, 4, 'T').line(3, 9, 6, 12, 't').line(6, 12, 13, 5, 't');
  g.outline();
  return g.icon({ T: '#b7ecf7', t: '#5fd0e8', s: '#9a8f80' });
};

const warn = (): PixelIcon => {
  const g = new Grid();
  for (let y = 0; y < 11; y++) g.rect(8 - Math.floor(y / 2) - 1, 2 + y, Math.floor(y / 2) * 2 + 2, 1, 'R');
  g.rect(7, 6, 2, 4, 'w').rect(7, 11, 2, 1, 'w');
  g.outline();
  return g.icon({ R: '#ff6b5e', w: '#ece3d3', r: '#c22a37' });
};

const send = (): PixelIcon => {
  const g = new Grid();
  // A paper arrow pointing right: a wedge whose fold runs down the middle.
  for (let x = 2; x <= 13; x++) {
    const half = Math.round((13 - x) * 0.42);
    g.rect(x, 8 - half, 1, half * 2 + 1, x < 7 ? 'w' : 'G');
  }
  g.line(2, 8, 11, 8, 'e');
  g.outline();
  return g.icon({ G: '#ffbf5e', w: '#ece3d3', e: '#ff8a3d' });
};

/** Small marks of the form: the dropdown caret, a valid answer, an inline error, the send arrow. */
export const FORM_ICONS: Record<string, PixelIcon> = { caret: caret(), check: check(), warn: warn(), send: send() };
