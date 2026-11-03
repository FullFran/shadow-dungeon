import { Grid, seeded, type Light, type Palette } from './pixel-grid';

/**
 * Dusk Haven under the Eclipse, drawn once per canvas size (odd/tasks/title-hub.md T9;
 * docs/gdd.md "El mundo"; craft after cobbleverse-platform's pixel-village): timber
 * cottages with tiled gables and mullioned windows, the gacha stall, the forge, the
 * stone house where Abra sleeps, the notice board, the waystone, Smeargle's easel,
 * Axew's training tree, dark woods, the crater, Lookout Pass and the Black Lake on the
 * horizon. Everything here is static and prerendered; props return the lights they
 * give off and their chimney tops, and src/ui/eclipse.ts animates only those, the
 * residents and the sky each frame.
 */

/** The horizon, as a fraction of the height. */
export const HORIZON = 0.56;

/** Where each prop stands (its ground point, fractions of the canvas): residents keep to these. */
export const HAVEN_PROPS: Record<string, { x: number; y: number }> = {
  stall: { x: 0.31, y: 0.7 },
  forge: { x: 0.7, y: 0.7 },
  stoneHouse: { x: 0.785, y: 0.635 },
  board: { x: 0.41, y: 0.68 },
  waystone: { x: 0.595, y: 0.685 },
  easel: { x: 0.22, y: 0.8 },
  trainingTree: { x: 0.655, y: 0.79 },
};

/** Night under a red sun: everything dim but lamplight, with a red rim where the eclipse touches. */
export const HAVEN_PAL: Palette = {
  pl: '#2b2125', plL: '#3e2c2e', plD: '#1b1418', // plaster
  bm: '#0f0a0b', bmL: '#2a1a17', // timber beam
  rr: '#4a1a1c', rrL: '#6e2a26', rrD: '#2a0e10', // roof red
  rb: '#1c2133', rbL: '#2c3550', rbD: '#11141f', // roof slate
  rm: '#1d2a22', rmL: '#2b3f31', rmD: '#111a15', // roof moss
  gl: '#e0a050', glH: '#ffd890', glD: '#9c5e2b', dk: '#141820', cu: '#6e2a3e', // glass, curtain
  st: '#2a282e', stL: '#3c3a42', stD: '#18171b', // stone
  co: '#1a1719', coL: '#262227', coH: '#3a343a', // cobble
  di: '#1e1412', diL: '#2c1d18', // dirt
  gr: '#121811', grL: '#1c261b', // grass
  lf: '#0b100d', lfM: '#121a15', lfL: '#1c2a21', lfH: '#2c3f31', // dark leaves
  tr: '#130c0b', trL: '#261913', // trunk
  ir: '#09090b', // iron
  wd: '#3a2416', wdL: '#57361f', wdD: '#24160e', // wood
  rim: '#ff5a3d', rimD: '#a3291f', // eclipse rim light
  vi: '#5b2a6e', viL: '#8a4aa8', viD: '#2d1238', viH: '#c9b0ff', // violet (gacha)
  fo: '#ff7a28', foH: '#ffd27a', // forge fire
  te: '#5fd0e8', teD: '#2a6f8a', // waystone rune
  pa: '#d9cfc0', paD: '#9a8f80', // paper
  bl: '#6e2a3e', blL: '#9a3e52', // blanket
  ca: '#efe6d6', // canvas
};

const amber = (x: number, y: number, r: number, op: number, flicker = 0.25): Light => ({ x, y, r, color: '#ffb35a', op, flicker });

/** A mullioned window, lit or dark; returns its light. */
function windowPane(g: Grid, x: number, y: number, lit: boolean, curtain: boolean): Light | null {
  g.rect(x, y, 5, 6, 'bm');
  g.rect(x + 1, y + 1, 3, 4, lit ? 'gl' : 'dk');
  if (lit) g.set(x + 1, y + 1, 'glH').set(x + 3, y + 4, 'glD');
  g.vline(x + 2, y + 1, 4, 'bm').hline(x + 1, y + 3, 3, 'bm');
  if (curtain && lit) g.vline(x + 1, y + 1, 4, 'cu');
  g.hline(x - 1, y + 6, 7, 'stL');
  return lit ? amber(x + 2.5, y + 3, 9, 0.35, 0.05) : null;
}

