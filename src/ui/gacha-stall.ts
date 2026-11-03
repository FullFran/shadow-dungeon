import { Grid, seeded, type Light, type Palette } from './pixel-grid';

/**
 * Mimikyu's stall for the gacha page (odd/tasks/gacha-page.md; .claude/skills/pixel-craft), an
 * original drawing in the town's grim style: a tattered cloth awning, a lantern, jars and
 * loose capsules on a worn counter, under the dead sun of the Eclipse. Drawn ONCE on a
 * 320x200 buffer; the page scales it by whole quarter steps (`cameraFor`) behind the
 * controls. Mimikyu is its real animated sheet sprite standing on the counter top (the
 * page places it at `STALL.stand`); the only things that move are CSS lights (the lantern's
 * flicker) and fog, so no per-frame canvas work is added.
 */
export const STALL = {
  w: 320,
  h: 200,
  /** The counter: the plank Mimikyu stands on. */
  counter: { x0: 40, x1: 198, top: 117 },
  /** Mimikyu's feet point (the sprite anchor lands here). */
  stand: { x: 102, y: 118 },
  /** What every target viewport shows whole (the camera covers the screen and crops the rest). */
  safe: { x0: 30, x1: 290, y0: 34, y1: 150 },
  lantern: { x: 60, y: 80, r: 54 },
} as const;

/**
 * Where the scene sits in a viewport of `vw` x `vh` CSS px: scale (css px per buffer px, quarter steps) and the offset that
 * centres it across; down, a wide screen crops more of the floor than of the awning (the stall hangs from its top).
 */
export function cameraFor(vw: number, vh: number): { scale: number; x: number; y: number } {
  const scale = Math.ceil(Math.max(vw / STALL.w, vh / STALL.h) * 4) / 4;
  return { scale, x: Math.round((vw - STALL.w * scale) / 2) || 0, y: Math.round((vh - STALL.h * scale) * 0.4) || 0 };
}

/** The lights the lantern and a candle give off, as fractions the page turns into CSS glows. */
export const STALL_LIGHTS: readonly Light[] = [
  { x: STALL.lantern.x, y: STALL.lantern.y, r: STALL.lantern.r, color: '#ffae4a', op: 0.5, flicker: 0.5 },
  { x: 24, y: 104, r: 26, color: '#ff9a4a', op: 0.32, flicker: 0.7 },
];

const PAL: Palette = {
  ink: '#050407',
  s0: '#0a0710', s1: '#150b14', s2: '#26101a', s3: '#3a1519',
  corona: '#e8283a', coronaD: '#8f2219', coronaL: '#ff6a3d', sun: '#030204',
  wall: '#17121a', wallL: '#241b27', wallD: '#0c0910', brick: '#2e222d',
  cob: '#1f171c', cobL: '#30252c', cobD: '#110b0f',
  wd: '#2e1c12', wdL: '#4a2f1c', wdH: '#6b4528', wdD: '#170d08',
  cl: '#6b1520', clL: '#8f2230', clD: '#390a10',
  ash: '#b3a690', ashD: '#7d725f', ashL: '#d8cdb6',
  gold: '#c9a45a', goldL: '#ffd98a', goldD: '#7a5f2c',
  lamp: '#ffbf5e', lampH: '#fff1c2',
  gl: '#2c4048', glH: '#8fb4c0',
  capR: '#c22a37', capRL: '#ff6b5e', capRD: '#7a1220',
  capV: '#7a4fe0', capVL: '#c9b0ff', capVD: '#43268f',
  capT: '#3c9db4', capTL: '#9be3f2', capTD: '#1d5565',
  capG: '#d9a93e', capGL: '#ffe08a', capGD: '#855f14',
  capB: '#3d2a4a', capBL: '#6a4a78', band: '#e2b866',
  pud: '#46101a', pudL: '#8a1e26',
  rim: '#ff5a3d', rimD: '#8f2219',
  shade: '#0b0608',
};

type CapColor = 'R' | 'V' | 'T' | 'G';

