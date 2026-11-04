import { seeded } from '../ui/pixel-grid';

/**
 * Pure model of the town menu's map sheet (owner, 2026-11-04: "un mapa que se vea completo lo máximo posible ... envejecido roto
 * irregularmente por los alrededores ... el menú debe salir de abajo"): how big the panel is, the largest scale that shows the
 * whole town, the entrance timing, the torn-edge mask of the parchment and where a place card sits. No DOM here, so every
 * number is tested (tests/town/sheet-model.test.ts).
 */

/** Art pixels of the sheet per town tile, and the torn margin around the map (art pixels). */
export const TILE_ART = 8;
export const SHEET_MARGIN = 14;

export interface Box {
  w: number;
  h: number;
}
export interface Rect extends Box {
  x: number;
  y: number;
}

/** The panel is this share of the window, capped (owner: about 94vw x 88vh, up to 1500 x 900). */
export function panelSize(vw: number, vh: number): Box {
  return { w: Math.min(vw * 0.94, 1500), h: Math.min(vh * 0.88, 900) };
}

export interface MenuGeometry {
  panel: Box;
  /** A short landscape window (a phone on its side): the options turn into an icon grid. */
  compact: boolean;
  pad: number;
  gap: number;
  /** Room for the map (left, 60% of the width) and for the options (right), in CSS px. */
  mapBox: Box;
  optionsBox: Box;
}

/** Windows this short (or shorter) are "compact". */
export const COMPACT_HEIGHT = 520;

export function menuGeometry(vw: number, vh: number): MenuGeometry {
  const panel = panelSize(vw, vh);
  const compact = vh <= COMPACT_HEIGHT;
  const pad = compact ? 10 : 18;
  const gap = compact ? 10 : 16;
  const room = panel.w - 2 * pad - gap;
  const height = panel.h - 2 * pad;
  // The map takes 60% of the room on a short landscape window; elsewhere the options keep a readable 380-470 px and the map gets the rest.
  const optionsW = compact ? room * 0.4 : Math.min(470, Math.max(380, room * 0.36));
  return { panel, compact, pad, gap, mapBox: { w: room - optionsW, h: height }, optionsBox: { w: optionsW, h: height } };
}

export interface SheetFit {
  /** The sheet in art pixels: the town plus the torn margin. */
  artW: number;
  artH: number;
  /** CSS px per art pixel. */
  scale: number;
  width: number;
  height: number;
}

/**
 * A whole scale that fills less than this share of the box along its limiting side gives way to a fractional one (owner: the map
 * must show as large as it can, so a whole scale is kept only while it wastes at most 10%).
 */
export const SHEET_MIN_FILL = 0.9;

/**
 * The largest scale at which the whole sheet fits the box: a whole number of pixels per art pixel (crisp), or the exact
 * fractional fit when the whole one would waste more than 10% of the limiting side (or the box is smaller than the art).
 * The art is painted once; a fractional scale only resizes the finished canvas by CSS (pixelated).
 */
export function sheetFit(cols: number, rows: number, boxW: number, boxH: number): SheetFit {
  const artW = cols * TILE_ART + 2 * SHEET_MARGIN;
  const artH = rows * TILE_ART + 2 * SHEET_MARGIN;
  const raw = Math.max(0.01, Math.min(boxW / artW, boxH / artH));
  const whole = Math.floor(raw);
  const scale = whole >= 1 && whole / raw >= SHEET_MIN_FILL ? whole : raw;
  return { artW, artH, scale, width: artW * scale, height: artH * scale };
}

export interface MenuTiming {
  kind: 'slide' | 'fade';
  enterMs: number;
  exitMs: number;
  veilMs: number;
}

/** The panel rises 260 ms ease-out and leaves in 200 ms; the veil fades 160 ms. Reduced motion: a plain fade, no travel. */
export function menuTiming(reducedMotion: boolean): MenuTiming {
  return reducedMotion ? { kind: 'fade', enterMs: 160, exitMs: 160, veilMs: 160 } : { kind: 'slide', enterMs: 260, exitMs: 200, veilMs: 160 };
}

