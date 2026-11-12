import { isWall, TILE, type TileGrid } from '../core/tiles';
import type { TilePalette } from '../data/dungeons';
import { Grid, type Palette } from '../ui/pixel-grid';
import { decorHash } from './crypt-decor';
import { floorProps, floorSignature, floorVariant, type ArtFloor, type ArtTheme, type PropKind } from './floor-art';

/**
 * The dungeon art pass drawn (odd/tasks/dungeon-art-pass.md): textured floor
 * tiles in three tones that drift in blotches across several tiles, wall tops
 * as each dungeon's terrain (cut stone, tree crowns, wet rock, mud banks, the
 * abyss's void), wall faces with depth and corner pieces, graded shadow at
 * the wall bases, banks around water and toxic pools, and the props of
 * floor-art.ts. All original pixel art on the cell grid (src/ui/pixel-grid.ts),
 * colours from palette keys only. A generated floor is drawn once into an
 * offscreen layer (`floorLayer`), a fixed arena once per size (`arenaLayer`);
 * per frame the renderer only blits the visible part.
 */

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const hex = ([r, g, b]: Rgb): string => `#${[r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')}`;

/** `a` towards `b` by `t` (0..1). */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}
const lighten = (c: string, t: number) => mix(c, '#ffffff', t);
const darken = (c: string, t: number) => mix(c, '#000000', t);

/** Each theme's own materials (props and accents), muted so they stay under the gameplay layers. */
const THEME_KEYS: Readonly<Record<ArtTheme, Palette>> = {
  crypt: { bone: '#a9a28f', boneD: '#6c6658', urn: '#4f4049', urnL: '#6e5c66', web: 'rgba(205, 205, 222, 0.32)', moss: '#3d4a38', mossL: '#52624a' },
  forest: { leaf: '#3c6431', leafL: '#5a8a42', leafD: '#26431f', petal: '#d9cf9c', petal2: '#c27d8c', bark: '#4a3a2a', barkL: '#6a5439', stone: '#5a5e55', stoneL: '#767a6e' },
  caves: { cr: '#5fb4cc', crL: '#bfeaf7', crD: '#2c6377', glow: '#6fd3a4', glowD: '#2e6b54', wetD: 'rgba(8, 30, 44, 0.45)', foam: 'rgba(170, 220, 240, 0.35)', stone: '#3c4d58', stoneL: '#56707e' },
  swamp: { mud: '#2a2a1b', mudL: '#3c3a25', slime: '#7aa23a', slimeD: '#4c6a25', cap: '#80466a', capL: '#ad7590', bone: '#9f9a83', boneD: '#666250', bark: '#3a3328', barkL: '#55503d', leaf: '#3f5a2a', leafL: '#5a7a38' },
  abyss: { ember: '#b8403a', emberL: '#ff8a5a', ash: '#4e4049', ashL: '#6e5c66', stone: '#3c2a33', stoneL: '#5a404b' },
};

/** Every theme key, so a palette always answers a prop of any theme (tests watch for missing keys). */
const ALL_THEME_KEYS: Palette = Object.assign({}, ...Object.values(THEME_KEYS)) as Palette;

/**
 * The grid palette of a floor: tones and shades derived from the dungeon's
 * tile colours (lighter floors, darker textured walls: the contrast budget of
 * docs/research/dungeon-map-look.md Q2) plus the theme's materials.
 * `arena`: a fixed arena's floor colours instead of the generated tiles'.
 */
export function artPalette(p: TilePalette, theme: ArtTheme, arena = false): Palette {
  const a = arena ? p.floorA : p.tileFloorA;
  const b = arena ? p.floorB : p.tileFloorB;
  const base = lighten(a, 0.07);
  return {
    ...ALL_THEME_KEYS,
    ...THEME_KEYS[theme],
    f0: base,
    f1: lighten(mix(a, b, 0.5), 0.09),
    f2: darken(base, 0.08),
    fL: lighten(base, 0.16),
    fD: darken(base, 0.24),
    fDD: darken(base, 0.42),
    ao1: 'rgba(0, 0, 0, 0.42)',
    ao2: 'rgba(0, 0, 0, 0.26)',
    ao3: 'rgba(0, 0, 0, 0.12)',
    sh: 'rgba(0, 0, 0, 0.3)',
    wt: darken(p.tileWallTop, 0.15),
    wb: p.tileWallBlock,
    wbL: lighten(p.tileWallBlock, 0.16),
    wbD: darken(p.tileWallBlock, 0.3),
    wf: p.tileWallFace,
    wfL: lighten(p.tileWallFace, 0.14),
    wfD: darken(p.tileWallFace, 0.38),
    lip: p.tileWallLip,
    lipL: lighten(p.tileWallLip, 0.25),
  };
}

