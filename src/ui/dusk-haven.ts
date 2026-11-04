import { Grid, seeded, type Light, type Palette } from './pixel-grid';

/**
 * Dusk Haven under the Eclipse, drawn once per canvas size (odd/tasks/title-hub.md T9;
 * docs/gdd.md "El mundo": the last dusk, the sun never rose again). A grim street in
 * one-point perspective runs to the Eclipse Crater under the dead sun: crooked, half
 * ruined houses on both sides (gable ends towards you, long walls receding to the
 * vanishing point), boarded windows with the odd candle, missing roof tiles, dead ivy,
 * crows on the ridges, graves, dead trees and a mud road whose puddles hold the red of
 * the eclipse. Only the gacha stall and the notice board keep a light for company.
 * Static and prerendered; props return the lights they give off, and src/ui/eclipse.ts
 * animates only those, the smoke and the sky.
 */

/** The horizon, as a fraction of the height. */
export const HORIZON = 0.56;

/** Road half-width as a fraction of the width at ground depth `d` (0 horizon .. 1 bottom). */
export const roadHalfFrac = (d: number): number => 0.008 + d * 0.16;
const groundFrac = (d: number): number => HORIZON + d * (1 - HORIZON);

/** Where each prop stands (its ground point, fractions of the canvas): the stall and the board. */
export const HAVEN_PROPS: Record<string, { x: number; y: number }> = {
  stall: { x: 0.5 - roadHalfFrac(0.38) - 0.04, y: groundFrac(0.38) },
  board: { x: 0.5 + roadHalfFrac(0.3) + 0.05, y: groundFrac(0.3) },
};

/** One house of the street: its depth, side, materials and the quirks that keep the row irregular. */
export interface HavenHouse {
  side: -1 | 1;
  depth: number;
  roof: 'rr' | 'rb';
  stone: boolean;
  ruin: number;
  /** Extra distance from the road, fraction of the width. */
  gap: number;
  /** Gable height over facade width. */
  pitch: number;
  /** Wall height factor. */
  tall: number;
  /** How far the long wall recedes towards the vanishing point (0..1). */
  reach: number;
  /** Fallen in: no roof, jagged walls. */
  collapsed?: boolean;
}

/** A few houses, spaced in depth so none cuts into another, never mirrored (owner, 2026-11-03). */
export const HAVEN_HOUSES: readonly HavenHouse[] = [
  { side: -1, depth: 0.12, roof: 'rb', stone: false, ruin: 0.4, gap: 0.1, pitch: 0.68, tall: 1.25, reach: 0.22 },
  { side: 1, depth: 0.24, roof: 'rr', stone: false, ruin: 0.5, gap: 0.006, pitch: 0.5, tall: 1, reach: 0.2 },
  { side: -1, depth: 0.64, roof: 'rr', stone: true, ruin: 0.7, gap: 0.045, pitch: 0.4, tall: 0.85, reach: 0.16 },
  { side: 1, depth: 0.8, roof: 'rb', stone: true, ruin: 0.9, gap: 0.14, pitch: 0.5, tall: 0.55, reach: 0.12, collapsed: true },
];

/** The last dusk: everything ash and soot, a red rim where the eclipse touches, rare candlelight. */
export const HAVEN_PAL: Palette = {
  pl: '#26222a', plL: '#332d35', plD: '#17151b', // plaster
  bm: '#0b0809', bmL: '#1f1716', // timber
  rr: '#2e1416', rrL: '#4a1e1f', rrD: '#190a0c', // roof, old red
  rb: '#171a24', rbL: '#252a3a', rbD: '#0c0e14', // roof, slate
  gl: '#c8783a', glH: '#f0b060', dk: '#0c0e12', // glass
  wd: '#2a1a12', wdL: '#3d2618', wdD: '#160d08', // boards
  st: '#242228', stL: '#35333c', stD: '#141317', // stone
  iv: '#3a1418', ivL: '#58201f', web: '#5e5864', // dead ivy, cobweb
  rim: '#ff5a3d', rimD: '#8f2219', // eclipse light
  mud: '#181010', mudL: '#241716', pud: '#46101a', pudL: '#8a1e26', // road
  gr: '#1b1512', grL: '#261d16', // dead grass
  tr: '#0d0909', trL: '#1d1311', trR: '#3a120f', // dead wood, its faint rim
  ir: '#060607', // iron, crows
  cl: '#3a1416', clL: '#552020', clD: '#200b0c', ca: '#cdbf9e', // Mimikyu's stall: tattered cloth, bone capsules
  pa: '#b0a594', paD: '#6e6558', // paper
  te: '#4fb8cf', // waystone rune
};