/** A tiled gable over [x, x + w) with eaves on row `y`; the side facing the eclipse gets a red rim. Returns the ridge row. */
function gable(g: Grid, x: number, y: number, w: number, roof: 'rr' | 'rb' | 'rm', rimSide: -1 | 1): number {
  const [base, lit, dark] = [roof, `${roof}L`, `${roof}D`];
  const over = 2;
  const half = w / 2 + over;
  const rows = Math.max(4, Math.round(half * 0.85));
  const mid = x + w / 2;
  for (let j = 0; j < rows; j++) {
    const hw = Math.max(1, Math.round((half * (j + 1)) / rows));
    const row = y - rows + j;
    const left = Math.round(mid - hw);
    g.rect(left, row, hw * 2, 1, j % 2 ? base : dark);
    if (j % 2) for (let i = left + 1; i < mid; i += 3) g.set(i, row, lit);
    // Eclipse rim on the facing slope's edge.
    g.set(rimSide < 0 ? left : left + hw * 2 - 1, row, j < rows - 1 ? 'rim' : 'rimD');
  }
  g.hline(Math.round(mid - half), y, Math.round(half * 2), 'bm');
  g.hline(Math.round(mid) - 1, y - rows, 2, 'rim');
  return y - rows;
}

interface Built {
  lights: Light[];
  smoke: [number, number][];
}

/** A timber-framed cottage standing on row `y`, left edge `x`. */
function cottage(g: Grid, r: () => number, x: number, y: number, w: number, h: number, roof: 'rr' | 'rb' | 'rm', rimSide: -1 | 1, opts: { stone?: boolean; chimney?: boolean } = {}): Built {
  const lights: Light[] = [];
  const smoke: [number, number][] = [];
  const wall = opts.stone ? 'st' : 'pl';
  g.rect(x, y - h, w, h, wall);
  // Shade on the side away from the eclipse light, rim on the facing corner.
  const shadeW = Math.round(w * 0.4);
  g.rect(rimSide < 0 ? x + w - shadeW : x, y - h, shadeW, h, opts.stone ? 'stD' : 'plD');
  g.vline(rimSide < 0 ? x : x + w - 1, y - h, h, 'rimD');
  if (opts.stone) {
    for (let row = y - h + 2; row < y - 2; row += 3) for (let col = x + ((row / 3) % 2 ? 1 : 3); col < x + w - 1; col += 5) g.hline(col, row, 3, 'stL');
  } else {
    g.vline(x, y - h, h - 2, 'bm').vline(x + w - 1, y - h, h - 2, 'bm').hline(x, y - h, w, 'bm');
    if (h >= 16) g.hline(x, y - Math.round(h / 2) - 1, w, 'bm');
    for (let i = 0; i < 3; i++) g.set(x + 1 + i, y - h + 3 - i, 'bm').set(x + w - 2 - i, y - h + 3 - i, 'bm');
  }
  g.rect(x, y - 2, w, 2, 'st').hline(x, y - 2, w, 'stL');
  const top = gable(g, x, y - h, w, roof, rimSide);
  if (opts.chimney !== false) {
    const cx = x + Math.round(w * (rimSide < 0 ? 0.68 : 0.22));
    const cy = top + Math.round((y - h - top) * 0.3);
    g.rect(cx, cy - 4, 3, y - h - cy + 4, 'st').vline(cx, cy - 4, y - h - cy + 4, 'stL').rect(cx - 1, cy - 5, 5, 1, 'stL');
    smoke.push([cx + 1, cy - 6]);
  }
  // Door with its lamp.
  const dx = x + Math.round(w / 2) - 2;
  g.rect(dx - 1, y - 9, 6, 7, 'bm').rect(dx, y - 8, 4, 6, 'wd').vline(dx + 2, y - 8, 6, 'wdD').set(dx + 3, y - 5, 'glH');
  g.rect(dx + 5, y - 11, 2, 2, 'glH').set(dx + 5, y - 12, 'ir');
  lights.push(amber(dx + 6, y - 10, 10, 0.55, 0.35));
  // Windows on each floor, skipping the door.
  const floors = h >= 16 ? [y - h + 3, y - Math.round(h / 2) + 2] : [y - h + 3 + Math.max(0, Math.round((h - 12) / 2))];
  floors.forEach((wy, floor) => {
    for (let wx = x + 2; wx + 5 <= x + w - 2; wx += 7) {
      if (floor === floors.length - 1 && wx + 5 >= dx - 1 && wx <= dx + 5) continue;
      const l = windowPane(g, wx, wy, r() > 0.25, r() < 0.4);
      if (l) lights.push(l);
    }
  });
  return { lights, smoke };
}

