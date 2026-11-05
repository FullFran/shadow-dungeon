import { Grid, seeded, type Palette } from './pixel-grid';

/**
 * The partner's altar on the title hub (owner, 2026-11-04: "presenta mejor a tu pokemon"; .agents/DESIGN.md §4
 * "Partner altar"): three stepped drums of carved eclipse-stone seen from slightly above, drawn once on a cell grid
 * with palette keys (pixel-craft skill). The eclipse stands behind and above, so the back rim of every top face
 * catches its red; the embers burning under the altar warm the lowest course from below. Joints, runes and a
 * glowing crack are carved into the fronts, a gilt line runs along each lip. Nothing here moves: the breathing
 * glow, the corona and the embers are CSS layers around this canvas.
 */
export const ALTAR_W = 128;
export const ALTAR_H = 54;

/** Where the partner stands: the centre of the top face, as fractions of the canvas. */
export const ALTAR_STAND = { x: 0.5, y: 22 / ALTAR_H } as const;

export const ALTAR_PAL: Palette = {
  ink: '#0a0709',
  st: '#2b2429', stL: '#3b3238', stD: '#1a1519', // eclipse stone: lit, mid, shade
  top: '#352c32', topL: '#463b42', topD: '#1c1619', // top faces
  rim: '#c63a3c', rimL: '#ff6a3d', // eclipse light on the back lip
  gold: '#c9a45a', goldL: '#f0d58a', goldD: '#5c4526', // gilt trim
  warm: '#5a2e22', warmL: '#8a4426', // lowest course, lit by embers from below
  rune: '#8f3a22', runeL: '#ffbf5e', // carved runes, lit by the ember
  crack: '#ff8a3d', crackL: '#ffd27a',
};

interface Tier {
  rx: number;
  ry: number;
  /** y of the centre of the top face. */
  y: number;
  /** Height of the drum in cells. */
  h: number;
}

const TIERS: readonly Tier[] = [
  { rx: 62, ry: 8, y: 38, h: 7 },
  { rx: 49, ry: 6.5, y: 30, h: 6 },
  { rx: 35, ry: 5, y: 22, h: 5 },
];

/** The cells of an ellipse outline (one per column on the chosen half). */
function arc(g: Grid, cx: number, cy: number, rx: number, ry: number, half: 'back' | 'front', key: string): void {
  for (let x = -Math.round(rx); x <= Math.round(rx); x++) {
    const t = Math.sqrt(Math.max(0, 1 - (x * x) / (rx * rx)));
    const dy = Math.round(ry * t) * (half === 'back' ? -1 : 1);
    g.set(cx + x, cy + dy, key);
  }
}

/** The 3x5 carved glyphs: a few simple, uneven runes, never letters. */
const RUNES: readonly (readonly string[])[] = [
  ['.#.', '###', '.#.', '.#.', '.#.'],
  ['#.#', '#.#', '###', '.#.', '.#.'],
  ['###', '..#', '.#.', '#..', '###'],
  ['#..', '##.', '.##', '..#', '.#.'],
];

function drawTier(g: Grid, t: Tier, index: number, cx: number): void {
  // Outline first: the silhouette of the whole drum, one cell bigger.
  for (let d = 0; d <= t.h; d++) g.ellipse(cx, t.y + d, t.rx + 1, t.ry + 1, 'ink');
  g.ellipse(cx, t.y - 1, t.rx + 1, t.ry + 1, 'ink');
  // The drum: stacked ellipses, shaded down the front; the lowest course is warmed by the embers below.
  for (let d = t.h; d >= 0; d--) {
    const key = index === 0 && d >= t.h - 1 ? 'warmL' : index === 0 && d >= t.h - 3 ? 'warm' : d <= 1 ? 'stL' : d >= t.h - 1 ? 'stD' : 'st';
    g.ellipse(cx, t.y + d, t.rx, t.ry, key);
  }
  // Joints between the carved blocks, spaced by angle so they curve round the drum.
  const joints = Math.max(5, Math.round(t.rx / 6));
  for (let k = -joints; k <= joints; k++) {
    const a = (k / (joints + 0.5)) * (Math.PI / 2);
    const x = cx + Math.round(t.rx * Math.sin(a) * 0.98);
    const top = t.y + Math.round(t.ry * Math.cos(a)) + 1;
    g.vline(x, top, t.h - 1, 'stD');
    if (k < 0) g.vline(x - 1, top + 1, 1, 'stL');
  }
  // The top face and its inset.
  g.ellipse(cx, t.y, t.rx, t.ry, 'top');
  g.ellipse(cx, t.y + 1, t.rx - 3, Math.max(1, t.ry - 1.8), index === TIERS.length - 1 ? 'topD' : 'top');
  if (index < TIERS.length - 1) g.ellipse(cx, t.y, t.rx - 2, t.ry - 1, 'top');
  // Gilt lip along the front edge, eclipse red along the back edge.
  arc(g, cx, t.y, t.rx, t.ry, 'front', 'goldL');
  arc(g, cx, t.y + 1, t.rx, t.ry, 'front', 'gold');
  arc(g, cx, t.y + 2, t.rx, t.ry, 'front', 'goldD');
  arc(g, cx, t.y, t.rx, t.ry, 'back', 'rimL');
  arc(g, cx, t.y + 1, t.rx - 1, t.ry, 'back', 'rim');
}

/** Paints the altar into a fresh canvas (prerendered; the caller scales it by a whole number). */
export function buildAltar(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ALTAR_W;
  canvas.height = ALTAR_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const g = new Grid(ctx, ALTAR_PAL);
  const rand = seeded(1104);
  const cx = ALTAR_W / 2;
  TIERS.forEach((t, i) => drawTier(g, t, i, cx));

  // Runes round the middle drum, each one a little offset like hand-cut work.
  const mid = TIERS[1]!;
  [-33, -22, -11, 11, 22, 33].forEach((dx, i) => {
    const rune = RUNES[i % RUNES.length]!;
    const x = cx + dx - 1;
    const y = mid.y + Math.round(mid.ry * Math.sqrt(1 - (dx * dx) / (mid.rx * mid.rx))) + 2 + (i % 2);
    rune.forEach((row, ry) => [...row].forEach((c, rx) => c === '#' && g.set(x + rx, y + ry, ry === 0 ? 'runeL' : 'rune')));
  });

  // A glowing crack down the front of the lowest drum, with a few ember flecks along it.
  const low = TIERS[0]!;
  let x = cx - 16;
  let y = low.y + Math.round(low.ry * 0.95) + 2;
  for (let k = 0; k < 7; k++) {
    g.set(x, y, k % 2 ? 'crackL' : 'crack');
    x += rand() > 0.5 ? 1 : -1;
    y += 1;
    g.set(x, y, 'crack');
  }
  // The top face carries a faint rune ring round the partner's feet.
  const top = TIERS[2]!;
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    if (a % 2 === 0) g.set(cx + Math.round(Math.cos(t) * (top.rx - 7)), top.y + Math.round(Math.sin(t) * (top.ry - 1.6)), 'rune');
  }
  return canvas;
}