/** Height of a wall's front face (a wall tile with floor right below it). */
const FACE = 12;
/** Side of the tone cells of a floor tile. */
const SUB = 8;
const H = (x: number, y: number, salt: number) => decorHash(x, y, salt);

/**
 * One floor tile at (x, y) world px: its tone (0..1, drifting across tiles)
 * picks the base, the variant adds speckles, a patch, a crack, pebbles or the
 * theme's accent (flagstone joints, grass blades, a wet sheen, a mud blot, an
 * ember vein).
 */
export function drawFloorTile(g: Grid, theme: ArtTheme, variant: number, x: number, y: number, tone: number | ((wx: number, wy: number) => number), look = 0.5): void {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  // The base in 8 px cells, each its tone, so the blotches have soft ragged edges instead of tile squares.
  const toneKey = (t: number) => (t < 0.38 ? 'f2' : t > 0.62 ? 'f1' : 'f0');
  for (let cy = 0; cy < TILE; cy += SUB) {
    for (let cx = 0; cx < TILE; cx += SUB) {
      const t = typeof tone === 'number' ? tone : tone(x + cx + SUB / 2, y + cy + SUB / 2);
      g.rect(x + cx, y + cy, SUB, SUB, toneKey(t));
      // A dithered pixel of the middle tone near a tone's edge.
      if ((t > 0.33 && t < 0.38) || (t > 0.62 && t < 0.67)) g.set(x + cx + ((cx + cy) % 5) + 1, y + cy + 3, 'f0').set(x + cx + 5, y + cy + 6, 'f0');
    }
  }
  // The Crypt: big flagstones (two tiles wide, staggered by row), joints faint.
  if (theme === 'crypt') {
    if ((tx + (ty % 2)) % 2 === 0) g.vline(x, y, TILE, 'fD');
    g.hline(x, y, TILE, 'fD');
    g.hline(x + 1, y + 1, TILE - 2, 'fL');
  }
  const s = (k: number) => H(tx, ty, 300 + k);
  const at = (k: number, span = TILE - 4) => 2 + Math.floor(s(k) * span);
  switch (variant) {
    case 0:
      g.set(x + at(1), y + at(2), 'fL');
      g.set(x + at(3), y + at(4), 'fD');
      break;
    case 1:
      for (let i = 0; i < 6; i++) g.set(x + at(10 + i), y + at(20 + i), i % 3 === 0 ? 'fL' : 'fD');
      break;
    case 2: {
      const cx = x + 8 + Math.floor(s(5) * 16);
      const cy = y + 8 + Math.floor(s(6) * 16);
      const rx = 5 + Math.floor(look * 4);
      g.ellipse(cx, cy, rx, rx - 2, look > 0.5 ? 'f2' : 'f1');
      g.hline(cx - rx + 2, cy - rx + 2, rx, 'fL');
      break;
    }
    case 3: {
      let cx = x + at(7, 18) + 4;
      let cy = y + 4;
      for (let i = 0; i < 7; i++) {
        g.rect(cx, cy, 1, 3, 'fDD');
        g.set(cx + 1, cy + 1, 'fL');
        cx += s(30 + i) < 0.5 ? -1 : 1;
        cy += 3;
      }
      break;
    }
    case 4:
      for (let i = 0; i < 3; i++) {
        const px = x + at(40 + i, 26);
        const py = y + at(50 + i, 26);
        g.rect(px, py + 1, 3, 2, 'fD').hline(px, py, 2, 'fL');
      }
      break;
    default:
      themeAccent(g, theme, x, y, s);
  }
}

function themeAccent(g: Grid, theme: ArtTheme, x: number, y: number, s: (k: number) => number): void {
  const ox = x + 6 + Math.floor(s(60) * 16);
  const oy = y + 8 + Math.floor(s(61) * 14);
  switch (theme) {
    case 'crypt':
      // Moss in a joint and a chipped corner.
      g.rect(ox, oy, 3, 1, 'moss').set(ox + 1, oy - 1, 'mossL').set(ox + 4, oy + 1, 'moss');
      g.rect(x + 1, y + 1, 3, 2, 'fD');
      break;
    case 'forest':
      // Grass blades and a fallen leaf.
      for (let i = 0; i < 4; i++) g.vline(ox + i * 2, oy + (i % 2), 3 - (i % 2), i % 2 ? 'leafL' : 'leaf');
      g.rect(ox + 10, oy + 6, 2, 1, 'barkL');
      break;
    case 'caves':
      // A wet sheen.
      g.ellipse(ox + 4, oy + 4, 6, 2, 'wetD').hline(ox + 1, oy + 3, 4, 'foam');
      break;
    case 'swamp':
      // A mud blot with a slime fleck.
      g.ellipse(ox + 4, oy + 4, 6, 3, 'mud').hline(ox, oy + 2, 5, 'mudL').set(ox + 6, oy + 4, 'slime');
      break;
    case 'abyss':
      // An ember vein in the rock.
      g.line(ox, oy, ox + 9, oy + 5, 1, 'ember').set(ox + 4, oy + 2, 'emberL');
      break;
  }
}