const candle = (x: number, y: number, r: number, op: number): Light => ({ x, y, r, color: '#ff9a4a', op, flicker: 0.5 });

interface Built {
  lights: Light[];
  smoke: [number, number][];
}

/** Fills one column of a receding plane between two y values. */
const column = (g: Grid, c: number, y0: number, y1: number, key: string) => g.vline(c, Math.round(y0), Math.round(y1) - Math.round(y0), key);

/**
 * A house in one-point perspective: its gable end faces you, its long wall (on the road
 * side) and that roof slope recede towards the vanishing point (vx, vy).
 */
function house(g: Grid, r: () => number, spec: HavenHouse, w: number, h: number, vx: number, vy: number): Built {
  const lights: Light[] = [];
  const smoke: [number, number][] = [];
  const d = spec.depth;
  const gy = Math.round(groundFrac(d) * h);
  const fw = Math.round(14 + d * 66);
  const wh = Math.round((9 + d * 40) * spec.tall);
  const edge = Math.round(w * (0.5 + spec.side * (roadHalfFrac(d) + 0.012 + d * 0.035 + spec.gap)));
  const fx = spec.side < 0 ? edge - fw : edge;
  const top = gy - wh;
  const gh = Math.round(fw * spec.pitch);
  const apexX = fx + fw / 2;
  const apexY = top - gh;
  const k = spec.reach;
  const toward = (x0: number, y0: number, c: number) => y0 + (vy - y0) * ((c - x0) / (vx - x0));
  const wall = spec.stone ? 'st' : 'pl';
  const roofs = [spec.roof, `${spec.roof}L`, `${spec.roof}D`] as const;
  const step = Math.sign(vx - edge) || 1;
  const wallEnd = Math.round(edge + (vx - edge) * k);
  const ridgeEnd = Math.round(apexX + (vx - apexX) * k);

  // 1. The receding roof slope: from the ridge down to the eave (or the gable's edge in front).
  for (let c = Math.round(apexX); !spec.collapsed && c !== ridgeEnd; c += step) {
    const ridge = toward(apexX, apexY, c);
    const beyond = (c - edge) * step >= 0;
    if (beyond && (c - wallEnd) * step > 0) break;
    const eave = beyond ? toward(edge, top - 1, c) : apexY + ((top - 1 - apexY) * Math.abs(c - apexX)) / Math.abs(edge + step - apexX);
    if (eave <= ridge + 1) continue;
    const span = eave - ridge;
    for (let y = Math.round(ridge); y < Math.round(eave); y++) {
      const course = Math.floor(((y - ridge) / span) * Math.max(4, span / 2.5));
      let key: string = course % 2 ? roofs[0] : roofs[2];
      if (course % 2 && (c + course) % 3 === 0) key = roofs[1];
      if (r() < spec.ruin * 0.05) key = 'bm';
      g.set(c, y, key);
    }
    g.set(c, Math.round(ridge), 'rim');
    if (r() < 0.04 + spec.ruin * 0.06) g.set(c, Math.round(ridge) + 1, 'rimD');
  }
  // 2. The long wall on the road side, with posts, boarded windows and the odd candle.
  const posts = 3 + Math.round(d * 4);
  for (let c = edge; c !== wallEnd; c += step) {
    const t = (c - edge) / (wallEnd - edge);
    const yt = toward(edge, top, c);
    const yb = toward(edge, gy, c);
    column(g, c, yt, yb, spec.stone ? 'stD' : 'plD');
    g.set(c, Math.round(yb) - 1, 'stL');
    if (Math.round(t * posts * 10) % 10 === 0 && !spec.stone) column(g, c, yt, yb, 'bm');
    if (!spec.stone) g.set(c, Math.round(yt + (yb - yt) * 0.45), 'bm');
    if (r() < spec.ruin * 0.15) g.set(c, Math.round(yt + r() * (yb - yt)), 'iv');
  }
  const winCount = 2 + Math.round(d * 3);
  for (let i = 0; i < winCount; i++) {
    const t0 = (i + 0.3) / winCount;
    const t1 = t0 + 0.45 / winCount;
    const c0 = Math.round(edge + (wallEnd - edge) * t0);
    const c1 = Math.round(edge + (wallEnd - edge) * t1);
    const lit = r() < 0.18;
    for (let c = c0; c !== c1 + step; c += step) {
      const yt = toward(edge, top, c);
      const yb = toward(edge, gy, c);
      const a = yt + (yb - yt) * 0.18;
      const b = yt + (yb - yt) * 0.42;
      column(g, c, a, b, lit ? 'gl' : 'dk');
      if (!lit) for (let y = Math.round(a) + 1; y < b; y += 2) g.set(c, y, 'wd');
    }
    if (lit) {
      const cm = (c0 + c1) / 2;
      lights.push(candle(cm, toward(edge, top + wh * 0.3, cm), 6 + d * 10, 0.55));
    }
  }
  // 3. The gable end facing you.
  g.rect(fx, top, fw, wh, wall);
  g.rect(spec.side < 0 ? fx : fx + Math.round(fw * 0.65), top, Math.round(fw * 0.35), wh, spec.stone ? 'stD' : 'plD');
  if (spec.stone) {
    for (let y = top + 2; y < gy - 2; y += 3) for (let x = fx + ((y / 3) % 2 ? 1 : 3); x < fx + fw - 2; x += 5) g.hline(x, y, 3, 'stL');
  } else {
    g.vline(fx, top, wh, 'bm').vline(fx + fw - 1, top, wh, 'bm').hline(fx, top, fw, 'bm').hline(fx, top + Math.round(wh * 0.48), fw, 'bm');
    g.line(fx + 1, top + 1, fx + Math.round(fw * 0.3), top + Math.round(wh * 0.46), 1, 'bm').line(fx + fw - 2, top + 1, fx + Math.round(fw * 0.7), top + Math.round(wh * 0.46), 1, 'bm');
  }
  g.rect(fx, gy - 2, fw, 2, 'st').hline(fx, gy - 2, fw, 'stL');
  for (let i = 0; i < 2 + Math.round(spec.ruin * 3); i++) {
    let x = fx + 2 + Math.floor(r() * (fw - 4));
    for (let y = gy - 3; y > gy - 3 - wh * (0.3 + r() * 0.5); y--) {
      g.set(x, y, r() < 0.7 ? 'iv' : 'ivL');
      if (r() < 0.3) x += r() < 0.5 ? -1 : 1;
    }
  }
  const ww = Math.max(3, Math.round(fw * 0.16));
  const wy = top + Math.round(wh * 0.18);
  for (const wx of [fx + Math.round(fw * 0.16), fx + fw - Math.round(fw * 0.16) - ww]) {
    g.rect(wx - 1, wy - 1, ww + 2, Math.round(ww * 1.3) + 2, 'bm').rect(wx, wy, ww, Math.round(ww * 1.3), 'dk');
    if (r() < 0.5) for (let y = wy + 1; y < wy + ww * 1.3; y += 2) g.hline(wx - 1, y, ww + 2, 'wd');
    else g.line(wx, wy, wx + ww - 1, wy + Math.round(ww * 1.3) - 1, 1, 'web');
  }
  const dw = Math.max(3, Math.round(fw * 0.2));
  const dx = Math.round(apexX - dw / 2);
  g.rect(dx - 1, gy - Math.round(wh * 0.5), dw + 2, Math.round(wh * 0.5), 'bm').rect(dx, gy - Math.round(wh * 0.5) + 1, dw - 1, Math.round(wh * 0.5) - 2, 'wdD');
  if (spec.collapsed) {
    // Fallen in: bite a jagged top out of both walls, leave a beam lying across.
    for (let c = fx; c < fx + fw; c++) {
      const bite = Math.round(Math.abs(Math.sin(c * 0.7) * wh * 0.35) + r() * 3);
      g.vline(c, top - 1, bite + 1, 'tr');
      g.set(c, top + bite, 'rimD');
    }
    for (let c = edge; c !== wallEnd; c += step) {
      const yt = toward(edge, top, c);
      const bite = Math.round(Math.abs(Math.cos(c * 0.5)) * wh * 0.4 + r() * 2);
      g.vline(c, Math.round(yt) - 1, bite + 1, 'tr');
    }
    g.line(fx - 3, gy - 2, fx + Math.round(fw * 0.7), top + Math.round(wh * 0.4), 2, 'bm');
    return { lights, smoke };
  }
  for (let j = 0; j <= gh; j++) {
    const half = Math.round((fw / 2 + 1) * (j / gh));
    const y = apexY + j;
    g.hline(Math.round(apexX - half), y, half * 2, j % 3 === 0 ? 'wdD' : 'wd');
    g.set(Math.round(apexX - half) - 1, y, 'rimD').set(Math.round(apexX + half), y, 'rim');
  }
  g.rect(Math.round(apexX) - 1, apexY + Math.round(gh * 0.5), 3, 3, 'dk');
  const cc = Math.round(apexX + (vx - apexX) * 0.12 + step * fw * 0.15);
  const cTop = Math.round(toward(apexX, apexY, cc) - (4 + d * 8));
  const cH = Math.round(6 + d * 10);
  g.rect(cc, cTop, Math.max(2, Math.round(2 + d * 3)), cH, 'st').vline(cc, cTop, cH, 'rimD');
  if (r() < 0.45) smoke.push([cc + 1, cTop - 2]);
  if (r() < 0.6) {
    const bx = Math.round(apexX + (vx - apexX) * (0.05 + r() * 0.15));
    const by = Math.round(toward(apexX, apexY, bx)) - 2;
    g.rect(bx, by, 2, 2, 'ir').set(bx + 2, by, 'ir').set(bx - 1, by + 1, 'ir');
  }
  g.line(fx + 1, top + 1, fx + 4, top + 1, 1, 'web').line(fx + 1, top + 1, fx + 1, top + 4, 1, 'web').set(fx + 2, top + 2, 'web');
  return { lights, smoke };
}

