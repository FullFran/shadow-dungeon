import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { SPRITES } from '../data/sprites';
import { PALETTE } from './tokens';
import { TOWN_RESIDENTS, walkerAt } from './town-walkers';

/**
 * The animated backdrop of the menus: Dusk Haven under the Eclipse, in
 * perspective (odd/tasks/title-hub.md T5; docs/gdd.md "El mundo"). The sun
 * never rose again: a red eclipse hangs over the Eclipse Crater at the end of
 * the road; Lookout Pass and its last bridge to the west, the Black Lake that
 * no longer mirrors the sky to the east. In the town, the gacha stall, the
 * forge, the stone house, the notice board, the waystone and the Sanctum's
 * altar; its residents walk their corners (src/ui/town-walkers.ts), lit red
 * from behind. It renders at a low resolution scaled up by a whole number
 * with `image-rendering: pixelated`, so it reads as pixel art; everything is a
 * function of time except the sprite cut-outs.
 */
const PIXEL = 3;
const EMBERS = 60;
const STARS = 110;
/** The horizon, as a fraction of the height: the ground plane runs from here down. */
const HORIZON = 0.56;

/** Deterministic 0..1 hash of an integer (stable layout between frames). */
export function hash01(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Ember `i` at time `ms` in a w×h buffer: rising, swaying, fading near the top. */
export function emberAt(i: number, ms: number, w: number, h: number): { x: number; y: number; alpha: number; hot: boolean } {
  const speed = 6 + hash01(i * 3 + 1) * 14;
  const travel = h + 20;
  const rise = ((ms / 1000) * speed + hash01(i * 3 + 2) * travel) % travel;
  const y = h + 6 - rise;
  const sway = Math.sin(ms / (900 + hash01(i) * 900) + i) * (3 + hash01(i * 7) * 8);
  const x = hash01(i * 3) * w + sway + (rise * 0.15 * (hash01(i * 5) - 0.5));
  const flicker = 0.6 + 0.4 * Math.sin(ms / 120 + i * 1.7);
  return { x, y, alpha: Math.max(0, Math.min(1, (y / h) * 1.4)) * flicker, hot: hash01(i * 11) > 0.7 };
}


/** A crisp 1..n px line drawn as rects (no anti-aliasing on the pixel canvas). */
function pxLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, width: number): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let k = 0; k <= steps; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / steps);
    const y = Math.round(y0 + ((y1 - y0) * k) / steps);
    ctx.fillRect(x - Math.floor(width / 2), y, width, 1);
  }
}

/** A dead tree: a trunk and seeded, recursive crooked branches. */
function deadTree(ctx: CanvasRenderingContext2D, x: number, base: number, height: number, salt: number, color: string): void {
  ctx.fillStyle = color;
  const branch = (bx: number, by: number, angle: number, length: number, width: number, depth: number, seed: number) => {
    const ex = bx + Math.cos(angle) * length;
    const ey = by - Math.sin(angle) * length;
    pxLine(ctx, bx, by, ex, ey, width);
    if (depth === 0) return;
    const n = 2 + Math.floor(hash01(seed) * 2);
    for (let j = 0; j < n; j++) {
      const turn = (hash01(seed * 7 + j) - 0.5) * 1.6;
      branch(ex, ey, angle + turn, length * (0.55 + hash01(seed * 13 + j) * 0.25), Math.max(1, width - 1), depth - 1, seed * 3 + j + 1);
    }
  };
  branch(x, base, Math.PI / 2 + (hash01(salt) - 0.5) * 0.3, height * 0.45, 4, 4, salt + 11);
}


let castSheets: SheetStore | null = null;
/** Per sheet: the sprite sunk into the eclipse light, and a red copy for the rim. */
const cuts = new Map<string, { lit: HTMLCanvasElement; rim: HTMLCanvasElement }>();