/**
 * Shadow and banks on a floor tile from its neighbours: graded ambient
 * occlusion under a wall above and beside walls, water banks (Flooded
 * Caves), and on the abyss the eclipse's light on the rims of the island.
 */
export function drawFloorEdges(g: Grid, theme: ArtTheme, grid: TileGrid, tx: number, ty: number, water?: readonly number[]): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const wall = (dx: number, dy: number) => isWall(grid, tx + dx, ty + dy);
  if (theme === 'abyss') {
    if (wall(0, -1)) g.hline(x, y, TILE, 'lipL').hline(x, y + 1, TILE, 'lip');
    if (wall(-1, 0)) g.vline(x, y, TILE, 'lip');
    if (wall(1, 0)) g.vline(x + TILE - 1, y, TILE, 'lip');
    if (wall(0, 1)) g.rect(x, y + TILE - 3, TILE, 3, 'ao2');
    return;
  }
  if (wall(0, -1)) g.rect(x, y, TILE, 2, 'ao1').rect(x, y + 2, TILE, 2, 'ao2').rect(x, y + 4, TILE, 3, 'ao3');
  else if (wall(-1, -1)) g.rect(x, y, 4, 3, 'ao2');
  if (wall(-1, 0)) g.rect(x, y, 2, TILE, 'ao2').rect(x + 2, y, 2, TILE, 'ao3');
  if (wall(1, 0)) g.rect(x + TILE - 2, y, 2, TILE, 'ao3');
  if (water && water[ty * grid.cols + tx] !== 1) {
    const wet = (dx: number, dy: number) => !wall(dx, dy) && water[(ty + dy) * grid.cols + tx + dx] === 1;
    if (wet(0, -1)) g.rect(x, y, TILE, 2, 'wetD').hline(x, y + 2, TILE, 'foam');
    if (wet(0, 1)) g.rect(x, y + TILE - 2, TILE, 2, 'wetD').hline(x, y + TILE - 3, TILE, 'foam');
    if (wet(-1, 0)) g.rect(x, y, 2, TILE, 'wetD').vline(x + 2, y, TILE, 'foam');
    if (wet(1, 0)) g.rect(x + TILE - 2, y, 2, TILE, 'wetD').vline(x + TILE - 3, y, TILE, 'foam');
  }
}

/**
 * A wall tile's base: its top and, over floor, its front face with a lit lip,
 * a dark foot and corner pieces where the face ends. The abyss has no wall:
 * under a floor tile hangs the rock underside of the island, the rest is void.
 */
export function drawWallTile(g: Grid, theme: ArtTheme, grid: TileGrid, tx: number, ty: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const wall = (dx: number, dy: number) => isWall(grid, tx + dx, ty + dy);
  if (theme === 'abyss') {
    if (wall(0, -1)) return;
    // One rock slab under a run of floor: it tapers only where the run ends, its foot ragged.
    const runsLeft = wall(-1, 0) && !wall(-1, -1);
    const runsRight = wall(1, 0) && !wall(1, -1);
    const depth = 12 + Math.round(10 * H(tx, ty, 3));
    for (let k = 0; k < depth; k++) {
      const t = k / depth;
      const left = x + (runsLeft ? 0 : Math.round(t * t * 14));
      const right = x + TILE - (runsRight ? 0 : Math.round(t * t * 14));
      g.hline(left, y + k, right - left, k < 2 ? 'stoneL' : t < 0.45 ? 'stone' : 'ash');
    }
    for (let i = 0; i < 4; i++) {
      const fx = x + 2 + Math.floor(H(tx, ty, 10 + i) * 26);
      g.vline(fx, y + depth, 2 + Math.floor(H(tx, ty, 20 + i) * 5), 'ash');
    }
    g.hline(x, y + 5, TILE, 'ashL');
    g.set(x + 8 + Math.round(H(tx, ty, 4) * 14), y + depth - 1, 'ember');
    return;
  }
  const face = !wall(0, 1);
  g.rect(x, y, TILE, TILE, 'wt');
  if (face) {
    const fy = y + TILE - FACE;
    g.rect(x, fy, TILE, FACE, 'wf');
    facePattern(g, theme, x, fy, tx, ty);
    g.hline(x, fy, TILE, 'lipL').hline(x, fy + 1, TILE, 'lip');
    g.rect(x, y + TILE - 2, TILE, 2, 'wfD');
    // Corner pieces: the face turns away (inner corner, shade) or ends at open floor (outer corner, light).
    if (wall(-1, 0) && wall(-1, 1)) g.rect(x, fy, 2, FACE, 'wfD');
    else if (!wall(-1, 0)) g.vline(x, fy, FACE, 'wfL');
    if (wall(1, 0) && wall(1, 1)) g.rect(x + TILE - 2, fy, 2, FACE, 'wfD');
    else if (!wall(1, 0)) g.vline(x + TILE - 1, fy, FACE, 'wfD');
  }
  // The top's rims where it meets open floor.
  if (!wall(-1, 0)) g.vline(x, y, face ? TILE - FACE : TILE, 'lip');
  if (!wall(1, 0)) g.vline(x + TILE - 1, y, face ? TILE - FACE : TILE, 'lip');
  if (!wall(0, -1)) g.hline(x, y, TILE, 'lipL');
}