/**
 * An upright capsule (a pill, not a ball): a coloured lid over a dusk-violet body, a gold band between, an ink
 * outline and a highlight top-left. `r` is the half width; the pill is r * 2 + 5 tall.
 */
function capsule(g: Grid, cx: number, cy: number, r: number, color: CapColor): void {
  const reach = (dy: number, grow: number): number => {
    const d = dy < -2 ? dy + 2 : dy > 2 ? dy - 2 : 0;
    const radius = r + grow;
    return d * d > radius * radius ? -1 : Math.round(radius * Math.sqrt(1 - (d * d) / (radius * radius + 1)));
  };
  const shape = (grow: number, key: (dy: number) => string): void => {
    for (let dy = -(r + 2 + grow); dy <= r + 2 + grow; dy++) {
      const half = reach(dy, grow);
      if (half >= 0) g.rect(cx - half, cy + dy, half * 2 + 1, 1, key(dy));
    }
  };
  shape(1, () => 'ink');
  shape(0, (dy) => (dy < 0 ? `cap${color}` : 'capB'));
  g.hline(cx - r, cy, r * 2 + 1, 'band');
  // Light on the lid's upper left, a shaded edge on the body's lower right.
  g.set(cx - r + 1, cy - r - 1, `cap${color}L`);
  g.set(cx - r + 1, cy - r, `cap${color}L`);
  g.set(cx - r + 1, cy + 2, 'capBL');
  g.set(cx + r - 1, cy + r + 1, 'ink');
}

/** Dithered vertical blend between two keys over [y0, y1) (a checker on the 2 px band edges). */
function bands(g: Grid, w: number, y0: number, y1: number, keys: readonly string[]): void {
  const h = (y1 - y0) / keys.length;
  keys.forEach((key, i) => {
    const top = Math.round(y0 + i * h);
    const bottom = Math.round(y0 + (i + 1) * h);
    g.rect(0, top, w, bottom - top, key);
    const next = keys[i + 1];
    if (next) for (let x = 0; x < w; x++) if ((x + bottom) % 2 === 0) g.set(x, bottom, next);
  });
}

function sky(g: Grid): void {
  bands(g, STALL.w, 0, 120, ['s0', 's1', 's2', 's3']);
  // The dead sun: a black disc ringed with the eclipse's corona, a few rays.
  const cx = 214;
  const cy = 50;
  g.ellipse(cx, cy, 27, 27, 'coronaD');
  g.ellipse(cx, cy, 24, 24, 'corona');
  g.ellipse(cx, cy, 21, 21, 'sun');
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    const len = a % 2 === 0 ? 12 : 6;
    g.line(cx + Math.cos(t) * 28, cy + Math.sin(t) * 28, cx + Math.cos(t) * (28 + len), cy + Math.sin(t) * (28 + len), 1, a % 4 === 0 ? 'coronaL' : 'coronaD');
  }
  const r = seeded(7);
  for (let i = 0; i < 40; i++) g.set(Math.floor(r() * STALL.w), Math.floor(r() * 70), r() > 0.5 ? 'ashD' : 'wallL');
}

