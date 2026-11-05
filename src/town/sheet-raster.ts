/**
 * A tiny RGBA raster for prerendered pixel art (the town menu's parchment map): the same palette-key drawing as
 * `Grid` (src/ui/pixel-grid.ts) but over a plain byte buffer, so the whole sheet is built, tested and hashed without a
 * canvas and only handed to one `putImageData` at the end. Every colour is a palette key; nothing is a free hex.
 */
export type Rgb = readonly [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const toHex = (n: number): string => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');

/** `t` of the way from hex `a` to hex `b` (0 = a), as a hex colour: how the sheet's palette is derived from the tokens. */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}

export const lerpRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A seeded 0..1 hash of a cell: the same number every time for the same inputs. */
export function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 4x4 ordered-dither thresholds, 0..1: the pixel-art way to fade a tone in. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number => (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;

export class Raster {
  readonly data: Uint8ClampedArray;
  private readonly rgb: Record<string, Rgb>;

  constructor(
    readonly w: number,
    readonly h: number,
    pal: Readonly<Record<string, string>>,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
    this.rgb = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, hexToRgb(v)]));
  }

  color(key: string): Rgb {
    return this.rgb[key] ?? [255, 0, 255];
  }

  /** Sets one pixel (opaque) from a palette key; out-of-range cells are ignored. */
  px(x: number, y: number, key: string): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const c = this.color(key);
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
    return this;
  }

  setRgb(x: number, y: number, c: Rgb, alpha = 255): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = alpha;
  }

  rgbAt(x: number, y: number): Rgb {
    const i = (y * this.w + x) * 4;
    return [this.data[i]!, this.data[i + 1]!, this.data[i + 2]!];
  }

  alphaAt(x: number, y: number): number {
    return this.data[(y * this.w + x) * 4 + 3]!;
  }

  rect(x: number, y: number, w: number, h: number, key: string): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, key);
    return this;
  }

  hline(x: number, y: number, w: number, key: string): this {
    return this.rect(x, y, w, 1, key);
  }

  vline(x: number, y: number, h: number, key: string): this {
    return this.rect(x, y, 1, h, key);
  }

  /** A one-pixel frame. */
  frame(x: number, y: number, w: number, h: number, key: string): this {
    return this.hline(x, y, w, key).hline(x, y + h - 1, w, key).vline(x, y, h, key).vline(x + w - 1, y, h, key);
  }

  /** A filled ellipse, row by row (crisp edges). */
  ellipse(cx: number, cy: number, rx: number, ry: number, key: string): this {
    for (let dy = -Math.ceil(ry); dy <= Math.ceil(ry); dy++) {
      const t = 1 - (dy * dy) / (ry * ry);
      if (t < 0) continue;
      const half = Math.round(rx * Math.sqrt(t));
      this.hline(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, key);
    }
    return this;
  }

  /** A line one pixel thick (Bresenham-ish). */
  line(x0: number, y0: number, x1: number, y1: number, key: string): this {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= steps; k++) this.px(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps, key);
    return this;
  }

  /** Draws `top` over this raster where `top` is opaque. */
  compose(top: Raster): void {
    for (let i = 0; i < this.data.length; i += 4) {
      if (top.data[i + 3] === 0) continue;
      this.data[i] = top.data[i]!;
      this.data[i + 1] = top.data[i + 1]!;
      this.data[i + 2] = top.data[i + 2]!;
      this.data[i + 3] = 255;
    }
  }
}