function facePattern(g: Grid, theme: ArtTheme, x: number, fy: number, tx: number, ty: number): void {
  const s = (k: number) => H(tx, ty, 400 + k);
  switch (theme) {
    case 'crypt': {
      // Two courses of bricks.
      g.hline(x, fy + 6, TILE, 'wfD');
      const shift = tx % 2 === 0 ? 0 : 8;
      for (let i = shift; i < TILE; i += 16) g.vline(x + i, fy + 2, 4, 'wfD');
      for (let i = 8 - shift + 8; i < TILE; i += 16) g.vline(x + i, fy + 7, 3, 'wfD');
      if (s(1) < 0.3) g.set(x + 4 + Math.floor(s(2) * 24), fy + 8, 'moss');
      break;
    }
    case 'forest':
      // Trunks and roots running down into the floor.
      g.hline(x, fy + 5, TILE, 'wfD');
      for (let i = 0; i < 2; i++) {
        const rx = x + 3 + Math.floor(s(i) * 26);
        g.line(rx, fy + 2, rx + (s(5 + i) < 0.5 ? -3 : 3), fy + FACE - 1, 2, 'bark').set(rx, fy + 3, 'barkL');
      }
      break;
    case 'caves':
      // Rock strata and a wet glint.
      g.hline(x, fy + 5, TILE, 'wfD').hline(x, fy + 6, TILE, 'wfL').hline(x + Math.floor(s(1) * 10), fy + 9, 14, 'wfD');
      if (s(2) < 0.4) g.set(x + 4 + Math.floor(s(3) * 24), fy + 4, 'crL');
      break;
    case 'swamp':
      // Mud bank with slime running down.
      g.hline(x, fy + 4, TILE, 'mudL');
      for (let i = 0; i < 2; i++) {
        const dx = x + 4 + Math.floor(s(i) * 24);
        g.vline(dx, fy + 2, 3 + Math.floor(s(5 + i) * 6), 'slimeD');
      }
      break;
    default:
      break;
  }
}

/**
 * Draws `draw` (a shape centred on its own origin) centred at (cx, cy). Painting a floor
 * passes one that paints each shape once into a small canvas and stamps it after
 * (`stamper`); without one the shape is drawn rect by rect.
 */
export type Stamp = (key: string, half: number, draw: (g: Grid, cx: number, cy: number) => void, cx: number, cy: number) => void;

const directStamp =
  (g: Grid): Stamp =>
  (_key, _half, draw, cx, cy) =>
    draw(g, cx, cy);

function crown(r: number, turn: number) {
  return (g: Grid, cx: number, cy: number) => {
    g.ellipse(cx + 1, cy + 2, r, r - 1, 'leafD');
    g.ellipse(cx, cy, r, r - 1, 'wb');
    g.ellipse(cx - 2, cy - 2, r - 4, r - 5, 'wbL');
    // Leaf clusters break the round edge.
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + turn;
      g.ellipse(cx + Math.cos(a) * (r - 2), cy + Math.sin(a) * (r - 3), 3, 2, k % 2 ? 'wb' : 'leafD');
    }
    g.set(cx - 4, cy - 4, 'leafL').set(cx + 1, cy - 5, 'leafL').set(cx - 6, cy - 1, 'leafL');
  };
}

const rock = (r: number) => (g: Grid, cx: number, cy: number) => {
  g.ellipse(cx + 1, cy + 1, r, r - 2, 'wbD');
  g.ellipse(cx, cy, r - 1, r - 3, 'wb');
  g.hline(cx - r + 4, cy - r + 4, r, 'wbL');
};

const mound = (r: number) => (g: Grid, cx: number, cy: number) => {
  g.ellipse(cx, cy, r, r - 3, 'wb');
  g.hline(cx - r + 3, cy - r + 4, r, 'wbL');
};