/**
 * A withered tree: a tapering, leaning trunk with root flares, branches that bend as they
 * grow (several short segments, each turning a little) and thin twigs at their tips; the
 * faint rim of the eclipse on the upper side of the thicker limbs.
 */
function deadTree(g: Grid, r: () => number, x: number, y: number, h: number, width = 4): void {
  const limb = (bx: number, by: number, angle: number, length: number, w0: number, depth: number) => {
    const segments = 4;
    let px = bx;
    let py = by;
    let a = angle;
    for (let i = 0; i < segments; i++) {
      a += (r() - 0.5) * 0.45;
      const len = length / segments;
      const nx = px + Math.cos(a) * len;
      const ny = py - Math.sin(a) * len;
      const wdt = Math.max(1, Math.round(w0 * (1 - (i + 0.5) / (segments + 1))));
      g.line(px, py, nx, ny, wdt, 'tr');
      if (wdt >= 3) g.line(px - 1, py - 1, nx - 1, ny - 1, 1, 'trR');
      // Side branches leave along the limb, not only at its tip.
      if (depth > 0 && i >= 1 && r() < 0.55) limb(nx, ny, a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.6), length * (0.5 + r() * 0.2), Math.max(1, wdt - 1), depth - 1);
      px = nx;
      py = ny;
    }
    if (depth > 0) {
      limb(px, py, a + 0.35 + r() * 0.3, length * 0.6, Math.max(1, Math.round(w0 / 2)), depth - 1);
      limb(px, py, a - 0.35 - r() * 0.3, length * 0.55, Math.max(1, Math.round(w0 / 2)), depth - 1);
    } else {
      for (let t = 0; t < 3; t++) {
        const ta = a + (r() - 0.5) * 1.6;
        g.line(px, py, px + Math.cos(ta) * (2 + r() * 3), py - Math.sin(ta) * (2 + r() * 3), 1, 'tr');
      }
    }
  };
  // Root flares.
  for (const dir of [-1, 1]) g.line(x, y - 1, x + dir * (width + 2 + r() * 3), y, 1, 'tr');
  limb(x, y, Math.PI / 2 + (r() - 0.5) * 0.3, h * 0.42, width + 2, 3);
}