/** Ruined houses behind the stall: crooked gables, boarded windows, one candle. */
function houses(g: Grid): void {
  // Left house: tall, roof half fallen.
  g.rect(0, 84, 64, 60, 'wall');
  g.rect(0, 84, 64, 2, 'wallL');
  for (let y = 88; y < 140; y += 6) for (let x = (y / 6) % 2 === 0 ? 2 : 8; x < 62; x += 12) g.rect(x, y, 10, 1, 'wallD');
  for (let i = 0; i < 6; i++) g.rect(i * 11, 78 + Math.round(Math.sin(i * 1.9) * 3), 11, 8, 'wallD');
  g.rect(8, 70, 44, 8, 'wd');
  g.line(4, 78, 28, 60, 2, 'wdD');
  g.line(28, 60, 54, 76, 2, 'wdD');
  g.rect(12, 100, 20, 28, 'wallD');
  g.rect(13, 101, 18, 26, 'ink');
  g.rect(12, 108, 20, 3, 'wd');
  g.rect(12, 119, 20, 3, 'wd');
  g.vline(21, 101, 26, 'wdL');
  // The lit window, candle inside.
  g.rect(40, 98, 12, 16, 'wallD');
  g.rect(41, 99, 10, 14, 'lampH');
  g.rect(41, 99, 10, 14, 'lamp');
  g.rect(42, 103, 4, 9, 'goldD');
  g.rect(40, 105, 12, 2, 'wd');
  g.set(46, 100, 'lampH');
  // Right house: only a gable and a chimney above the pillar.
  g.rect(236, 92, 84, 52, 'wall');
  g.rect(236, 92, 84, 2, 'wallL');
  g.line(236, 92, 276, 62, 3, 'wallD');
  g.line(276, 62, 320, 90, 3, 'wallD');
  g.rect(268, 70, 8, 22, 'wd');
  g.rect(296, 54, 7, 22, 'wallD');
  g.rect(260, 106, 14, 20, 'ink');
  g.rect(260, 112, 14, 3, 'wd');
  // Rim light on the faces towards the sun.
  g.vline(236, 94, 50, 'rimD');
  g.line(236, 92, 276, 62, 1, 'rimD');
}

function ground(g: Grid): void {
  g.rect(0, 144, STALL.w, 56, 'cob');
  const r = seeded(31);
  for (let row = 0; row < 8; row++) {
    const y = 146 + row * 8 + Math.floor(row * row * 0.3);
    const h = 7 + Math.floor(row / 2);
    let x = -((row * 9) % 17);
    while (x < STALL.w) {
      const w = 13 + Math.floor(r() * 12) + row;
      g.rect(x, y, w - 1, h - 1, r() > 0.78 ? 'cobD' : 'cob');
      g.hline(x, y, w - 1, 'cobL');
      g.hline(x, y + h - 1, w, 'cobD');
      g.vline(x + w - 1, y, h, 'cobD');
      x += w;
    }
  }
  // A road puddle holding the red of the eclipse, and the lantern in it.
  g.ellipse(112, 172, 34, 5, 'pud');
  g.hline(88, 171, 20, 'pudL');
  g.hline(120, 173, 14, 'pudL');
  g.set(60, 171, 'lampH');
}

/** The booth behind the counter: posts, dark back cloth, a shelf of capsules. */
function booth(g: Grid): void {
  // Back cloth, patched and sagging.
  g.rect(54, 56, 132, 62, 'wallD');
  g.rect(54, 56, 132, 62, 'wallD');
  for (let x = 60; x < 184; x += 14) g.vline(x, 58, 58, 'wall');
  g.rect(112, 66, 22, 20, 'clD');
  g.rect(113, 67, 20, 18, 'cl');
  g.hline(112, 86, 22, 'ink');
  // The shelf and the capsules on it.
  g.rect(60, 78, 120, 3, 'wdL');
  g.hline(60, 78, 120, 'wdH');
  g.rect(60, 81, 120, 1, 'wdD');
  const shelf: [number, CapColor][] = [[66, 'R'], [75, 'V'], [84, 'T'], [93, 'R'], [102, 'G'], [140, 'T'], [149, 'R'], [158, 'V'], [167, 'G']];
  for (const [x, c] of shelf) capsule(g, x, 73, 3, c);
  // Posts.
  for (const x of [46, 186]) {
    g.rect(x, 34, 6, 86, 'wd');
    g.vline(x, 34, 86, 'wdH');
    g.vline(x + 5, 34, 86, 'wdD');
    g.vline(x + 6, 36, 82, 'rimD');
  }
  // Hanging sign: a plank with a capsule burnt into it.
  g.vline(194, 62, 8, 'goldD');
  g.rect(188, 70, 16, 14, 'wdL');
  g.rect(188, 70, 16, 1, 'wdH');
  g.rect(188, 83, 16, 1, 'wdD');
  capsule(g, 196, 77, 4, 'R');
}

