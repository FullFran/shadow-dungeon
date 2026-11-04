import { TOWN_PROPS, type TownPropKind, type TownProp } from '../data/town';
import type { MapLink } from '../data/world';
import { PALETTE, RELIC } from '../ui/tokens';
import { seeded } from '../ui/pixel-grid';
import { groundAt, type Ground } from './map';
import { cartoucheRect, compassRect, seedOf, SHEET_MARGIN, TILE_ART, tornMask, valueNoise } from './sheet-model';
import { bayer, hash2, lerpRgb, mixHex, Raster, type Rgb } from './sheet-raster';

/**
 * The town menu's map, drawn as an aged treasure map in pixel art (owner, 2026-11-04: "mapa tipo envejecido roto irregularmente por
 * los alrededores, bien detallado tipo pixel art"): the real town layout (ground, roads, water, trees, houses with roofs, ruins) in
 * muted ink on parchment, then faded ink, stains, fold creases and a torn, burnt outline. Everything is prerendered once into a
 * plain RGBA buffer (`SheetPixels`, one `putImageData` for the canvas); nothing here runs per frame. Colours are all derived from
 * the design tokens (`PALETTE`, `RELIC`), nothing is a free hex. Deterministic: the same map is torn and stained the same way.
 */
export interface SheetPixels {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

export interface PaintableMap {
  id: string;
  rows: readonly string[];
  props: readonly TownProp[];
  links?: readonly Pick<MapLink, 'x' | 'y' | 'width' | 'height'>[];
}

/** The sheet's palette, every key mixed from the tokens. */
export function sheetPalette(): Record<string, string> {
  const paper = mixHex(PALETTE.text, PALETTE.border, 0.3);
  const ink = mixHex(PALETTE.ink, PALETTE.borderShade, 0.55);
  const grass = mixHex(paper, PALETTE.good, 0.13);
  const forest = mixHex(mixHex(paper, PALETTE.good, 0.42), ink, 0.3);
  const water = mixHex(paper, PALETTE.xp, 0.34);
  const roofRed = mixHex(paper, RELIC.blood, 0.62);
  const wood = mixHex(PALETTE.borderShade, paper, 0.3);
  const stone = mixHex(paper, ink, 0.42);
  return {
    paper,
    paperLight: mixHex(PALETTE.text, PALETTE.border, 0.14),
    paperDeep: mixHex(paper, PALETTE.borderShade, 0.3),
    ink,
    inkMid: mixHex(ink, paper, 0.3),
    inkSoft: mixHex(ink, paper, 0.58),
    grass,
    tuft: mixHex(grass, ink, 0.3),
    forest,
    forestDark: mixHex(forest, ink, 0.45),
    forestLight: mixHex(forest, PALETTE.good, 0.25),
    path: mixHex(paper, PALETTE.borderShade, 0.16),
    pathEdge: mixHex(paper, PALETTE.borderShade, 0.5),
    pebble: mixHex(paper, PALETTE.borderShade, 0.36),
    water,
    waterDark: mixHex(water, ink, 0.38),
    waterLight: mixHex(water, PALETTE.text, 0.55),
    chasm: mixHex(ink, PALETTE.eclipse, 0.1),
    chasmEdge: mixHex(chasmBase(ink), paper, 0.3),
    rock: stone,
    rockDark: mixHex(stone, ink, 0.4),
    rockLight: mixHex(stone, paper, 0.45),
    roofRed,
    roofRedLight: mixHex(roofRed, paper, 0.4),
    roofRedDark: mixHex(roofRed, ink, 0.35),
    roofWood: mixHex(wood, RELIC.goldDeep, 0.3),
    roofWoodLight: mixHex(wood, paper, 0.4),
    roofStone: mixHex(stone, ink, 0.2),
    roofStoneLight: mixHex(stone, paper, 0.35),
    roofMoss: mixHex(forest, ink, 0.1),
    roofMossLight: mixHex(forest, paper, 0.35),
    wall: mixHex(paper, PALETTE.text, 0.5),
    wallShade: mixHex(paper, PALETTE.borderShade, 0.28),
    wood,
    woodLight: mixHex(wood, paper, 0.5),
    glass: mixHex(paper, PALETTE.cursor, 0.55),
    wax: mixHex(RELIC.blood, paper, 0.18),
    stain: mixHex(paper, PALETTE.borderShade, 0.4),
    burnt: mixHex(ink, PALETTE.eclipse, 0.14),
    burntMid: mixHex(ink, paper, 0.38),
    singe: mixHex(paper, ink, 0.45),
  };
}

const chasmBase = (ink: string): string => mixHex(ink, PALETTE.ink, 0.4);

type Pen = Raster;
type PropPainter = (r: Pen, x: number, y: number, w: number, h: number, seed: number) => void;

const T = TILE_ART;

/** A pitched roof over a wall block: used by every house, shop and tower-less building. */
function house(r: Pen, x: number, y: number, w: number, h: number, solidRows: number, roof: [string, string, string], wall: string, opts: { door?: boolean; brick?: boolean; arch?: boolean } = {}): void {
  const wallTop = y + h * T - solidRows * T + 2;
  const wallBottom = y + h * T - 1;
  const left = x + 1;
  const right = x + w * T - 2;
  r.rect(left + 1, wallTop, right - left - 1, wallBottom - wallTop, wall);
  r.rect(left + 1, wallBottom - 2, right - left - 1, 2, 'wallShade');
  if (opts.brick) for (let j = wallTop + 2; j < wallBottom - 1; j += 3) for (let i = left + 2 + ((j / 3) % 2) * 2; i < right - 1; i += 4) r.px(i, j, 'wallShade');
  r.frame(left, wallTop - 1, right - left + 1, wallBottom - wallTop + 2, 'ink');
  // Roof: a stepped trapezoid wider than the wall, narrowing to a ridge.
  const roofTop = y + 1;
  const roofBottom = wallTop + 1;
  const rows = roofBottom - roofTop;
  for (let j = 0; j <= rows; j++) {
    const inset = Math.round(((rows - j) / rows) * ((w * T) / 2 - 3));
    const rl = x - 1 + inset;
    const rr = x + w * T + inset * -1;
    const yy = roofTop + j;
    r.hline(rl, yy, rr - rl, j % 3 === 2 ? roof[2] : j < rows / 2 ? roof[1] : roof[0]);
    r.px(rl, yy, 'ink');
    r.px(rr - 1, yy, 'ink');
  }
  r.hline(x - 1, roofBottom, w * T + 2, 'ink');
  r.hline(x + Math.round(w * T * 0.4), roofTop - 1, Math.round(w * T * 0.2) + 1, 'ink');
  if (opts.door !== false) {
    const dx = x + Math.floor((w * T) / 2) - 1;
    if (opts.arch) {
      r.rect(dx - 1, wallBottom - 7, 5, 7, 'ink');
      r.px(dx - 1, wallBottom - 7, 'wall');
      r.px(dx + 3, wallBottom - 7, 'wall');
    } else {
      r.rect(dx, wallBottom - 4, 3, 4, 'wood');
      r.frame(dx - 1, wallBottom - 5, 5, 5, 'ink');
    }
  }
  // Two lit windows on wide houses.
  if (w >= 3) for (const wx of [left + 3, right - 4]) r.rect(wx, wallTop + 3, 2, 2, 'glass').frame(wx - 1, wallTop + 2, 4, 4, 'ink');
}

function canopy(r: Pen, cx: number, cy: number, rad: number, pine: boolean): void {
  r.px(cx, cy + rad, 'ink');
  r.vline(cx, cy + rad - 1, 2, 'wood');
  if (pine) {
    for (let k = 0; k < 3; k++) {
      const top = cy - rad + k * 2;
      const half = 1 + k + Math.floor(rad / 3);
      r.hline(cx - half - 1, top + 2, half * 2 + 3, 'ink');
      for (let j = 0; j < 3; j++) r.hline(cx - Math.min(half, j + k), top + j, Math.min(half, j + k) * 2 + 1, j === 0 ? 'forestLight' : 'forest');
    }
    return;
  }
  r.ellipse(cx, cy, rad, rad - 0.5, 'ink');
  r.ellipse(cx, cy, rad - 1, rad - 1.5, 'forest');
  r.ellipse(cx - 1, cy - 1, Math.max(1, rad - 3), Math.max(1, rad - 3.5), 'forestLight');
  r.px(cx + 1, cy + 1, 'forestDark');
  r.px(cx + 2, cy, 'forestDark');
}

function bush(r: Pen, cx: number, cy: number, rad: number): void {
  r.ellipse(cx, cy, rad, rad - 1, 'ink');
  r.ellipse(cx, cy, rad - 1, Math.max(1, rad - 2), 'forest');
  r.px(cx - 1, cy - 1, 'forestLight');
}

function pillar(r: Pen, x: number, y: number, w: number, h: number, broken: boolean): void {
  const cx = x + Math.floor(w / 2);
  const top = broken ? y + 9 : y + 4;
  r.rect(cx - 2, top, 4, y + h - top - 2, 'rock');
  r.vline(cx - 2, top, y + h - top - 2, 'rockLight');
  r.vline(cx + 1, top, y + h - top - 2, 'rockDark');
  r.rect(cx - 3, y + h - 3, 6, 2, 'rockDark');
  if (broken) {
    r.px(cx - 2, top - 1, 'rock');
    r.px(cx + 1, top - 2, 'rock');
    r.px(cx, top - 1, 'rockDark');
  } else {
    r.rect(cx - 3, top - 2, 6, 2, 'rockLight');
    r.hline(cx - 3, top - 3, 6, 'ink');
  }
  r.frame(cx - 3, top - 1, 6, y + h - top, 'ink');
}

const PAINTERS: Record<TownPropKind, PropPainter> = {
  stall: (r, x, y, w, h) => {
    r.rect(x + 2, y + 10, w - 4, h - 12, 'wood');
    r.frame(x + 2, y + 10, w - 4, h - 12, 'ink');
    for (let i = 0; i < w - 2; i++) r.rect(x + 1 + i, y + 2, 1, 8, Math.floor(i / 2) % 2 === 0 ? 'roofRed' : 'paperLight');
    r.hline(x + 1, y + 1, w - 2, 'ink');
    r.hline(x + 1, y + 10, w - 2, 'ink');
    r.vline(x + 1, y + 2, 8, 'ink');
    r.vline(x + w - 2, y + 2, 8, 'ink');
    r.rect(x + 5, y + 13, w - 10, 3, 'woodLight');
    r.px(x + 7, y + 12, 'glass');
    r.px(x + 10, y + 12, 'wax');
  },
  'house-shop': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 2, ['roofRed', 'roofRedLight', 'roofRedDark'], 'wall'),
  'house-stone': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 2, ['roofStone', 'roofStoneLight', 'rockDark'], 'rockLight', { brick: true }),
  'house-wood': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 2, ['roofWood', 'roofWoodLight', 'rockDark'], 'woodLight'),
  'crypt-gate': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 2, ['roofStone', 'roofStoneLight', 'rockDark'], 'rock', { brick: true, arch: true }),
  'house-big': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 3, ['roofRed', 'roofRedLight', 'roofRedDark'], 'wall', { brick: true }),
  'house-moss': (r, x, y, w, h) => house(r, x, y, w / T, h / T, 3, ['roofMoss', 'roofMossLight', 'forestDark'], 'wallShade', { brick: true }),
  tower: (r, x, y, w, h) => {
    const left = x + 4;
    const width = w - 8;
    r.rect(left, y + 8, width, h - 9, 'rockLight');
    r.rect(left + width - 4, y + 8, 4, h - 9, 'rock');
    for (let j = y + 12; j < y + h - 3; j += 3) for (let i = left + 1 + ((j / 3) % 2) * 2; i < left + width - 1; i += 4) r.px(i, j, 'rockDark');
    r.frame(left, y + 7, width, h - 8, 'ink');
    for (let i = left; i < left + width; i += 4) r.rect(i, y + 3, 3, 5, 'rockLight').frame(i, y + 3, 3, 5, 'ink');
    r.rect(left + Math.floor(width / 2) - 1, y + 14, 2, 4, 'ink');
    r.rect(left + Math.floor(width / 2) - 1, y + 24, 2, 4, 'ink');
    r.rect(left + Math.floor(width / 2) - 2, y + h - 8, 4, 7, 'ink');
  },
  'notice-board': (r, x, y, w, h) => {
    r.rect(x + 3, y + 2, 2, h - 3, 'wood');
    r.rect(x + w - 5, y + 2, 2, h - 3, 'wood');
    r.rect(x + 2, y, w - 4, 5, 'woodLight');
    r.frame(x + 2, y, w - 4, 5, 'ink');
    r.hline(x + 4, y + 2, w - 8, 'inkMid');
    r.px(x + 5, y + 3, 'wax');
  },
  'tree-big': (r, x, y, w, h, seed) => {
    canopy(r, x + 10, y + 11, 7, false);
    canopy(r, x + w - 11, y + 10, 7, hash2(x, y, seed) < 0.4);
    canopy(r, x + w / 2, y + 7, 6, false);
  },
  'tree-small': (r, x, y, w, h, seed) => canopy(r, x + w / 2, y + 6, 5, hash2(x, y, seed) < 0.45),
  bush: (r, x, y) => bush(r, x + 4, y + 4, 3),
  'big-bush': (r, x, y) => {
    bush(r, x + 8, y + 9, 6);
    r.px(x + 6, y + 8, 'wax');
    r.px(x + 10, y + 10, 'wax');
  },
  stump: (r, x, y) => {
    r.ellipse(x + 4, y + 5, 3, 2, 'ink');
    r.ellipse(x + 4, y + 4, 2, 1.5, 'woodLight');
    r.px(x + 4, y + 4, 'wood');
  },
  trunk: (r, x, y, w, h) => {
    r.rect(x + 4, y + 3, w - 8, h - 5, 'wood');
    r.frame(x + 4, y + 3, w - 8, h - 5, 'ink');
    r.ellipse(x + w / 2, y + 4, 3, 1.5, 'woodLight');
    r.vline(x + w / 2 - 1, y + 8, h - 12, 'woodLight');
  },
  statue: (r, x, y, w, h) => {
    const cx = x + w / 2;
    r.rect(cx - 5, y + h - 8, 10, 6, 'rockLight');
    r.frame(cx - 5, y + h - 8, 10, 6, 'ink');
    r.rect(cx - 2, y + 7, 4, h - 15, 'rock');
    r.frame(cx - 2, y + 7, 4, h - 15, 'ink');
    r.ellipse(cx, y + 5, 2, 2.5, 'rockLight');
    r.px(cx - 2, y + 3, 'ink');
    r.px(cx + 2, y + 3, 'ink');
    r.hline(cx - 4, y + 10, 8, 'ink');
  },
  pillar: (r, x, y, w, h) => pillar(r, x, y, w, h, false),
  'pillar-broken': (r, x, y, w, h) => pillar(r, x, y, w, h, true),
  grave: (r, x, y, w, h) => {
    for (const gx of [x + 6, x + w - 8]) {
      r.rect(gx - 2, y + 8, 5, 8, 'rockLight');
      r.hline(gx - 1, y + 7, 3, 'rockLight');
      r.frame(gx - 3, y + 6, 7, 11, 'ink');
      r.px(gx, y + 10, 'inkMid');
    }
    r.vline(x + w / 2, y + 3, 7, 'ink');
    r.hline(x + w / 2 - 2, y + 5, 5, 'ink');
    r.ellipse(x + w / 2, y + h - 5, 6, 2, 'pathEdge');
  },
  'wall-ruin': (r, x, y, w, h) => {
    for (let i = 0; i < w - 2; i++) {
      const top = y + 3 + Math.floor(hash2(x + i, y, 5) * 6) * (i % 5 === 3 ? 1.5 : 1);
      r.rect(x + 1 + i, top, 1, y + h - 2 - top, i % 3 === 0 ? 'rockDark' : 'rock');
      r.px(x + 1 + i, top, 'ink');
    }
    r.hline(x + 1, y + h - 2, w - 2, 'ink');
    for (let j = y + 7; j < y + h - 2; j += 3) r.hline(x + 2, j, w - 4, 'rockDark');
  },
  rubble: (r, x, y) => {
    for (const [dx, dy, s] of [[3, 3, 2], [8, 5, 3], [12, 3, 2]] as const) r.rect(x + dx, y + dy, s, Math.max(1, s - 1), 'rock').px(x + dx, y + dy, 'rockLight').hline(x + dx, y + dy + s - 1, s, 'ink');
  },
  fence: (r, x, y, w, h) => {
    r.hline(x + 1, y + h - 9, w - 2, 'wood');
    r.hline(x + 1, y + h - 5, w - 2, 'wood');
    for (let i = 3; i < w - 2; i += 6) r.rect(x + i, y + h - 11, 2, 9, 'woodLight').vline(x + i + 2, y + h - 11, 9, 'ink');
  },
  'frog-idol': (r, x, y, w, h) => {
    const cx = x + w / 2;
    r.ellipse(cx, y + h - 6, 6, 5, 'ink');
    r.ellipse(cx, y + h - 6, 5, 4, 'forest');
    r.rect(cx - 5, y + h - 11, 3, 3, 'forestLight').frame(cx - 6, y + h - 12, 5, 5, 'ink');
    r.rect(cx + 2, y + h - 11, 3, 3, 'forestLight').frame(cx + 1, y + h - 12, 5, 5, 'ink');
    r.px(cx - 4, y + h - 10, 'ink');
    r.px(cx + 3, y + h - 10, 'ink');
    r.hline(cx - 3, y + h - 5, 6, 'ink');
  },
  'flat-rocks': (r, x, y) => {
    for (const [dx, dy, rx] of [[5, 5, 4], [14, 8, 5], [8, 11, 3]] as const) r.ellipse(x + dx, y + dy, rx, 1.6, 'pebble').ellipse(x + dx, y + dy - 1, rx - 1, 0.6, 'paperLight');
  },
};