/** The Crypt's cut stone over a wall top `bottom` px tall, its courses staggered by `odd`. */
const bricks = (bottom: number, odd: number) => (g: Grid, cx: number, cy: number) => {
  const x = cx - TILE / 2;
  const y = cy - TILE / 2;
  for (let row = 0; row * 8 < bottom; row++) {
    const shift = (odd + row) % 2 === 0 ? 0 : 6;
    for (let bx = -shift; bx < TILE; bx += 12) {
      const l = Math.max(0, bx + 1);
      const w = Math.min(TILE, bx + 11) - l;
      const top = y + row * 8 + 1;
      const hgt = Math.min(6, bottom - row * 8 - 2);
      if (w <= 0 || hgt <= 0) continue;
      g.rect(x + l, top, w, hgt, 'wb').hline(x + l, top, w, 'wbL').hline(x + l, top + hgt - 1, w, 'wbD');
    }
  }
};

/**
 * A wall tile's top as terrain, drawn after every base so it can overhang its
 * open sides by a pixel or two (the irregular edge): cut stone with cracks and
 * moss, round tree crowns, wet rock, mud mounds with roots.
 */
export function drawWallTop(g: Grid, theme: ArtTheme, grid: TileGrid, tx: number, ty: number, stamp: Stamp = directStamp(g)): void {
  if (theme === 'abyss') return;
  const x = tx * TILE;
  const y = ty * TILE;
  const face = !isWall(grid, tx, ty + 1);
  const bottom = face ? TILE - FACE : TILE;
  const s = (k: number) => H(tx, ty, 500 + k);
  const open = { l: !isWall(grid, tx - 1, ty), r: !isWall(grid, tx + 1, ty), u: !isWall(grid, tx, ty - 1) };
  // Lumps stay inside the tile on wall sides and overhang open sides by up to 2 px.
  const clampX = (cx: number, r: number) => Math.max(x + r - (open.l ? 2 : 0), Math.min(x + TILE - r + (open.r ? 2 : 0), cx));
  const clampY = (cy: number, r: number) => Math.max(y + r - (open.u ? 2 : 0), Math.min(y + bottom - r + 1, cy));
  switch (theme) {
    case 'crypt': {
      stamp(`bricks${bottom}|${ty % 2}`, TILE / 2, bricks(bottom, ty % 2), x + TILE / 2, y + TILE / 2);
      if (s(1) < 0.35) g.line(x + 6 + s(2) * 18, y + 3, x + 10 + s(3) * 14, y + bottom - 4, 1, 'wt');
      if (s(4) < 0.4) g.rect(x + Math.floor(s(5) * 26), y + bottom - 3, 4, 2, 'moss').set(x + Math.floor(s(5) * 26) + 1, y + bottom - 4, 'mossL');
      break;
    }
    case 'forest': {
      const n = bottom > 24 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const r = 10 + Math.floor(s(10 + i) * 4);
        const cx = clampX(x + 6 + Math.floor(s(i) * 20), r);
        const cy = clampY(y + 6 + Math.floor(s(5 + i) * (bottom - 8)), r - 1);
        const turn = Math.floor(s(40 + i) * 4);
        stamp(`crown${r}|${turn}`, r + 4, crown(r, turn * 0.4), cx, cy);
      }
      break;
    }
    case 'caves': {
      for (let i = 0; i < 2; i++) {
        const r = 8 + Math.floor(s(10 + i) * 4);
        const cx = clampX(x + 8 + Math.floor(s(i) * 16), r);
        const cy = clampY(y + 7 + Math.floor(s(5 + i) * (bottom - 10)), r - 2);
        stamp(`rock${r}`, r + 2, rock(r), cx, cy);
        if (s(20 + i) < 0.5) g.set(cx - 2, cy - r + 5, 'crL');
      }
      break;
    }
    case 'swamp': {
      for (let i = 0; i < 2; i++) {
        const r = 8 + Math.floor(s(10 + i) * 4);
        const cx = clampX(x + 8 + Math.floor(s(i) * 16), r);
        const cy = clampY(y + 7 + Math.floor(s(5 + i) * (bottom - 10)), r - 3);
        stamp(`mound${r}`, r + 2, mound(r), cx, cy);
        g.set(cx - 2, cy - 1, 'slime').set(cx + 3, cy + 1, 'leafL');
      }
      if (s(30) < 0.5) g.line(x + 4, y + bottom - 6, x + 14 + s(31) * 12, y + bottom - 2, 1, 'bark');
      break;
    }
  }
}

/** A stamp that paints each shape once into its own small canvas (per palette) and blits it. */
function stamper(ctx: CanvasRenderingContext2D, pal: Palette): Stamp {
  const cache = new Map<string, HTMLCanvasElement>();
  return (key, half, draw, cx, cy) => {
    let canvas = cache.get(key);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = canvas.height = half * 2 + 1;
      draw(new Grid(painter(canvas.getContext('2d')!), pal), half, half);
      cache.set(key, canvas);
    }
    ctx.drawImage(canvas, Math.round(cx) - half, Math.round(cy) - half);
  };
}