/** The tattered cloth awning: crimson and ash stripes, a ragged scalloped hem, tears and threads. */
function awning(g: Grid): void {
  g.rect(40, 30, 164, 3, 'wd');
  g.rect(40, 30, 164, 1, 'wdH');
  const left = 42;
  const right = 202;
  for (let x = left; x < right; x++) {
    const stripe = Math.floor((x - left) / 10) % 2 === 0;
    g.vline(x, 33, 22, stripe ? 'cl' : 'ash');
    // Shading under the roof beam and a lit edge on each stripe's left.
    g.set(x, 33, stripe ? 'clD' : 'ashD');
    if ((x - left) % 10 === 0) g.vline(x, 34, 20, stripe ? 'clL' : 'ashL');
  }
  // The hem: scallops of varying length, some torn away.
  const r = seeded(19);
  for (let x = left; x < right; x += 10) {
    const stripe = Math.floor((x - left) / 10) % 2 === 0;
    const torn = r() > 0.82;
    const drop = torn ? 2 : 5 + Math.floor(r() * 7);
    for (let i = 0; i < 10; i++) {
      const edge = Math.round(drop * Math.sin(((i + 0.5) / 10) * Math.PI));
      g.vline(x + i, 55, edge, stripe ? 'cl' : 'ash');
      g.set(x + i, 55 + edge, 'ink');
    }
    if (!torn && r() > 0.5) g.vline(x + 4 + Math.floor(r() * 3), 55 + drop, 4 + Math.floor(r() * 4), stripe ? 'clD' : 'ashD');
  }
  // Holes where the cloth has gone.
  for (const [x, y, w, h] of [[78, 38, 5, 6], [128, 44, 4, 5], [168, 36, 6, 7], [100, 48, 3, 4]] as const) g.rect(x, y, w, h, 'wallD');
  // Rim light from the dead sun on the right end.
  g.vline(right - 1, 33, 22, 'rimD');
}

/** The lantern on its chain, hung from the awning's left corner. */
function lantern(g: Grid): void {
  const x = STALL.lantern.x;
  g.vline(x, 56, 14, 'goldD');
  g.rect(x - 4, 70, 9, 2, 'gold');
  g.rect(x - 5, 72, 11, 12, 'goldD');
  g.rect(x - 4, 73, 9, 10, 'lamp');
  g.rect(x - 2, 74, 5, 7, 'lampH');
  g.vline(x, 73, 10, 'goldD');
  g.rect(x - 5, 84, 11, 2, 'gold');
  g.hline(x - 4, 71, 9, 'goldL');
}

function counter(g: Grid): void {
  const { x0, x1, top } = STALL.counter;
  // Top plank, lit from the lantern side, then the worn front boards.
  g.rect(x0, top, x1 - x0, 3, 'wdL');
  g.hline(x0, top, x1 - x0, 'wdH');
  g.rect(x0 - 1, top - 1, 1, 5, 'wdD');
  g.rect(x0 + 2, top + 3, x1 - x0 - 4, 28, 'wd');
  for (let x = x0 + 2; x < x1 - 2; x += 18) {
    g.vline(x, top + 3, 28, 'wdD');
    g.vline(x + 1, top + 3, 28, 'wdL');
  }
  g.hline(x0 + 2, top + 3, x1 - x0 - 4, 'wdD');
  g.hline(x0 + 2, top + 30, x1 - x0 - 4, 'ink');
  g.hline(x0, top + 31, x1 - x0, 'ink');
  // Nails and a knot or two.
  for (const x of [58, 94, 130, 166, 190]) g.set(x, top + 6, 'goldD');
  g.ellipse(76, top + 18, 2, 3, 'wdD');
  // A runner of dark red cloth hanging off the front, gold hem and a capsule emblem.
  g.rect(104, top + 1, 42, 22, 'cl');
  g.rect(104, top + 1, 42, 2, 'clL');
  g.hline(104, top + 21, 42, 'gold');
  for (let x = 104; x < 146; x += 6) g.vline(x + 2, top + 22, 3 + (x % 12 === 8 ? 2 : 0), 'clD');
  capsule(g, 125, top + 11, 5, 'R');
  g.vline(145, top + 3, 19, 'clD');
  // Loose capsules on the plank, one rolled off the edge.
  capsule(g, 64, top - 5, 3, 'V');
  capsule(g, 73, top - 5, 3, 'T');
  capsule(g, 130, top - 5, 3, 'G');
  capsule(g, 139, top - 5, 3, 'R');
  capsule(g, 190, top + 34, 3, 'R');
  g.ellipse(192, top + 40, 4, 1, 'shade');
}