/** Every prop kind the painter knows (the test walks `TOWN_PROPS`). */
export const PAINTED_PROPS: readonly string[] = Object.keys(PAINTERS);

function drawGround(r: Pen, map: PaintableMap, cols: number, rows: number, seed: number): void {
  const at = (x: number, y: number): Ground => (x < 0 || y < 0 || x >= cols || y >= rows ? 'forest' : groundAt(map, x, y));
  const inMap = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < cols && y < rows;
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const g = at(tx, ty);
      const x = SHEET_MARGIN + tx * T;
      const y = SHEET_MARGIN + ty * T;
      if (g === 'sky') continue;
      const base = g === 'grass' ? 'grass' : g === 'path' ? 'path' : g === 'water' ? 'water' : g === 'forest' ? 'grass' : g === 'chasm' ? 'chasm' : g === 'rock' ? 'rock' : 'wood';
      r.rect(x, y, T, T, base);
      const h = (i: number): number => hash2(tx * 31 + i, ty * 17 + i * 3, seed);
      if (g === 'grass' || g === 'forest') {
        for (let i = 0; i < 3; i++) {
          const px = x + 1 + Math.floor(h(i) * 6);
          const py = y + 2 + Math.floor(h(i + 9) * 5);
          r.px(px, py, 'tuft').px(px + 1, py - 1, 'tuft');
        }
      } else if (g === 'path') {
        for (let i = 0; i < 3; i++) r.px(x + Math.floor(h(i) * 8), y + Math.floor(h(i + 5) * 8), 'pebble');
        const edge = (nx: number, ny: number): boolean => inMap(nx, ny) && at(nx, ny) !== 'path' && at(nx, ny) !== 'bridge';
        if (edge(tx, ty - 1)) for (let i = 0; i < T; i++) if (h(i + 20) > 0.18) r.px(x + i, y, 'pathEdge');
        if (edge(tx, ty + 1)) for (let i = 0; i < T; i++) if (h(i + 30) > 0.18) r.px(x + i, y + T - 1, 'pathEdge');
        if (edge(tx - 1, ty)) for (let i = 0; i < T; i++) if (h(i + 40) > 0.18) r.px(x, y + i, 'pathEdge');
        if (edge(tx + 1, ty)) for (let i = 0; i < T; i++) if (h(i + 50) > 0.18) r.px(x + T - 1, y + i, 'pathEdge');
      } else if (g === 'water') {
        for (const row of [2, 5]) {
          const off = Math.floor(h(row) * 3);
          r.hline(x + off, y + row, 3, 'waterLight').hline(x + off + 3, y + row + 1, 2, 'waterDark');
        }
        const shore = (nx: number, ny: number): boolean => inMap(nx, ny) && at(nx, ny) !== 'water' && at(nx, ny) !== 'bridge';
        if (shore(tx, ty - 1)) r.hline(x, y, T, 'inkMid');
        if (shore(tx, ty + 1)) r.hline(x, y + T - 1, T, 'inkMid');
        if (shore(tx - 1, ty)) r.vline(x, y, T, 'inkMid');
        if (shore(tx + 1, ty)) r.vline(x + T - 1, y, T, 'inkMid');
      } else if (g === 'bridge') {
        const horizontal = at(tx - 1, ty) === 'bridge' || at(tx + 1, ty) === 'bridge' || at(tx - 1, ty) === 'path' || at(tx + 1, ty) === 'path';
        for (let i = 1; i < T; i += 2) (horizontal ? r.vline(x + i, y, T, 'woodLight') : r.hline(x, y + i, T, 'woodLight'));
        (horizontal ? r.hline(x, y, T, 'ink') : r.vline(x, y, T, 'ink'));
        (horizontal ? r.hline(x, y + T - 1, T, 'ink') : r.vline(x + T - 1, y, T, 'ink'));
      } else if (g === 'chasm') {
        for (let i = -T; i < T; i += 3) r.line(x + i, y, x + i + T, y + T, 'chasmEdge');
        const lip = (nx: number, ny: number): boolean => inMap(nx, ny) && at(nx, ny) !== 'chasm' && at(nx, ny) !== 'bridge';
        if (lip(tx, ty - 1)) r.hline(x, y, T, 'ink');
        if (lip(tx, ty + 1)) r.hline(x, y + T - 1, T, 'ink');
        if (lip(tx - 1, ty)) r.vline(x, y, T, 'ink');
        if (lip(tx + 1, ty)) r.vline(x + T - 1, y, T, 'ink');
      } else if (g === 'rock') {
        for (let i = 0; i < 4; i++) r.px(x + Math.floor(h(i) * 8), y + Math.floor(h(i + 7) * 8), i % 2 ? 'rockDark' : 'rockLight');
        r.hline(x, y + T - 1, T, 'rockDark');
      }
    }
  }
  // Trees over the forest tiles, row by row so the lower ones cover the upper.
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      if (at(tx, ty) !== 'forest') continue;
      const k = hash2(tx, ty, seed + 11);
      const cx = SHEET_MARGIN + tx * T + 4 + Math.round((hash2(tx, ty, seed + 12) - 0.5) * 2);
      const cy = SHEET_MARGIN + ty * T + 3 + Math.round(hash2(tx, ty, seed + 13) * 2);
      canopy(r, cx, cy, 4, k < 0.4);
    }
  }
}

