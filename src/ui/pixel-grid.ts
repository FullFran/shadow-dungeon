/**
 * A cell grid over a 2D canvas for hand-placed pixel art (odd/tasks/title-hub.md T9;
 * after cobbleverse-platform's pixel-kit): one cell is one canvas pixel, colours are
 * palette keys, so a scene reads as one palette and lights stay consistent. Used to
 * prerender static layers once; nothing here runs per frame.
 */
export type Palette = Readonly<Record<string, string>>;

export class Grid {
  constructor(
    readonly ctx: CanvasRenderingContext2D,
    readonly pal: Palette,
  ) {}

  private fill(key: string): boolean {
    const color = this.pal[key];
    if (!color) return false;
    this.ctx.fillStyle = color;
    return true;
  }

  rect(x: number, y: number, w: number, h: number, key: string): this {
    if (w > 0 && h > 0 && this.fill(key)) this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    return this;
  }

  set(x: number, y: number, key: string): this {
    return this.rect(x, y, 1, 1, key);
  }

  hline(x: number, y: number, w: number, key: string): this {
    return this.rect(x, y, w, 1, key);
  }

  vline(x: number, y: number, h: number, key: string): this {
    return this.rect(x, y, 1, h, key);
  }

  /** A filled ellipse, row by row (crisp edges). */
  ellipse(cx: number, cy: number, rx: number, ry: number, key: string): this {
    if (!this.fill(key) || rx <= 0 || ry <= 0) return this;
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t < 0) continue;
      const half = Math.round(rx * Math.sqrt(t));
      this.ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
    }
    return this;
  }

  /** A crisp line of `width` cells, thick across its direction (not in steps along it). */
  line(x0: number, y0: number, x1: number, y1: number, width: number, key: string): this {
    if (!this.fill(key)) return this;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
    for (let o = 0; o < width; o++) {
      const off = o - (width - 1) / 2;
      for (let k = 0; k <= steps; k++) {
        const x = Math.round(x0 + (dx * k) / steps + nx * off);
        const y = Math.round(y0 + (dy * k) / steps + ny * off);
        this.ctx.fillRect(x, y, 1, 1);
      }
    }
    return this;
  }
}

/** Seeded 0..1 generator (mulberry32): the same scene every time for the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A light a prop gives off: drawn additively per frame, `flicker` 0 (steady) .. 1 (a flame). */
export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  op: number;
  flicker: number;
}