/** A jar of capsules on the counter's right end. */
function jar(g: Grid): void {
  const x = 152;
  const y = 92;
  g.rect(x + 1, y, 20, 3, 'gold');
  g.hline(x + 1, y, 20, 'goldL');
  g.rect(x + 3, y - 3, 16, 3, 'goldD');
  g.rect(x, y + 3, 22, 22, 'ink');
  g.rect(x + 1, y + 3, 20, 21, 'gl');
  const items: [number, number, CapColor][] = [[x + 5, y + 17, 'R'], [x + 11, y + 18, 'V'], [x + 17, y + 17, 'T'], [x + 8, y + 10, 'G'], [x + 14, y + 9, 'R']];
  for (const [cx, cy, c] of items) capsule(g, cx, cy, 3, c);
  g.vline(x + 2, y + 4, 18, 'glH');
  g.vline(x + 20, y + 5, 16, 'rimD');
  g.rect(x - 1, y + 24, 24, 1, 'wdD');
}

/** Crates and a barrel at the stall's foot (left), a snapped pillar (right). */
function props(g: Grid): void {
  // Barrel.
  g.ellipse(22, 138, 10, 3, 'shade');
  g.rect(12, 122, 20, 17, 'wd');
  g.rect(12, 122, 20, 1, 'wdH');
  g.ellipse(22, 122, 10, 2, 'wdL');
  g.ellipse(22, 122, 8, 1, 'wdD');
  for (const y of [126, 134]) g.hline(12, y, 20, 'goldD');
  g.vline(31, 123, 15, 'rimD');
  capsule(g, 20, 117, 3, 'T');
  // Crate with a capsule spilling out.
  g.rect(34, 132, 18, 14, 'wdL');
  g.rect(34, 132, 18, 2, 'wdH');
  g.hline(34, 145, 18, 'ink');
  g.line(34, 134, 51, 144, 1, 'wdD');
  g.line(51, 134, 34, 144, 1, 'wdD');
  g.vline(51, 133, 12, 'rimD');
  // Pillar, broken, behind the right post.
  g.rect(212, 104, 16, 42, 'wallL');
  g.rect(210, 140, 20, 6, 'wall');
  g.line(212, 104, 228, 100, 3, 'wallL');
  g.vline(212, 106, 36, 'wall');
  g.vline(227, 102, 44, 'rimD');
  g.rect(218, 118, 4, 8, 'wallD');
  g.ellipse(222, 146, 12, 2, 'shade');
}

let cached: HTMLCanvasElement | null = null;

/** The scene, prerendered once (320x200); the page scales it with `image-rendering: pixelated`. */
export function buildStall(): HTMLCanvasElement {
  if (cached) return cached;
  const canvas = Object.assign(document.createElement('canvas'), { width: STALL.w, height: STALL.h });
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = new Grid(ctx, PAL);
    sky(g);
    houses(g);
    ground(g);
    props(g);
    booth(g);
    awning(g);
    lantern(g);
    counter(g);
    jar(g);
    // Mimikyu's contact shadow on the plank (the live sprite stands on it).
    g.ellipse(STALL.stand.x, STALL.stand.y + 1, 12, 2, 'shade');
  }
  cached = canvas;
  return canvas;
}