/** Cartographic frame: a thin double border round the town with ticks every four tiles. */
function drawFrame(r: Pen, cols: number, rows: number): void {
  const x = SHEET_MARGIN - 2;
  const y = SHEET_MARGIN - 2;
  const w = cols * T + 4;
  const h = rows * T + 4;
  r.frame(x, y, w, h, 'inkMid');
  r.frame(x + 1, y + 1, w - 2, h - 2, 'inkSoft');
  for (let tx = 0; tx <= cols; tx += 4) {
    r.vline(SHEET_MARGIN + tx * T, y - 2, 2, 'inkMid');
    r.vline(SHEET_MARGIN + tx * T, y + h, 2, 'inkMid');
  }
  for (let ty = 0; ty <= rows; ty += 4) {
    r.hline(x - 2, SHEET_MARGIN + ty * T, 2, 'inkMid');
    r.hline(x + w, SHEET_MARGIN + ty * T, 2, 'inkMid');
  }
}

/** Where the roads leave the map: the road runs on across the margin ending in an arrowhead. */
function drawLinks(r: Pen, map: PaintableMap, cols: number, rows: number): void {
  for (const l of map.links ?? []) {
    const x0 = SHEET_MARGIN + l.x * T;
    const y0 = SHEET_MARGIN + l.y * T;
    const w = l.width * T;
    const h = l.height * T;
    const reach = 10;
    if (l.x === 0) {
      r.rect(SHEET_MARGIN - reach, y0, reach, h, 'path');
      const cy = y0 + Math.floor(h / 2);
      r.line(SHEET_MARGIN - reach + 1, cy, SHEET_MARGIN - reach + 4, cy - 2, 'ink').line(SHEET_MARGIN - reach + 1, cy, SHEET_MARGIN - reach + 4, cy + 2, 'ink');
    } else if (l.x + l.width >= cols) {
      r.rect(x0 + w, y0, reach, h, 'path');
      const cy = y0 + Math.floor(h / 2);
      r.line(x0 + w + reach - 2, cy, x0 + w + reach - 5, cy - 2, 'ink').line(x0 + w + reach - 2, cy, x0 + w + reach - 5, cy + 2, 'ink');
    } else if (l.y === 0) {
      r.rect(x0, SHEET_MARGIN - reach, w, reach, 'path');
      const cx = x0 + Math.floor(w / 2);
      r.line(cx, SHEET_MARGIN - reach + 1, cx - 2, SHEET_MARGIN - reach + 4, 'ink').line(cx, SHEET_MARGIN - reach + 1, cx + 2, SHEET_MARGIN - reach + 4, 'ink');
    } else if (l.y + l.height >= rows) {
      r.rect(x0, y0 + h, w, reach, 'path');
      const cx = x0 + Math.floor(w / 2);
      r.line(cx, y0 + h + reach - 2, cx - 2, y0 + h + reach - 5, 'ink').line(cx, y0 + h + reach - 2, cx + 2, y0 + h + reach - 5, 'ink');
    }
  }
}