function grave(g: Grid, r: () => number, x: number, y: number, s: number): void {
  const tall = Math.round((5 + r() * 5) * s);
  const u = Math.max(1, Math.round(s));
  if (r() < 0.5) {
    g.rect(x, y - tall - 2, Math.max(1, Math.round(2 * s)), tall + 2, 'st').rect(x - 2 * u, y - tall, 6 * u, Math.max(1, Math.round(2 * s)), 'st').set(x, y - tall - 2, 'rimD');
  } else {
    g.rect(x - 2 * u, y - tall, 6 * u, tall, 'st').hline(x - u, y - tall - 1, 4 * u, 'stL').hline(x - u, y - tall - 1, 2 * u, 'rimD');
  }
  g.hline(x - 3 * u, y, 8 * u, 'gr');
}

/** Mimikyu's stall: a tattered cloth awning, a counter of pale capsules, one lantern. */
function stall(g: Grid, cx: number, y: number): Light {
  const w = 30;
  const x = cx - w / 2;
  g.rect(x + 1, y - 18, 2, 18, 'wdD').rect(x + w - 3, y - 20, 2, 20, 'wdD');
  for (let k = 0; k < w + 2; k += 3) g.rect(x - 1 + k, y - 23, 3, 4 + ((k * 7) % 5), (k / 3) % 2 ? 'cl' : 'clD');
  for (let k = 1; k < w; k += 6) g.set(x + k, y - 19 + ((k * 5) % 3), 'clL');
  g.hline(x - 1, y - 24, w + 2, 'rimD').hline(x - 1, y - 24, 8, 'rim');
  g.rect(x + 2, y - 8, w - 4, 8, 'wd').hline(x + 2, y - 8, w - 4, 'wdL').rect(x + 2, y - 2, w - 4, 2, 'wdD');
  for (let i = 0; i < 5; i++) g.rect(x + 5 + i * 4, y - 11, 3, 3, 'ca').set(x + 5 + i * 4, y - 9, 'paD');
  g.rect(x + w - 6, y - 16, 3, 4, 'glH').set(x + w - 5, y - 17, 'ir');
  g.line(x + 3, y - 14, x + 10, y - 14, 1, 'web');
  return candle(x + w - 4.5, y - 14, 18, 0.65);
}