/** A prop on a floor tile at (x, y) world px: low-contrast pixel art with a contact shadow. */
export function drawProp(g: Grid, theme: ArtTheme, kind: PropKind, x: number, y: number, look: number): void {
  const cx = x + 10 + Math.floor(look * 12);
  const cy = y + 14 + Math.floor(((look * 7) % 1) * 8);
  const flip = look < 0.5 ? 1 : -1;
  switch (kind) {
    case 'bones':
      g.ellipse(cx, cy + 3, 7, 2, 'sh');
      g.line(cx - 6, cy + 2, cx + 5, cy - 1, 2, 'bone').set(cx - 6, cy + 1, 'bone').set(cx + 5, cy - 2, 'bone');
      g.rect(cx - 2, cy - 4, 5, 4, 'bone').set(cx - 1, cy - 3, 'boneD').set(cx + 1, cy - 3, 'boneD').hline(cx - 1, cy, 3, 'boneD');
      break;
    case 'rubble':
      g.ellipse(cx, cy + 3, 8, 2, 'sh');
      g.rect(cx - 6, cy - 2, 6, 5, 'wb').hline(cx - 6, cy - 2, 6, 'wbL');
      g.rect(cx + 1, cy, 4, 3, 'wb').hline(cx + 1, cy, 4, 'wbL');
      g.rect(cx - 2, cy + 3, 3, 2, 'fD');
      break;
    case 'urn':
      g.ellipse(cx, cy + 5, 6, 2, 'sh');
      g.rect(cx - 4, cy - 4, 8, 9, 'urn').vline(cx - 3, cy - 3, 6, 'urnL').hline(cx - 2, cy - 6, 4, 'urn').hline(cx - 3, cy - 5, 6, 'urnL');
      g.set(cx + 2, cy - 1, 'fDD').set(cx + 3, cy, 'fDD');
      break;
    case 'web': {
      // Cobweb threads radiating from the nearest corner of the tile.
      const ox = flip > 0 ? x + 1 : x + TILE - 2;
      for (let i = 0; i < 4; i++) g.line(ox, y + 1, ox + flip * (12 - i * 3), y + 1 + i * 4, 1, 'web');
      g.line(ox + flip * 4, y + 2, ox + flip * 2, y + 6, 1, 'web').line(ox + flip * 8, y + 3, ox + flip * 5, y + 10, 1, 'web');
      break;
    }
    case 'tuft':
      for (let i = -3; i <= 3; i++) g.vline(cx + i * 1, cy - 4 + Math.abs(i), 5 - Math.abs(i), i % 2 === 0 ? 'leaf' : 'leafL');
      g.hline(cx - 4, cy + 1, 9, 'leafD');
      break;
    case 'fern':
      g.ellipse(cx, cy + 3, 7, 2, 'sh');
      for (let i = 0; i < 4; i++) {
        g.line(cx, cy + 2, cx - 6 + i * 4, cy - 5 + (i % 3), 1, i % 2 ? 'leafL' : 'leaf');
      }
      g.vline(cx, cy - 6, 8, 'leafD');
      break;
    case 'flowers':
      for (let i = 0; i < 3; i++) {
        const fx = cx - 5 + i * 5;
        const fy = cy - 1 + (i % 2) * 3;
        g.vline(fx, fy, 3, 'leaf');
        g.set(fx - 1, fy - 1, i === 1 ? 'petal2' : 'petal').set(fx + 1, fy - 1, i === 1 ? 'petal2' : 'petal').set(fx, fy - 2, i === 1 ? 'petal2' : 'petal');
      }
      break;
    case 'mossStone':
      g.ellipse(cx, cy + 3, 7, 2, 'sh');
      g.ellipse(cx, cy, 6, 4, 'stone').hline(cx - 3, cy - 3, 5, 'stoneL');
      g.rect(cx - 5, cy - 2, 5, 2, 'leaf').set(cx - 3, cy - 3, 'leafL');
      break;
    case 'log':
      g.ellipse(cx, cy + 3, 10, 2, 'sh');
      g.rect(cx - 9, cy - 2, 18, 5, 'bark').hline(cx - 9, cy - 2, 18, 'barkL');
      g.ellipse(cx + 9 * flip, cy, 2, 2, 'barkL').set(cx + 9 * flip, cy, 'bark');
      g.set(cx - 2, cy - 3, 'leaf').set(cx, cy - 3, 'leafL');
      break;
    case 'pebbles':
      for (let i = 0; i < 4; i++) {
        const px = cx - 6 + i * 4;
        const py = cy + ((i * 3) % 5) - 2;
        g.rect(px, py, 3, 2, 'stone').set(px, py, 'stoneL');
      }
      break;
    case 'shard':
      g.ellipse(cx, cy + 4, 5, 2, 'sh');
      g.rect(cx - 1, cy - 6, 3, 10, 'cr').vline(cx - 1, cy - 6, 9, 'crL').vline(cx + 1, cy - 4, 8, 'crD');
      g.rect(cx + 3 * flip, cy - 1, 2, 5, 'cr').set(cx + 3 * flip, cy - 1, 'crL');
      break;
    case 'stalagmite':
      g.ellipse(cx, cy + 4, 6, 2, 'sh');
      for (let k = 0; k < 9; k++) g.hline(cx - Math.floor(k / 2), cy - 5 + k, 1 + Math.floor(k / 2) * 2, k < 2 ? 'stoneL' : 'stone');
      g.vline(cx - 1, cy - 2, 5, 'stoneL');
      break;
    case 'glowMoss':
      g.ellipse(cx, cy, 6, 2, 'glowD');
      for (let i = 0; i < 4; i++) g.set(cx - 4 + i * 3, cy - 1 + (i % 2), 'glow');
      break;
    case 'puddle':
      g.ellipse(cx, cy, 8, 3, 'mud').hline(cx - 5, cy - 2, 6, 'mudL').set(cx + 3, cy, 'slime');
      break;
    case 'skull':
      g.ellipse(cx, cy + 3, 5, 2, 'sh');
      g.rect(cx - 3, cy - 3, 6, 5, 'bone').set(cx - 2, cy - 1, 'boneD').set(cx + 1, cy - 1, 'boneD').hline(cx - 2, cy + 2, 4, 'boneD');
      g.set(cx - 3, cy - 3, 'slime');
      break;
    case 'toadstool':
      g.ellipse(cx, cy + 3, 6, 2, 'sh');
      g.rect(cx - 1, cy - 1, 2, 4, 'bone');
      g.ellipse(cx, cy - 2, 4, 2, 'cap').hline(cx - 2, cy - 3, 3, 'capL');
      g.rect(cx + 4 * flip, cy + 1, 1, 2, 'bone').set(cx + 4 * flip, cy, 'cap');
      break;
    case 'stump':
      g.ellipse(cx, cy + 4, 7, 2, 'sh');
      g.rect(cx - 4, cy - 3, 8, 7, 'bark').vline(cx - 4, cy - 3, 7, 'barkL');
      g.ellipse(cx, cy - 3, 4, 1, 'barkL').set(cx, cy - 3, 'bark');
      g.set(cx + 4, cy + 3, 'bark').set(cx - 5, cy + 3, 'bark').set(cx + 1, cy - 1, 'slimeD');
      break;
    case 'splinters':
      g.ellipse(cx, cy + 3, 7, 2, 'sh');
      g.rect(cx - 5, cy - 1, 4, 3, 'stone').hline(cx - 5, cy - 1, 4, 'stoneL');
      g.rect(cx + 1, cy - 3, 3, 5, 'stone').set(cx + 1, cy - 3, 'stoneL');
      g.set(cx - 1, cy + 2, 'ember');
      break;
    case 'redShard':
      g.ellipse(cx, cy + 4, 5, 2, 'sh');
      g.rect(cx - 1, cy - 5, 2, 9, 'ember').vline(cx - 1, cy - 5, 7, 'emberL');
      g.rect(cx + 2 * flip, cy - 1, 2, 5, 'ember');
      break;
    case 'ash':
      g.ellipse(cx, cy, 8, 3, 'ash').hline(cx - 4, cy - 2, 6, 'ashL').set(cx + 2, cy, 'ember');
      break;
  }
}