/** A dark tree, shaded from the top, a red rim on its crown. */
function darkTree(g: Grid, r: () => number, x: number, y: number, h: number, w: number): void {
  const trunkH = Math.round(h * 0.36);
  g.rect(x - 1, y - trunkH, 3, trunkH, 'tr').vline(x - 1, y - trunkH, trunkH, 'trL').set(x - 2, y - 1, 'tr').set(x + 2, y - 1, 'tr');
  const cy = y - trunkH - Math.round((h - trunkH) * 0.45);
  const rx = w / 2;
  const ry = (h - trunkH) / 2 + 1;
  g.ellipse(x, cy, rx, ry, 'lf');
  g.ellipse(x - rx * 0.55, cy + ry * 0.2, rx * 0.5, ry * 0.6, 'lf');
  g.ellipse(x + rx * 0.5, cy + ry * 0.15, rx * 0.5, ry * 0.65, 'lf');
  g.ellipse(x, cy - ry * 0.2, rx * 0.72, ry * 0.65, 'lfM');
  g.ellipse(x - rx * 0.2, cy - ry * 0.45, rx * 0.42, ry * 0.35, 'lfL');
  for (let i = 0; i < Math.round(w * 0.4); i++) g.set(x - Math.round(rx * 0.5) + Math.floor(r() * rx), cy - Math.round(ry * 0.8) + Math.floor(r() * ry * 0.5), 'lfH');
  for (let i = 0; i < Math.round(w * 0.5); i++) {
    const a = -Math.PI * (0.15 + r() * 0.7);
    g.set(Math.round(x + Math.cos(a) * rx * 0.95), Math.round(cy + Math.sin(a) * ry * 0.95), 'rimD');
  }
  for (let i = 0; i < Math.round(w * 0.7); i++) {
    const a = r() * Math.PI * 2;
    g.set(Math.round(x + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 'lf');
  }
}

/** A bare, crooked tree (Axew's training tree, the woods' edge). */
function bareTree(g: Grid, r: () => number, x: number, y: number, h: number): void {
  const branch = (bx: number, by: number, angle: number, length: number, width: number, depth: number) => {
    const ex = bx + Math.cos(angle) * length;
    const ey = by - Math.sin(angle) * length;
    g.line(bx, by, ex, ey, width, 'tr');
    if (width > 1) g.line(bx - 1, by, ex - 1, ey, 1, 'trL');
    if (depth === 0) return;
    const n = 2 + Math.floor(r() * 2);
    for (let j = 0; j < n; j++) branch(ex, ey, angle + (r() - 0.5) * 1.6, length * (0.55 + r() * 0.25), Math.max(1, width - 1), depth - 1);
  };
  branch(x, y, Math.PI / 2 + (r() - 0.5) * 0.2, h * 0.42, 4, 4);
}

function lampPost(g: Grid, x: number, y: number, h: number): Light {
  g.vline(x, y - h, h, 'bmL').vline(x + 1, y - h + 2, h - 2, 'ir').hline(x - 1, y - 1, 3, 'bmL');
  g.rect(x - 1, y - h - 3, 3, 3, 'glH').hline(x - 2, y - h - 4, 5, 'ir').set(x, y - h - 5, 'ir');
  return amber(x + 0.5, y - h - 1.5, 14, 0.6, 0.45);
}

/** Mimikyu's gacha stall: a counter, a striped violet awning, a hanging lantern, crates. */
function stall(g: Grid, cx: number, y: number): Built {
  const w = 30;
  const x = cx - w / 2;
  g.rect(x + 1, y - 18, 2, 18, 'wdD').rect(x + w - 3, y - 18, 2, 18, 'wdD');
  for (let k = 0; k < w + 4; k += 4) g.rect(x - 2 + k, y - 22, 4, 5, (k / 4) % 2 ? 'vi' : 'viD');
  for (let k = 0; k < w + 4; k += 4) g.rect(x - 1 + k, y - 17, 2, 1, (k / 4) % 2 ? 'vi' : 'viD');
  g.hline(x - 2, y - 23, w + 4, 'viL').hline(x - 2, y - 23, 6, 'rim');
  g.rect(x + 2, y - 8, w - 4, 8, 'wd').hline(x + 2, y - 8, w - 4, 'wdL').rect(x + 2, y - 2, w - 4, 2, 'wdD');
  // Capsules on the counter.
  for (let i = 0; i < 5; i++) g.rect(x + 5 + i * 4, y - 11, 3, 3, i % 2 ? 'viH' : 'vi').set(x + 5 + i * 4, y - 11, 'glH');
  g.rect(x + w - 6, y - 15, 3, 4, 'viH').set(x + w - 5, y - 16, 'ir');
  g.rect(x - 7, y - 6, 6, 6, 'wd').hline(x - 7, y - 6, 6, 'wdL').line(x - 7, y - 6, x - 2, y - 1, 1, 'wdD');
  return { lights: [{ x: x + w - 4.5, y: y - 13, r: 18, color: '#b98aff', op: 0.6, flicker: 0.3 }], smoke: [] };
}

/** Poochyena's forge: squat stone, a glowing arch, an anvil, a tall chimney. */
function forge(g: Grid, cx: number, y: number): Built {
  const w = 32;
  const h = 16;
  const x = cx - w / 2;
  const b = cottage(g, () => 0.9, x, y, w, h, 'rb', -1, { stone: true });
  g.rect(cx - 6, y - 11, 12, 11, 'bm');
  g.rect(cx - 5, y - 10, 10, 10, 'fo').rect(cx - 3, y - 8, 6, 6, 'foH');
  g.rect(cx + 9, y - 5, 7, 2, 'ir').rect(cx + 11, y - 3, 3, 3, 'ir').set(cx + 9, y - 5, 'stL');
  return { lights: [...b.lights, { x: cx, y: y - 6, r: 26, color: '#ff7a28', op: 0.75, flicker: 0.6 }], smoke: b.smoke };
}

function board(g: Grid, cx: number, y: number): void {
  g.rect(cx - 9, y - 16, 18, 11, 'wd').rect(cx - 8, y - 15, 16, 9, 'wdD');
  g.rect(cx - 7, y - 14, 4, 5, 'pa').rect(cx - 2, y - 14, 5, 3, 'pa').rect(cx + 4, y - 13, 3, 5, 'paD').set(cx - 6, y - 12, 'rimD');
  g.hline(cx - 10, y - 17, 20, 'rrL').hline(cx - 11, y - 18, 22, 'rr').hline(cx - 10, y - 18, 4, 'rim');
  g.rect(cx - 8, y - 5, 2, 5, 'wdD').rect(cx + 6, y - 5, 2, 5, 'wdD');
}

function waystone(g: Grid, cx: number, y: number): Light {
  g.rect(cx - 4, y - 22, 8, 22, 'st').vline(cx - 4, y - 22, 22, 'stL').rect(cx - 3, y - 25, 6, 3, 'st').rect(cx - 2, y - 26, 4, 1, 'stL');
  g.vline(cx, y - 19, 12, 'te').hline(cx - 2, y - 15, 5, 'te').set(cx - 1, y - 11, 'teD').set(cx + 1, y - 11, 'teD');
  g.rect(cx - 6, y - 2, 12, 2, 'stD');
  return { x: cx, y: y - 14, r: 20, color: '#5fd0e8', op: 0.5, flicker: 0.1 };
}

function easel(g: Grid, cx: number, y: number): void {
  g.line(cx - 5, y, cx, y - 18, 1, 'wd').line(cx + 5, y, cx, y - 18, 1, 'wd').line(cx, y - 18, cx + 2, y, 1, 'wdD');
  g.rect(cx - 6, y - 16, 12, 9, 'ca').rect(cx - 5, y - 15, 4, 3, 'rr').rect(cx - 1, y - 13, 5, 3, 'te').rect(cx + 2, y - 15, 3, 2, 'fo');
  g.hline(cx - 7, y - 7, 14, 'wdL');
}

/** The porch blanket where Abra sleeps, by the stone house. */
function blanket(g: Grid, cx: number, y: number): void {
  g.ellipse(cx, y - 1, 8, 2, 'bl').ellipse(cx - 2, y - 2, 4, 1, 'blL');
}

/** The far horizon: Lookout Pass and its bridge, the crater under the eclipse, the Black Lake and its hamlet, woods. */
function horizon(g: Grid, r: () => number, w: number, h: number): Light[] {
  const hy = Math.round(h * HORIZON);
  const cx = Math.round(w / 2);
  const lights: Light[] = [];
  const ctx = g.ctx;
  // Distant range.
  ctx.fillStyle = '#14060b';
  let y = hy - 18;
  for (let x = 0; x < w; x++) {
    y += (r() - 0.5) * 2.2;
    y = Math.max(hy - 30, Math.min(hy - 10, y));
    ctx.fillRect(x, Math.round(y + Math.sin(x / 23) * 4), 1, hy);
  }
  // Lookout Pass: cliffs, the chasm, the last bridge, the watchtower.
  ctx.fillStyle = '#1a080e';
  const chasm = Math.round(w * 0.17);
  for (let x = 0; x < w * 0.34; x++) {
    if (Math.abs(x - chasm) < 4) continue;
    const top = hy - 8 - Math.round(Math.sin(x / 9) * 2 + r() * 3 + (x < w * 0.1 ? 7 : 0));
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  g.hline(chasm - 6, hy - 8, 12, 'wdD');
  for (let k = -6; k <= 6; k += 3) g.vline(chasm + k, hy - 8, 2, 'wdD');
  const tower = Math.round(w * 0.07);
  g.rect(tower, hy - 30, 4, 22, 'stD').rect(tower - 1, hy - 32, 6, 2, 'stD');
  g.rect(tower + 1, hy - 27, 2, 2, 'fo');
  lights.push({ x: tower + 2, y: hy - 26, r: 10, color: '#ff8a3d', op: 0.5, flicker: 0.4 });
  // The Eclipse Crater right under the sun, its pit glowing.
  ctx.fillStyle = '#20090f';
  const span = w * 0.2;
  for (let x = Math.round(cx - span); x <= cx + span; x++) {
    const d = Math.abs(x - cx) / span;
    const top = hy - Math.round((1 - d * d) * 18) + (d < 0.22 ? Math.round((0.22 - d) * 18) : 0);
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  g.hline(Math.round(cx - span * 0.2), hy - 15, Math.round(span * 0.4), 'rim');
  lights.push({ x: cx, y: hy - 14, r: 36, color: '#e8283a', op: 0.45, flicker: 0.15 });
  // The Black Lake, ice that mirrors nothing, and the hamlet past it.
  const lx = Math.round(w * 0.66);
  const lw = Math.round(w * 0.3);
  ctx.fillStyle = '#030204';
  for (let k = 0; k < 6; k++) ctx.fillRect(lx + k * 3, hy - 1 + Math.floor(k / 2), lw - k * 6, 1);
  ctx.fillStyle = 'rgba(180, 190, 220, 0.14)';
  ctx.fillRect(lx + 8, hy, lw - 30, 1);
  for (let i = 0; i < 6; i++) {
    const hx = Math.round(w * 0.71 + i * w * 0.04);
    g.rect(hx, hy - 7, 7, 6, 'plD').rect(hx - 1, hy - 8, 9, 1, 'rrD').set(hx + 3, hy - 9, 'rrD');
    if (r() > 0.3) {
      g.set(hx + 2, hy - 5, 'gl');
      lights.push(amber(hx + 2.5, hy - 4.5, 5, 0.35, 0.1));
    }
  }
  // Woods along the horizon on both sides: a dark, ragged tree line.
  for (const [x0, x1] of [[0, w * 0.3], [w * 0.7, w]] as const) {
    for (let x = x0; x < x1; x += 3 + r() * 4) darkTree(g, r, Math.round(x), hy + 1, 9 + r() * 8, 6 + r() * 5);
  }
  return lights;
}

/** The ground in perspective: earth, furrows towards the crater, the cobbled road, grass on the lawns. */
function ground(g: Grid, r: () => number, w: number, h: number): void {
  const ctx = g.ctx;
  const hy = Math.round(h * HORIZON);
  const cx = Math.round(w / 2);
  const earth = ctx.createLinearGradient(0, hy, 0, h);
  earth.addColorStop(0, '#2a0d12');
  earth.addColorStop(0.25, '#170809');
  earth.addColorStop(1, '#070304');
  ctx.fillStyle = earth;
  ctx.fillRect(0, hy, w, h - hy);
  for (let i = 0; i < 400; i++) {
    const y = hy + Math.floor(Math.pow(r(), 0.7) * (h - hy));
    g.set(Math.floor(r() * w), y, r() < 0.5 ? 'gr' : 'grL');
  }
  for (let i = 1; i < 14; i++) {
    const y = hy + Math.round((h - hy) * Math.pow(i / 14, 1.9));
    ctx.fillStyle = `rgba(232, 40, 58, ${0.045 * (1 - i / 14) + 0.012})`;
    ctx.fillRect(0, y, w, 1);
  }
  // The road, cobbled, widening towards us.
  for (let y = hy; y < h; y++) {
    const d = (y - hy) / (h - hy);
    const half = 2 + d * w * 0.15;
    ctx.fillStyle = d < 0.12 ? '#2a1a18' : '#201718';
    ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
    if (d > 0.1) {
      const step = Math.max(2, Math.round(2 + d * 6));
      for (let x = Math.round(cx - half) + ((y % 2) * step) / 2; x < cx + half - 1; x += step) g.set(Math.round(x), y, r() < 0.3 ? 'coH' : 'coL');
    }
    ctx.fillStyle = 'rgba(255, 138, 61, 0.05)';
    ctx.fillRect(Math.round(cx - half * 0.25), y, Math.round(half * 0.5), 1);
  }
}

export interface HavenLayers {
  /** Sky and stars: drawn first, then the animated eclipse over it. */
  sky: HTMLCanvasElement;
  /** Everything from the horizon down, transparent above it. */
  land: HTMLCanvasElement;
  /** The edges' darkening, drawn last. */
  vignette: HTMLCanvasElement;
  lights: Light[];
  smoke: [number, number][];
}

const layer = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D | null] => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};

/** Builds the static layers for a w×h buffer (call again only when the size changes). */
export function buildHaven(w: number, h: number): HavenLayers {
  const [sky, sctx] = layer(w, h);
  const [land, lctx] = layer(w, h);
  const [vignette, vctx] = layer(w, h);
  const lights: Light[] = [];
  const smoke: [number, number][] = [];
  const at = (id: string) => ({ x: Math.round(HAVEN_PROPS[id]!.x * w), y: Math.round(HAVEN_PROPS[id]!.y * h) });
  if (sctx) {
    const grad = sctx.createLinearGradient(0, 0, 0, h * HORIZON);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.6, '#0a030a');
    grad.addColorStop(1, '#2c0811');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, w, Math.ceil(h * HORIZON) + 1);
    const r = seeded(11);
    for (let i = 0; i < 160; i++) {
      sctx.fillStyle = `rgba(220, 225, 255, ${0.15 + r() * 0.45})`;
      sctx.fillRect(Math.floor(r() * w), Math.floor(r() * h * HORIZON * 0.9), 1, 1);
    }
  }
  if (lctx) {
    const g = new Grid(lctx, HAVEN_PAL);
    const r = seeded(23);
    lights.push(...horizon(g, r, w, h));
    ground(g, r, w, h);
    const hy = Math.round(h * HORIZON);
    const cx = Math.round(w / 2);
    // Back row of cottages framing the road, the crater between them.
    const backY = Math.round(h * 0.615);
    for (const [fx, cw, ch, roof, side] of [
      [0.25, 48, 30, 'rr', 1],
      [0.385, 34, 20, 'rm', 1],
      [0.615, 36, 21, 'rr', -1],
      [0.735, 46, 28, 'rb', -1],
    ] as const) {
      const b = cottage(g, r, Math.round(fx * w - cw / 2), backY, cw, ch, roof, side);
      lights.push(...b.lights);
      smoke.push(...b.smoke);
    }
    // Dark trees between and behind the houses.
    for (const fx of [0.18, 0.32, 0.455, 0.545, 0.675, 0.83]) darkTree(g, r, Math.round(fx * w), backY + 2, 26 + r() * 10, 16 + r() * 8);
    const stone = at('stoneHouse');
    const sb = cottage(g, r, stone.x - 21, stone.y, 42, 22, 'rb', -1, { stone: true });
    lights.push(...sb.lights);
    smoke.push(...sb.smoke);
    const bl = at('stoneHouse');
    blanket(g, bl.x - 30, bl.y + 9);
    const bd = at('board');
    board(g, bd.x, bd.y);
    const ws = at('waystone');
    lights.push(waystone(g, ws.x, ws.y));
    const st = at('stall');
    const sl = stall(g, st.x, st.y);
    lights.push(...sl.lights);
    const fg = at('forge');
    const fb = forge(g, fg.x, fg.y);
    lights.push(...fb.lights);
    smoke.push(...fb.smoke);
    const tt = at('trainingTree');
    bareTree(g, r, tt.x + 6, tt.y, Math.round(h * 0.24));
    const es = at('easel');
    easel(g, es.x, es.y);
    // Lamps along the road, in perspective.
    for (let i = 0; i < 5; i++) {
      const d = 0.15 + i * 0.19;
      const y = hy + Math.round((h - hy) * d);
      const half = 2 + d * w * 0.15;
      const pole = Math.round(8 + d * 18);
      for (const side of [-1, 1] as const) lights.push(lampPost(g, Math.round(cx + side * (half + 3 + d * 6)), y, pole));
    }
    // Near woods at both edges, the darkest things on screen.
    for (const [fx, fy] of [[0.04, 0.9], [0.12, 0.97], [0.9, 0.93], [0.97, 0.88]] as const) darkTree(g, r, Math.round(fx * w), Math.round(fy * h), 70 + r() * 20, 40 + r() * 12);
    bareTree(g, r, Math.round(w * 0.08), Math.round(h * 0.8), Math.round(h * 0.42));
  }
  if (vctx) {
    const cxv = w / 2;
    const v = vctx.createRadialGradient(cxv, h * 0.45, Math.min(w, h) * 0.35, cxv, h * 0.45, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
    vctx.fillStyle = v;
    vctx.fillRect(0, 0, w, h);
  }
  return { sky, land, vignette, lights, smoke };
}