/** The storyteller's notice board: tattered papers, one candle. */
function board(g: Grid, cx: number, y: number): Light {
  g.rect(cx - 10, y - 17, 20, 12, 'wd').rect(cx - 9, y - 16, 18, 10, 'wdD');
  g.rect(cx - 8, y - 15, 4, 6, 'pa').rect(cx - 3, y - 15, 5, 4, 'paD').rect(cx + 3, y - 14, 4, 6, 'pa').set(cx - 7, y - 12, 'rimD');
  g.hline(cx - 11, y - 18, 22, 'rr').hline(cx - 11, y - 18, 5, 'rim');
  g.rect(cx - 9, y - 5, 2, 5, 'wdD').rect(cx + 7, y - 5, 2, 5, 'wdD');
  g.rect(cx + 11, y - 4, 2, 4, 'pa').set(cx + 11, y - 5, 'glH');
  return candle(cx + 11.5, y - 5, 12, 0.7);
}

/** A crooked lantern post; unlit ones stay dark. */
function lantern(g: Grid, x: number, y: number, hgt: number, lit: boolean): Light | null {
  g.line(x, y, x + 1, y - hgt, 1, 'tr').hline(x + 1, y - hgt, 4, 'tr').vline(x + 4, y - hgt, 2, 'ir');
  g.rect(x + 3, y - hgt + 2, 3, 3, lit ? 'glH' : 'dk').hline(x + 3, y - hgt + 1, 3, 'ir');
  return lit ? candle(x + 4.5, y - hgt + 3.5, 14, 0.65) : null;
}