/** The ribbon the town's name sits on (the text itself is real DOM text laid over it), notched at both ends. */
function drawCartouche(r: Pen, artW: number): void {
  const c = cartoucheRect(artW);
  r.rect(c.x, c.y, c.w, c.h, 'paperLight');
  r.frame(c.x, c.y, c.w, c.h, 'ink');
  r.frame(c.x + 2, c.y + 2, c.w - 4, c.h - 4, 'inkSoft');
  for (const side of [-1, 1]) {
    const tx = side < 0 ? c.x - 6 : c.x + c.w;
    r.rect(tx, c.y + 3, 6, c.h - 4, 'paperLight');
    r.frame(tx, c.y + 3, 6, c.h - 4, 'ink');
    for (let j = 0; j < 4; j++) {
      const nx = side < 0 ? tx : tx + 5;
      r.px(nx, c.y + 3 + j, 'chasm').px(nx, c.y + c.h - 2 - j, 'chasm');
    }
    r.px(side < 0 ? c.x + 1 : c.x + c.w - 2, c.y + c.h - 1, 'inkMid');
  }
  r.px(c.x + 4, c.y + 5, 'wax').px(c.x + c.w - 5, c.y + 5, 'wax');
}

/** A compass rose: a four-point star in a ring with the north point in wax red and an N above. */
function drawCompass(r: Pen, artW: number, artH: number): void {
  const k = compassRect(artW, artH);
  const cx = k.x + 15;
  const cy = k.y + 18;
  const glyph = ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'];
  glyph.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && r.px(cx - 2 + i, k.y + j, 'wax')));
  r.ellipse(cx, cy, 11, 11, 'inkMid');
  r.ellipse(cx, cy, 10, 10, 'paperLight');
  r.ellipse(cx, cy, 8, 8, 'paper');
  // Diagonal needles first, then the long cardinal points over them.
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) r.line(cx, cy, cx + dx * 6, cy + dy * 6, 'inkSoft');
  for (let i = 1; i <= 10; i++) {
    const half = Math.max(0, 3 - Math.floor(i / 3));
    r.hline(cx - half, cy - i, half * 2 + 1, i < 7 ? 'wax' : 'wax');
    r.hline(cx - half, cy + i, half * 2 + 1, 'ink');
    r.vline(cx + i, cy - half, half * 2 + 1, 'ink');
    r.vline(cx - i, cy - half, half * 2 + 1, 'ink');
  }
  r.px(cx, cy, 'paperLight');
}