/** A stable 32-bit seed of a name (FNV-1a), so each map tears its own way, the same way every time. */
export function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Value noise at a point: bilinear over a hashed lattice, 0..1. */
export function valueNoise(x: number, y: number, seed: number): number {
  const lattice = (ix: number, iy: number): number => {
    let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const top = lattice(x0, y0) * (1 - sx) + lattice(x0 + 1, y0) * sx;
  const bottom = lattice(x0, y0 + 1) * (1 - sx) + lattice(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Mask states: 0 gone, 1 burnt rim, 2 singed band, 3 clean paper. */
export type MaskState = 0 | 1 | 2 | 3;

/**
 * The torn and burnt outline of the parchment for a `w` x `h` sheet: pixels within a ragged band from the edge are gone
 * (value noise plus a few round bites), the kept pixels touching a gap are the burnt rim, the next few are singed, the rest
 * is paper. The band never reaches deeper than `SHEET_MARGIN`, so the map itself is never cut. Pure: same seed, same sheet.
 */
export function tornMask(w: number, h: number, seed: number): Uint8Array {
  const keep = new Uint8Array(w * h);
  const rng = seeded(seed ^ 0x9e3779b9);
  // Bites: round tears whose centre sits on the edge, shallow enough to stay inside the margin band.
  const bites = Array.from({ length: Math.max(8, Math.round((w + h) / 40)) }, () => {
    const side = Math.floor(rng() * 4);
    const along = rng();
    const radius = 2.5 + rng() * 3;
    const depth = rng() * 1.5;
    return side === 0 ? { x: along * w, y: depth, radius } : side === 1 ? { x: along * w, y: h - 1 - depth, radius } : side === 2 ? { x: depth, y: along * h, radius } : { x: w - 1 - depth, y: along * h, radius };
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const reach = 2 + 4 * valueNoise(x / 5, y / 5, seed) + 2 * valueNoise(x / 2.2, y / 2.2, seed + 7);
      let kept = edge >= reach;
      if (kept) for (const b of bites) if (Math.hypot(x - b.x, y - b.y) < b.radius) kept = false;
      keep[y * w + x] = kept ? 1 : 0;
    }
  }
  // Depth from the nearest gap (4-neighbour steps): 1 touches a gap.
  const depth = new Int16Array(w * h).fill(-1);
  const queue: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!keep[i]) continue;
      const open = x === 0 || y === 0 || x === w - 1 || y === h - 1 || !keep[i - 1] || !keep[i + 1] || !keep[i - w] || !keep[i + w];
      if (open) {
        depth[i] = 1;
        queue.push(i);
      }
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    if (depth[i]! >= 4) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j >= 0 && j < w * h && keep[j] && depth[j] === -1) {
        depth[j] = depth[i]! + 1;
        queue.push(j);
      }
    }
  }
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = !keep[i] ? 0 : depth[i] === 1 ? 1 : depth[i]! > 0 && depth[i]! <= 4 ? 2 : 3;
  return mask;
}

/** The cartouche (town name) sits in the forest rows at the top centre of the sheet, in art pixels. */
export function cartoucheRect(artW: number): Rect {
  const w = Math.min(124, artW - 2 * SHEET_MARGIN);
  return { x: Math.round((artW - w) / 2), y: 12, w, h: 18 };
}

/** The compass rose sits in the forest rows at the bottom right, in art pixels. */
export function compassRect(artW: number, artH: number): Rect {
  const size = 30;
  return { x: artW - SHEET_MARGIN - 4 - size, y: artH - SHEET_MARGIN - 4 - size, w: size, h: size };
}

/**
 * Where a place card goes for a pin at `anchor` (all in CSS px of the same area): centred above the pin, flipped below when
 * there is no room above, clamped inside `bounds`; `arrowX` is the pointer's offset inside the card.
 */
export function placeCard(anchor: { x: number; y: number }, size: Box, bounds: Box, gap: number): { x: number; y: number; side: 'above' | 'below'; arrowX: number } {
  const x = Math.max(0, Math.min(bounds.w - size.w, anchor.x - size.w / 2));
  const above = anchor.y - gap - size.h >= 0;
  const y = above ? anchor.y - gap - size.h : Math.min(Math.max(0, bounds.h - size.h), anchor.y + gap);
  return { x, y, side: above ? 'above' : 'below', arrowX: anchor.x - x };
}

/** Where the keyboard or pad focus starts when the menu opens: "Seguir" (the index after the pins), never a pin (owner: no card until a pin is hovered). */
export const initialFocus = (pinCount: number): number => pinCount;

/** The pin whose place card shows for the focused item: only a pin, never "Seguir", an option or nothing (-1). */
export const cardPin = (index: number, pinCount: number): number | null => (index >= 0 && index < pinCount ? index : null);