/** Lets the backdrop draw the residents once the sheets are loaded (the scene is complete without them). */
export function setBackdropSheets(sheets: Promise<SheetStore>): void {
  void sheets.then((loaded) => {
    castSheets = loaded;
    cuts.clear();
  });
}

function cutOf(key: string, image: HTMLImageElement): { lit: HTMLCanvasElement; rim: HTMLCanvasElement } {
  const cached = cuts.get(key);
  if (cached) return cached;
  const layer = (paint: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const g = c.getContext('2d');
    if (g) {
      g.drawImage(image, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      paint(g);
    }
    return c;
  };
  const cut = {
    lit: layer((g) => {
      g.fillStyle = 'rgba(30, 6, 14, 0.45)';
      g.fillRect(0, 0, image.width, image.height);
    }),
    rim: layer((g) => {
      g.fillStyle = '#ff5a3d';
      g.fillRect(0, 0, image.width, image.height);
    }),
  };
  cuts.set(key, cut);
  return cut;
}

/** Ground depth 0 (horizon) .. 1 (bottom edge) of a canvas y. */
const depthAt = (y: number, h: number): number => Math.max(0, Math.min(1, (y / h - HORIZON) / (1 - HORIZON)));
/** Draw scale at a depth: far things small, near things large. */
const scaleAt = (depth: number): number => 0.45 + depth * 0.85;

function drawResidents(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number, pulse: number): void {
  if (!castSheets) return;
  const placed = TOWN_RESIDENTS.map((r) => ({ r, at: walkerAt(r, ms) })).sort((a, b) => a.at.y - b.at.y);
  for (const { r, at } of placed) {
    const anims = SPRITES.sprites[r.sprite]?.anims;
    const meta = at.moving ? anims?.Walk : anims?.Idle;
    const image = meta && castSheets.get(sheetKey(r.sprite, meta.file));
    if (!meta || !image) continue;
    const scale = scaleAt(depthAt(at.y * h, h));
    const fw = meta.frameWidth;
    const fh = meta.frameHeight;
    const frame = frameAtTime(meta.durations, ms + r.id.length * 211, true);
    const row = Math.min(at.dir, (meta.rows ?? 1) - 1);
    const anchor = meta.anchor ?? { x: fw / 2, y: fh * 0.75 };
    const footX = at.x * w;
    const footY = at.y * h;
    const lift = (r.float ?? 0) * scale + (r.float ? Math.sin(ms / 800 + footX) * 2 : 0);
    const dx = Math.round(footX - anchor.x * scale);
    const dy = Math.round(footY - lift - anchor.y * scale);
    const dw = Math.round(fw * scale);
    const dh = Math.round(fh * scale);
    // Contact shadow on the ground (smaller when it floats).
    ctx.fillStyle = `rgba(0, 0, 0, ${r.float ? 0.25 : 0.45})`;
    const sw = Math.max(3, Math.round(fw * scale * (r.float ? 0.3 : 0.45)));
    ctx.fillRect(Math.round(footX - sw / 2), Math.round(footY), sw, Math.max(1, Math.round(2 * scale)));
    const cut = cutOf(sheetKey(r.sprite, meta.file), image);
    const sx = frame * fw;
    const sy = row * fh;
    ctx.globalAlpha = 0.45 + 0.35 * pulse;
    ctx.drawImage(cut.rim, sx, sy, fw, fh, dx, dy - 1, dw, dh);
    ctx.globalAlpha = 1;
    ctx.drawImage(cut.lit, sx, sy, fw, fh, dx, dy, dw, dh);
  }
}

/** A house of the town: stone walls, a pitched roof, warm windows; `s` is its depth scale. */
function house(ctx: CanvasRenderingContext2D, x: number, base: number, s: number, wall: string, roof: string, lit: number, chimney = false): void {
  const bw = Math.round(30 * s);
  const bh = Math.round(18 * s);
  const left = Math.round(x - bw / 2);
  const top = base - bh;
  ctx.fillStyle = wall;
  ctx.fillRect(left, top, bw, bh);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(left + Math.round(bw * 0.55), top, bw - Math.round(bw * 0.55), bh);
  ctx.fillStyle = roof;
  const rise = Math.round(12 * s);
  for (let k = 0; k <= rise; k++) {
    const inset = Math.round((k / rise) * (bw / 2 + 2));
    ctx.fillRect(left - 2 + inset, top - k, bw + 4 - inset * 2, 1);
  }
  ctx.fillStyle = 'rgba(232, 40, 58, 0.45)';
  for (let k = 0; k <= rise; k++) ctx.fillRect(left - 2 + Math.round((k / rise) * (bw / 2 + 2)), top - k, 1, 1);
  if (chimney) {
    ctx.fillStyle = roof;
    ctx.fillRect(left + Math.round(bw * 0.7), top - rise + 2, Math.max(2, Math.round(3 * s)), Math.round(7 * s));
  }
  const win = Math.max(2, Math.round(4 * s));
  ctx.fillStyle = `rgba(255, 176, 90, ${lit})`;
  ctx.fillRect(left + Math.round(bw * 0.18), top + Math.round(bh * 0.35), win, win);
  ctx.fillRect(left + Math.round(bw * 0.62), top + Math.round(bh * 0.35), win, win);
  ctx.fillStyle = '#120a0c';
  ctx.fillRect(Math.round(x - win / 2), base - Math.round(bh * 0.55), win, Math.round(bh * 0.55));
}

/** The far horizon: the crater under the eclipse, Lookout Pass with its last bridge, the Black Lake and its hamlet. */
function farLands(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, pulse: number): void {
  const hy = Math.round(h * HORIZON);
  // Lookout Pass: cliffs split by a chasm, one bridge left.
  ctx.fillStyle = '#16070c';
  for (let x = 0; x < w * 0.36; x++) {
    const top = hy - 10 - Math.round(Math.sin(x / 9) * 3 + hash01(Math.floor(x / 2) + 40) * 4 + (x < w * 0.12 ? 8 : 0));
    if (Math.abs(x - w * 0.19) < 4) continue;
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  ctx.fillStyle = '#2a1018';
  ctx.fillRect(Math.round(w * 0.19 - 6), hy - 9, 12, 1);
  for (let k = -6; k <= 6; k += 3) ctx.fillRect(Math.round(w * 0.19 + k), hy - 9, 1, 2);
  // The watchtower on the pass.
  ctx.fillStyle = '#16070c';
  ctx.fillRect(Math.round(w * 0.08), hy - 30, 4, 22);
  ctx.fillRect(Math.round(w * 0.08) - 1, hy - 32, 6, 2);
  ctx.fillStyle = `rgba(255, 138, 61, ${0.5 * pulse})`;
  ctx.fillRect(Math.round(w * 0.08) + 1, hy - 28, 2, 2);
  // The Eclipse Crater: a wide ash cone right under the sun, its pit glowing.
  ctx.fillStyle = '#1b080d';
  const span = w * 0.2;
  for (let x = Math.round(cx - span); x <= cx + span; x++) {
    const d = Math.abs(x - cx) / span;
    const top = hy - Math.round((1 - d * d) * 16) + (d < 0.25 ? Math.round((0.25 - d) * 14) : 0);
    ctx.fillRect(x, top, 1, hy - top + 1);
  }
  ctx.fillStyle = `rgba(232, 40, 58, ${0.55 * pulse})`;
  ctx.fillRect(Math.round(cx - span * 0.22), hy - 13, Math.round(span * 0.44), 1);
  // The Black Lake: ice that no longer mirrors the sky, the hamlet beyond it.
  ctx.fillStyle = '#030204';
  const lx = Math.round(w * 0.66);
  const lw = Math.round(w * 0.3);
  for (let k = 0; k < 6; k++) ctx.fillRect(lx + k * 3, hy - 1 + Math.floor(k / 2), lw - k * 6, 1);
  ctx.fillStyle = 'rgba(180, 190, 220, 0.12)';
  ctx.fillRect(lx + 8, hy, lw - 30, 1);
  for (let i = 0; i < 5; i++) {
    const hx = Math.round(w * 0.72 + i * w * 0.045);
    ctx.fillStyle = '#16070c';
    ctx.fillRect(hx, hy - 6, 6, 5);
    ctx.fillRect(hx + 1, hy - 7, 4, 1);
    ctx.fillStyle = `rgba(255, 176, 90, ${0.35 + 0.2 * Math.sin(i * 2.1)})`;
    ctx.fillRect(hx + 2, hy - 4, 1, 1);
  }
}

/** The ground plane in perspective: dusk earth, faint furrows towards the crater, the road to it. */
function ground(ctx: CanvasRenderingContext2D, w: number, h: number, cx: number, pulse: number): void {
  const hy = Math.round(h * HORIZON);
  const earth = ctx.createLinearGradient(0, hy, 0, h);
  earth.addColorStop(0, '#2a0d12');
  earth.addColorStop(0.25, '#170709');
  earth.addColorStop(1, '#070304');
  ctx.fillStyle = earth;
  ctx.fillRect(0, hy, w, h - hy);
  // Rows of the plane: closer together towards the horizon.
  for (let i = 1; i < 14; i++) {
    const y = hy + Math.round((h - hy) * Math.pow(i / 14, 1.9));
    ctx.fillStyle = `rgba(232, 40, 58, ${0.05 * (1 - i / 14) + 0.015})`;
    ctx.fillRect(0, y, w, 1);
  }
  // The road from the bottom to the crater.
  for (let y = hy; y < h; y++) {
    const d = (y - hy) / (h - hy);
    const half = 2 + d * w * 0.16;
    ctx.fillStyle = `rgba(74, 40, 36, ${0.35 + 0.25 * d})`;
    ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
    ctx.fillStyle = `rgba(255, 138, 61, ${0.06 * pulse * (1 - d)})`;
    ctx.fillRect(Math.round(cx - half * 0.3), y, Math.round(half * 0.6), 1);
  }
  // Lamps along the road, in perspective.
  for (let i = 0; i < 5; i++) {
    const d = 0.12 + i * 0.2;
    const y = hy + Math.round((h - hy) * d);
    const half = 2 + d * w * 0.16;
    const s = scaleAt(d);
    for (const side of [-1, 1]) {
      const x = Math.round(cx + side * (half + 4 * s));
      const pole = Math.round(16 * s);
      ctx.fillStyle = '#0b0507';
      ctx.fillRect(x, y - pole, Math.max(1, Math.round(s)), pole);
      const flick = 0.6 + 0.4 * Math.sin(Date.now() / 120 + i + side);
      ctx.fillStyle = `rgba(255, 191, 94, ${0.85 * flick})`;
      ctx.fillRect(x - Math.round(s), y - pole - Math.round(2 * s), Math.max(2, Math.round(3 * s)), Math.max(2, Math.round(2 * s)));
      ctx.fillStyle = `rgba(255, 138, 61, ${0.12 * flick})`;
      ctx.fillRect(x - Math.round(5 * s), y - pole - Math.round(6 * s), Math.round(11 * s), Math.round(10 * s));
    }
  }
}

/** Dusk Haven itself, back to front, at its depths. */
function town(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number, pulse: number): void {
  const at = (fy: number) => ({ y: Math.round(fy * h), s: scaleAt(depthAt(fy * h, h)) });
  // Back row of houses.
  for (const [fx, wall, roof] of [[0.21, '#2a1d22', '#3a1418'], [0.33, '#2d2024', '#2c1219'], [0.67, '#2b1e23', '#3a1418'], [0.8, '#281b20', '#2c1219']] as const) {
    const p = at(0.6);
    house(ctx, Math.round(w * fx), p.y, p.s, wall, roof, 0.5 + 0.2 * Math.sin(ms / 900 + fx * 9));
  }
  // The stone house where Abra sleeps.
  const stone = at(0.625);
  house(ctx, Math.round(w * 0.6), stone.y, stone.s * 1.1, '#3b3540', '#26222b', 0.25, true);
  // The gacha stall: a dark canopy, a lantern, a counter.
  const stall = at(0.645);
  {
    const x = Math.round(w * 0.28);
    const s = stall.s;
    const bw = Math.round(26 * s);
    ctx.fillStyle = '#1a0f14';
    ctx.fillRect(x - bw / 2, stall.y - Math.round(9 * s), bw, Math.round(9 * s));
    for (let k = 0; k < bw; k += Math.max(2, Math.round(4 * s))) {
      ctx.fillStyle = (k / Math.max(2, Math.round(4 * s))) % 2 ? '#5b2a6e' : '#2d1238';
      ctx.fillRect(Math.round(x - bw / 2 + k), stall.y - Math.round(20 * s), Math.max(2, Math.round(4 * s)), Math.round(5 * s));
    }
    ctx.fillStyle = '#120a0c';
    ctx.fillRect(Math.round(x - bw / 2), stall.y - Math.round(15 * s), 1, Math.round(15 * s));
    ctx.fillRect(Math.round(x + bw / 2 - 1), stall.y - Math.round(15 * s), 1, Math.round(15 * s));
    const glow = 0.7 + 0.3 * Math.sin(ms / 300);
    ctx.fillStyle = `rgba(201, 176, 255, ${glow})`;
    ctx.fillRect(Math.round(x + bw / 2 - 3 * s), stall.y - Math.round(14 * s), Math.max(2, Math.round(2 * s)), Math.max(2, Math.round(3 * s)));
  }
  // The forge: a squat house with a glowing mouth and sparks.
  const forge = at(0.645);
  {
    const x = Math.round(w * 0.745);
    house(ctx, x, forge.y, forge.s, '#2e2124', '#1d1014', 0.2, true);
    const glow = 0.6 + 0.4 * Math.sin(ms / 140);
    ctx.fillStyle = `rgba(255, 120, 40, ${glow})`;
    ctx.fillRect(Math.round(x - 3 * forge.s), forge.y - Math.round(8 * forge.s), Math.round(6 * forge.s), Math.round(6 * forge.s));
    for (let i = 0; i < 6; i++) {
      const life = ((ms / 900 + i / 6) % 1);
      ctx.fillStyle = `rgba(255, 191, 94, ${1 - life})`;
      ctx.fillRect(Math.round(x + 6 * forge.s + Math.sin(i * 3 + ms / 400) * 2), Math.round(forge.y - 26 * forge.s - life * 14), 1, 1);
    }
  }
  // The notice board and the waystone (its rune glows blue) by the road.
  const board = at(0.665);
  {
    const x = Math.round(w * 0.43);
    const s = board.s;
    ctx.fillStyle = '#3a2416';
    ctx.fillRect(x - Math.round(8 * s), board.y - Math.round(14 * s), Math.round(16 * s), Math.round(9 * s));
    ctx.fillStyle = '#d9cfc0';
    ctx.fillRect(x - Math.round(6 * s), board.y - Math.round(12 * s), Math.max(1, Math.round(4 * s)), Math.max(1, Math.round(4 * s)));
    ctx.fillRect(x + Math.round(1 * s), board.y - Math.round(12 * s), Math.max(1, Math.round(5 * s)), Math.max(1, Math.round(3 * s)));
    ctx.fillStyle = '#24160e';
    ctx.fillRect(x - Math.round(7 * s), board.y - Math.round(5 * s), Math.max(1, Math.round(s)), Math.round(5 * s));
    ctx.fillRect(x + Math.round(6 * s), board.y - Math.round(5 * s), Math.max(1, Math.round(s)), Math.round(5 * s));
  }
  const way = at(0.69);
  {
    const x = Math.round(w * 0.575);
    const s = way.s;
    ctx.fillStyle = '#4a434d';
    ctx.fillRect(x - Math.round(3 * s), way.y - Math.round(18 * s), Math.round(6 * s), Math.round(18 * s));
    ctx.fillStyle = `rgba(95, 208, 232, ${0.55 + 0.35 * pulse})`;
    ctx.fillRect(x - Math.round(1 * s), way.y - Math.round(14 * s), Math.max(1, Math.round(2 * s)), Math.round(8 * s));
    ctx.fillStyle = 'rgba(95, 208, 232, 0.1)';
    ctx.fillRect(x - Math.round(8 * s), way.y - Math.round(20 * s), Math.round(16 * s), Math.round(18 * s));
  }
  // Axew's training tree on the east edge, and a dead one on the west lawn.
  deadTree(ctx, Math.round(w * 0.8), at(0.76).y, Math.round(h * 0.3), 8, '#0b0507');
  deadTree(ctx, Math.round(w * 0.13), at(0.8).y, Math.round(h * 0.4), 3, '#080406');
  // (The Sanctum's altar stays off the backdrop: on the hub it read as a stray slab.)
}

/** Haze over the horizon and mist drifting low over the ground. */
function haze(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number): void {
  const hy = Math.round(h * HORIZON);
  const band = ctx.createLinearGradient(0, hy - 14, 0, hy + 16);
  band.addColorStop(0, 'rgba(120, 30, 40, 0)');
  band.addColorStop(0.5, 'rgba(120, 30, 40, 0.28)');
  band.addColorStop(1, 'rgba(120, 30, 40, 0)');
  ctx.fillStyle = band;
  ctx.fillRect(0, hy - 14, w, 30);
  for (let b = 0; b < 2; b++) {
    const y = Math.round(h * (0.86 + b * 0.06));
    for (let x = 0; x < w; x += 2) {
      const a = 0.05 + 0.05 * Math.sin(x / (21 + b * 9) + ms / (2800 + b * 900) + b * 2);
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(140, 70, 90, ${a})`;
      ctx.fillRect(x, y, 2, 7 + b * 3);
    }
  }
}

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number): void {
  ctx.imageSmoothingEnabled = false;
  const sky = ctx.createLinearGradient(0, 0, 0, h * HORIZON);
  sky.addColorStop(0, '#000000');
  sky.addColorStop(0.6, '#0a030a');
  sky.addColorStop(1, '#2c0811');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, Math.ceil(h * HORIZON) + 1);
  for (let i = 0; i < STARS; i++) {
    const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ms / (700 + hash01(i + 500) * 1600) + i));
    ctx.fillStyle = `rgba(220, 225, 255, ${twinkle * hash01(i + 900)})`;
    ctx.fillRect(Math.floor(hash01(i + 100) * w), Math.floor(hash01(i + 300) * h * HORIZON * 0.9), 1, 1);
  }
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.27);
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.14));
  const pulse = 0.82 + 0.18 * Math.sin(ms / 1400);
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + ms / 60000;
    const length = r * (1.5 + hash01(i + 1200) * 1.4);
    ctx.fillStyle = `rgba(255, 106, 61, ${(0.05 + 0.06 * hash01(i + 1300)) * pulse})`;
    pxLine(ctx, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length, 1);
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, Math.round(h * HORIZON));
  ctx.clip();
  drawEclipse(ctx, cx, cy, r, pulse, w, h);
  ctx.restore();
  farLands(ctx, w, h, cx, pulse);
  ground(ctx, w, h, cx, pulse);
  haze(ctx, w, h, ms);
  town(ctx, w, h, ms, pulse);
  drawResidents(ctx, w, h, ms, pulse);
  for (let i = 0; i < EMBERS; i++) {
    const e = emberAt(i, ms, w, h);
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = e.hot ? PALETTE.cursor : PALETTE.eclipseGlow;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;
  const vignette = ctx.createRadialGradient(cx, h * 0.45, Math.min(w, h) * 0.35, cx, h * 0.45, Math.max(w, h) * 0.75);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/**
 * The Crimson Eclipse at (cx, cy): a red corona that breathes with `pulse`
 * (about 0.6..1), a thin ring of light and the dark moon slightly off centre.
 * `w`×`h` is the area the corona is painted over. Shared by the menu backdrop
 * and the prologue.
 */
export function drawEclipse(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pulse: number, w: number, h: number): void {
  const corona = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.2);
  corona.addColorStop(0, `rgba(255, 106, 61, ${0.85 * pulse})`);
  corona.addColorStop(0.18, `rgba(232, 40, 58, ${0.55 * pulse})`);
  corona.addColorStop(0.55, `rgba(120, 10, 30, ${0.22 * pulse})`);
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - w, cy - h, w * 2, h * 2);
  // Ring of light, then the dark moon slightly off centre (a brighter rim on one side).
  ctx.fillStyle = PALETTE.eclipseGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd0a0';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050003';
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 1, r, 0, Math.PI * 2);
  ctx.fill();
}

/** One skyline layer: segments of wall with an occasional tower, battlements on the towers. */
export function skyline(ctx: CanvasRenderingContext2D, w: number, h: number, base: number, salt: number, color: string, rim: number): void {
  let x = 0;
  for (let seg = 0; x < w; seg++) {
    const width = 5 + Math.floor(hash01(seg + salt) * 12);
    const tower = hash01(seg + salt + 50) > 0.8;
    const tall = tower ? 14 + Math.floor(hash01(seg + salt + 70) * 26) : 2 + Math.floor(hash01(seg + salt + 90) * 9);
    const top = base - tall;
    ctx.fillStyle = color;
    ctx.fillRect(x, top, width, h - top);
    ctx.fillStyle = `rgba(232, 40, 58, ${rim})`;
    if (tower) {
      // Battlements: every other pixel pair stands one pixel higher.
      for (let bx = 0; bx < width; bx += 4) {
        ctx.fillStyle = color;
        ctx.fillRect(x + bx, top - 2, 2, 2);
        ctx.fillStyle = `rgba(232, 40, 58, ${rim})`;
        ctx.fillRect(x + bx, top - 2, 2, 1);
      }
      ctx.fillRect(x, top, width, 1);
    } else {
      // Broken wall: a ragged top, lit where it rises.
      ctx.fillRect(x, top, Math.max(1, width - 2), 1);
    }
    x += width;
  }
}

let canvas: HTMLCanvasElement | null = null;
let running = false;

/** The shared backdrop canvas; its animation runs while it is on the page. */
export function eclipseBackdrop(): HTMLCanvasElement {
  canvas ??= Object.assign(document.createElement('canvas'), { className: 'backdrop' });
  canvas.setAttribute('aria-hidden', 'true');
  const node = canvas;
  if (!running) {
    running = true;
    const start = performance.now();
    const frame = (now: number) => {
      if (!node.isConnected) {
        running = false;
        return;
      }
      const w = Math.ceil(window.innerWidth / PIXEL);
      const h = Math.ceil(window.innerHeight / PIXEL);
      if (node.width !== w || node.height !== h) {
        node.width = w;
        node.height = h;
        node.style.width = `${w * PIXEL}px`;
        node.style.height = `${h * PIXEL}px`;
      }
      const ctx = node.getContext('2d');
      if (ctx) draw(ctx, w, h, now - start);
      requestAnimationFrame(frame);
    };
    // The first frame runs after the caller has put the canvas on the page.
    requestAnimationFrame(frame);
  }
  return node;
}