/** Stains, a coffee ring and foxing: tone shifted over the finished sheet with an ordered dither (pixel-art, no gradient). */
function applyStains(c: Raster, seed: number): void {
  const rng = seeded(seed ^ 0x51ed);
  const stain = c.color('stain');
  const blots = Array.from({ length: 6 }, (_, i) => ({ x: rng() * c.w, y: rng() * c.h, r: 12 + rng() * 22, strength: 0.4 + rng() * 0.35, ring: i % 3 === 2 }));
  for (const b of blots) {
    for (let y = Math.max(0, Math.floor(b.y - b.r)); y < Math.min(c.h, Math.ceil(b.y + b.r)); y++) {
      for (let x = Math.max(0, Math.floor(b.x - b.r)); x < Math.min(c.w, Math.ceil(b.x + b.r)); x++) {
        const d = Math.hypot(x - b.x, y - b.y) / b.r;
        if (d >= 1) continue;
        const level = b.ring ? (d > 0.78 ? 0.9 : d > 0.7 ? 0.4 : 0) : (1 - d) * b.strength * 1.6;
        if (level > bayer(x, y)) c.setRgb(x, y, lerpRgb(c.rgbAt(x, y), stain, b.ring ? 0.4 : 0.3));
      }
    }
  }
  for (let i = 0; i < 38; i++) {
    const x = Math.floor(rng() * c.w);
    const y = Math.floor(rng() * c.h);
    c.setRgb(x, y, lerpRgb(c.rgbAt(x, y), stain, 0.5));
    if (rng() < 0.4) c.setRgb(x + 1, y, lerpRgb(c.rgbAt(x + 1, y), stain, 0.3));
  }
}