/** Floor tone (0..1) at a world point: smooth value noise over cells of three tiles, so tones drift in blotches. */
export function toneAt(wx: number, wy: number, signature: number): number {
  const cell = 3 * TILE;
  const gx = Math.floor(wx / cell);
  const gy = Math.floor(wy / cell);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const fx = smooth(wx / cell - gx);
  const fy = smooth(wy / cell - gy);
  const c = (x: number, y: number) => H(x, y, 600 + signature);
  const top = c(gx, gy) * (1 - fx) + c(gx + 1, gy) * fx;
  const bot = c(gx, gy + 1) * (1 - fx) + c(gx + 1, gy + 1) * fx;
  return top * (1 - fy) + bot * fy;
}

/**
 * The context as the grid sees it, setting the fill colour only when it
 * changes: a floor is tens of thousands of small rects in a few colours, and
 * parsing the colour on every one costs more than the rects themselves.
 */
function painter(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
  let last = '';
  return {
    set fillStyle(color: string) {
      if (color !== last) ctx.fillStyle = last = color;
    },
    fillRect: (x: number, y: number, w: number, h: number) => ctx.fillRect(x, y, w, h),
  } as unknown as CanvasRenderingContext2D;
}

/** A pixel grid over `ctx` with a dungeon's art palette: the dev art gallery (tools/dungeon-art-gallery.html) draws single tiles and props with it. */
export function artGrid(ctx: CanvasRenderingContext2D, palette: TilePalette, theme: ArtTheme): Grid {
  return new Grid(painter(ctx), artPalette(palette, theme));
}