/** The far horizon: Lookout Pass and its last bridge, the crater under the sun, the Black Lake, a dead wood. */
function horizon(g: Grid, r: () => number, w: number, h: number): Light[] {
  const hy = Math.round(h * HORIZON);
  const cx = Math.round(w / 2);
  const lights: Light[] = [];
  const ctx = g.ctx;
  ctx.fillStyle = '#12050a';
  let y = hy - 16;
  for (let x = 0; x < w; x++) {
    y += (r() - 0.5) * 2.2;
    y = Math.max(hy - 28, Math.min(hy - 8, y));
    ctx.fillRect(x, Math.round(y + Math.sin(x / 23) * 4), 1, hy);
  }
  ctx.fillStyle = '#18070d';
  const chasm = Math.round(w * 0.16);
  for (let x = 0; x < w * 0.32; x++) {
    if (Math.abs(x - chasm) < 4) continue;
    const top = hy - 7 - Math.round(Math.sin(x / 9) * 2 + r() * 3 + (x < w * 0.09 ? 7 : 0));
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  g.hline(chasm - 6, hy - 7, 12, 'wdD');
  const tower = Math.round(w * 0.06);
  g.rect(tower, hy - 28, 4, 21, 'stD').rect(tower - 1, hy - 30, 6, 2, 'stD').set(tower + 1, hy - 25, 'rimD');
  ctx.fillStyle = '#1c070d';
  const span = w * 0.2;
  for (let x = Math.round(cx - span); x <= cx + span; x++) {
    const dd = Math.abs(x - cx) / span;
    const top = hy - Math.round((1 - dd * dd) * 17) + (dd < 0.22 ? Math.round((0.22 - dd) * 18) : 0);
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  g.hline(Math.round(cx - span * 0.2), hy - 14, Math.round(span * 0.4), 'rim');
  lights.push({ x: cx, y: hy - 13, r: 40, color: '#e8283a', op: 0.55, flicker: 0.12 });
  const lx = Math.round(w * 0.68);
  const lw = Math.round(w * 0.28);
  ctx.fillStyle = '#020103';
  for (let k = 0; k < 6; k++) ctx.fillRect(lx + k * 3, hy - 1 + Math.floor(k / 2), lw - k * 6, 1);
  for (let x = 0; x < w; x += 2 + r() * 5) {
    if (Math.abs(x - cx) < span * 1.05) continue;
    const t = 5 + r() * 9;
    g.line(Math.round(x), hy, Math.round(x + (r() - 0.5) * 2), Math.round(hy - t), 1, 'tr');
    if (r() < 0.5) g.line(Math.round(x), Math.round(hy - t * 0.6), Math.round(x + (r() < 0.5 ? -2 : 2)), Math.round(hy - t * 0.8), 1, 'tr');
  }
  return lights;
}

/** The ground: dead grass, the mud road to the crater with ruts and red puddles. */
function ground(g: Grid, r: () => number, w: number, h: number): void {
  const ctx = g.ctx;
  const hy = Math.round(h * HORIZON);
  const cx = Math.round(w / 2);
  const earth = ctx.createLinearGradient(0, hy, 0, h);
  earth.addColorStop(0, '#24090f');
  earth.addColorStop(0.3, '#130709');
  earth.addColorStop(1, '#050203');
  ctx.fillStyle = earth;
  ctx.fillRect(0, hy, w, h - hy);
  for (let i = 0; i < 500; i++) {
    const y = hy + Math.floor(Math.pow(r(), 0.7) * (h - hy));
    g.set(Math.floor(r() * w), y, r() < 0.5 ? 'gr' : 'grL');
  }
  for (let y = hy; y < h; y++) {
    const d = (y - hy) / (h - hy);
    const half = w * roadHalfFrac(d);
    g.hline(Math.round(cx - half), y, Math.round(half * 2), d < 0.1 ? 'mudL' : 'mud');
    g.set(Math.round(cx - half * 0.45), y, 'mudL').set(Math.round(cx + half * 0.45), y, 'mudL');
  }
  for (let i = 0; i < 9; i++) {
    const d = 0.1 + r() * 0.85;
    const y = Math.round(hy + d * (h - hy));
    const half = w * roadHalfFrac(d);
    const px = Math.round(cx + (r() - 0.5) * half * 1.4);
    const pw = Math.round(3 + d * 14);
    g.ellipse(px, y, pw, Math.max(1, Math.round(pw * 0.22)), 'pud').hline(px - Math.round(pw * 0.4), y, Math.round(pw * 0.5), 'pudL');
  }
}

export interface HavenLayers {
  sky: HTMLCanvasElement;
  land: HTMLCanvasElement;
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
  if (sctx) {
    const grad = sctx.createLinearGradient(0, 0, 0, h * HORIZON);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(0.55, '#08020a');
    grad.addColorStop(1, '#2a0810');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, w, Math.ceil(h * HORIZON) + 1);
    const r = seeded(11);
    for (let i = 0; i < 140; i++) {
      sctx.fillStyle = `rgba(220, 225, 255, ${0.12 + r() * 0.38})`;
      sctx.fillRect(Math.floor(r() * w), Math.floor(r() * h * HORIZON * 0.9), 1, 1);
    }
  }
  if (lctx) {
    const g = new Grid(lctx, HAVEN_PAL);
    const r = seeded(31);
    const hy = Math.round(h * HORIZON);
    const vx = Math.round(w / 2);
    const vy = hy - 6;
    lights.push(...horizon(g, r, w, h));
    ground(g, r, w, h);
    const at = (id: string) => ({ x: Math.round(HAVEN_PROPS[id]!.x * w), y: Math.round(HAVEN_PROPS[id]!.y * h) });
    // Far to near, so nearer things overlap farther ones; props slot in at their depth.
    const items: { depth: number; draw: () => void }[] = HAVEN_HOUSES.map((spec) => ({
      depth: spec.depth,
      draw: () => {
        const b = house(g, r, spec, w, h, vx, vy);
        lights.push(...b.lights);
        smoke.push(...b.smoke);
      },
    }));
    items.push({ depth: 0.38, draw: () => lights.push(stall(g, at('stall').x, at('stall').y)) });
    items.push({ depth: 0.3, draw: () => lights.push(board(g, at('board').x, at('board').y)) });
    items.push({
      depth: 0.12,
      draw: () => {
        const x = Math.round(w * (0.5 - roadHalfFrac(0.12) - 0.015));
        const y = Math.round(groundFrac(0.12) * h);
        g.rect(x - 2, y - 14, 4, 14, 'st').vline(x - 2, y - 14, 14, 'stL').vline(x, y - 11, 7, 'te').set(x - 2, y - 14, 'rimD');
        lights.push({ x, y: y - 8, r: 10, color: '#4fb8cf', op: 0.4, flicker: 0.08 });
      },
    });
    for (const [d, side, lit] of [[0.25, -1, true], [0.55, 1, false], [0.7, -1, true]] as const) {
      items.push({
        depth: d,
        draw: () => {
          const x = Math.round(w * (0.5 + side * (roadHalfFrac(d) + 0.006)));
          const l = lantern(g, x, Math.round(groundFrac(d) * h), Math.round(10 + d * 26), lit);
          if (l) lights.push(l);
        },
      });
    }
    for (let i = 0; i < 14; i++) {
      const d = 0.15 + r() * 0.8;
      const side = r() < 0.5 ? -1 : 1;
      const xf = 0.5 + side * (roadHalfFrac(d) + 0.02 + r() * 0.08);
      items.push({ depth: d, draw: () => grave(g, r, Math.round(xf * w), Math.round(groundFrac(d) * h), 0.6 + d * 0.9) });
    }
    items.sort((a, b) => a.depth - b.depth).forEach((it) => it.draw());
    deadTree(g, r, Math.round(w * 0.05), h, Math.round(h * 0.75), 6);
    deadTree(g, r, Math.round(w * 0.96), h, Math.round(h * 0.7), 6);
    deadTree(g, r, Math.round(w * 0.16), Math.round(h * 0.7), Math.round(h * 0.35), 3);
    deadTree(g, r, Math.round(w * 0.86), Math.round(h * 0.68), Math.round(h * 0.33), 3);
  }
  if (vctx) {
    const cxv = w / 2;
    const v = vctx.createRadialGradient(cxv, h * 0.42, Math.min(w, h) * 0.3, cxv, h * 0.42, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    vctx.fillStyle = v;
    vctx.fillRect(0, 0, w, h);
  }
  return { sky, land, vignette, lights, smoke };
}