/** Two folds, vertical and horizontal, a dark line with a lit edge beside it and breaks where the paper has worn through. */
function applyCreases(c: Raster, seed: number, paperLight: Rgb, ink: Rgb): void {
  const vx = Math.round(c.w * 0.5);
  const hy = Math.round(c.h * 0.5);
  for (let y = 0; y < c.h; y++) {
    const x = vx + Math.round((valueNoise(y / 14, 3, seed) - 0.5) * 4);
    if (hash2(x, y, seed + 21) < 0.1) continue;
    c.setRgb(x, y, lerpRgb(c.rgbAt(x, y), ink, 0.24));
    c.setRgb(x + 1, y, lerpRgb(c.rgbAt(x + 1, y), paperLight, 0.35));
  }
  for (let x = 0; x < c.w; x++) {
    const y = hy + Math.round((valueNoise(x / 14, 9, seed) - 0.5) * 4);
    if (hash2(x, y, seed + 22) < 0.1) continue;
    c.setRgb(x, y, lerpRgb(c.rgbAt(x, y), ink, 0.24));
    c.setRgb(x, y + 1, lerpRgb(c.rgbAt(x, y + 1), paperLight, 0.35));
  }
}

/** Paints the parchment map of `map` into RGBA pixels. */
export function paintTownSheet(map: PaintableMap): SheetPixels {
  const cols = Math.max(...map.rows.map((row) => row.length));
  const rows = map.rows.length;
  const w = cols * T + 2 * SHEET_MARGIN;
  const h = rows * T + 2 * SHEET_MARGIN;
  const pal = sheetPalette();
  const seed = seedOf(map.id);

  // Paper: mottled tone with fibres.
  const sheet = new Raster(w, h, pal);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tone = (valueNoise(x / 16, y / 16, seed) - 0.5) * 2;
      const fibre = hash2(x, y, seed + 1);
      const key = fibre < 0.035 ? 'paperLight' : fibre < 0.06 ? 'paperDeep' : tone > 0.25 && tone - 0.25 > bayer(x, y) * 0.7 ? 'paperLight' : tone < -0.25 && -tone - 0.25 > bayer(x, y) * 0.7 ? 'paperDeep' : 'paper';
      sheet.px(x, y, key);
    }
  }

  // Ink: ground, frame, roads off the map, props by their feet, the ornaments.
  const ink = new Raster(w, h, pal);
  drawGround(ink, map, cols, rows, seed);
  drawFrame(ink, cols, rows);
  drawLinks(ink, map, cols, rows);
  const props = [...map.props].sort((a, b) => Number(TOWN_PROPS[b.kind].decal === true) - Number(TOWN_PROPS[a.kind].decal === true) || a.y + TOWN_PROPS[a.kind].height - (b.y + TOWN_PROPS[b.kind].height) || a.x - b.x);
  for (const p of props) {
    const spec = TOWN_PROPS[p.kind];
    PAINTERS[p.kind](ink, SHEET_MARGIN + p.x * T, SHEET_MARGIN + p.y * T, spec.width * T, spec.height * T, seed);
  }
  drawCartouche(ink, w);
  drawCompass(ink, w, h);

  // Faded ink: some pixels have worn away, some are pale.
  const paper = sheet.color('paper');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (ink.alphaAt(x, y) === 0) continue;
      const wear = hash2(x, y, seed + 3);
      if (wear < 0.02) ink.setRgb(x, y, [0, 0, 0], 0);
      else if (wear < 0.07) ink.setRgb(x, y, lerpRgb(ink.rgbAt(x, y), paper, 0.4));
    }
  }
  sheet.compose(ink);

  applyStains(sheet, seed);
  applyCreases(sheet, seed, sheet.color('paperLight'), sheet.color('ink'));

  // Torn and burnt outline.
  const mask = tornMask(w, h, seed);
  const burnt = sheet.color('burnt');
  const burntMid = sheet.color('burntMid');
  const singe = sheet.color('singe');
  const deep = sheet.color('paperDeep');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const state = mask[y * w + x]!;
      if (state === 0) sheet.setRgb(x, y, [0, 0, 0], 0);
      else if (state === 1) sheet.setRgb(x, y, hash2(x, y, seed + 5) < 0.55 ? burnt : burntMid);
      else if (state === 2) sheet.setRgb(x, y, lerpRgb(sheet.rgbAt(x, y), hash2(x, y, seed + 6) < 0.5 ? singe : deep, 0.55));
    }
  }
  return { w, h, data: sheet.data };
}