/** Paints a whole generated floor into `ctx` (world px at 1:1): tiles, edges, wall tops, banks, props. */
export function paintFloor(ctx: CanvasRenderingContext2D, floor: ArtFloor, palette: TilePalette, theme: ArtTheme): void {
  const pal = artPalette(palette, theme);
  const g = new Grid(painter(ctx), pal);
  const stamp = stamper(ctx, pal);
  const sig = floorSignature(floor);
  const tone = (wx: number, wy: number) => toneAt(wx, wy, sig);
  for (let ty = 0; ty < floor.rows; ty++) {
    for (let tx = 0; tx < floor.cols; tx++) {
      if (isWall(floor, tx, ty)) drawWallTile(g, theme, floor, tx, ty);
      else drawFloorTile(g, theme, floorVariant(tx, ty, sig), tx * TILE, ty * TILE, tone, H(tx, ty, 700 + sig));
    }
  }
  for (let ty = 0; ty < floor.rows; ty++) for (let tx = 0; tx < floor.cols; tx++) if (!isWall(floor, tx, ty)) drawFloorEdges(g, theme, floor, tx, ty, floor.water);
  // Sludge banks under the toxic pools (the pools bubble over them per frame).
  for (const pool of floor.pools ?? []) {
    g.ellipse(pool.x, pool.y + 2, pool.radius + 7, pool.radius * 0.75 + 6, 'mud');
    g.ellipse(pool.x, pool.y + 1, pool.radius + 4, pool.radius * 0.75 + 3, 'mudL');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + H(Math.round(pool.x), Math.round(pool.y), i);
      g.set(pool.x + Math.cos(a) * (pool.radius + 6), pool.y + Math.sin(a) * (pool.radius * 0.75 + 5), i % 2 ? 'slime' : 'slimeD');
    }
  }
  for (let ty = 0; ty < floor.rows; ty++) for (let tx = 0; tx < floor.cols; tx++) if (isWall(floor, tx, ty)) drawWallTop(g, theme, floor, tx, ty, stamp);
  for (const p of floorProps(floor, theme)) drawProp(g, theme, p.kind, p.x * TILE, p.y * TILE, p.look);
}

/** Paints a fixed arena's floor (no walls, no props: the boss fights stay clear), with a shadow under its top edge. */
export function paintArena(ctx: CanvasRenderingContext2D, width: number, height: number, palette: TilePalette, theme: ArtTheme): void {
  const g = new Grid(painter(ctx), artPalette(palette, theme, true));
  const sig = 7919 + width * 3 + height;
  const tone = (wx: number, wy: number) => toneAt(wx, wy, sig);
  const cols = Math.ceil(width / TILE);
  const rows = Math.ceil(height / TILE);
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      // Fixed arenas keep the quieter variants: no accents that could read as a hazard.
      const v = floorVariant(tx, ty, sig);
      drawFloorTile(g, theme === 'abyss' ? 'abyss' : theme, v === 5 || v === 3 ? 0 : v, tx * TILE, ty * TILE, tone, H(tx, ty, 700 + sig));
    }
  }
  g.rect(0, 0, width, 2, 'ao1').rect(0, 2, width, 2, 'ao2').rect(0, 4, width, 3, 'ao3');
}

const layers = new WeakMap<TileGrid, { key: string; canvas: HTMLCanvasElement }>();

/** A generated floor's layer, painted on first use and kept with its grid (one per floor); `floor` is read only then. */
export function floorLayer(grid: TileGrid, floor: () => ArtFloor, palette: TilePalette, theme: ArtTheme): HTMLCanvasElement {
  const key = `${theme}|${palette.tileFloorA}|${palette.tileWallTop}|${palette.tileWallFace}`;
  const cached = layers.get(grid);
  if (cached && cached.key === key) return cached.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = grid.cols * TILE;
  canvas.height = grid.rows * TILE;
  paintFloor(canvas.getContext('2d')!, floor(), palette, theme);
  layers.set(grid, { key, canvas });
  return canvas;
}

const arenas = new Map<string, HTMLCanvasElement>();

/** A fixed arena's floor layer, painted once per size, palette and theme. */
export function arenaLayer(width: number, height: number, palette: TilePalette, theme: ArtTheme): HTMLCanvasElement {
  const key = `${width}x${height}|${theme}|${palette.floorA}|${palette.floorB}`;
  let canvas = arenas.get(key);
  if (canvas) return canvas;
  if (arenas.size > 6) arenas.clear();
  canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  paintArena(canvas.getContext('2d')!, width, height, palette, theme);
  arenas.set(key, canvas);
  return canvas;
}
