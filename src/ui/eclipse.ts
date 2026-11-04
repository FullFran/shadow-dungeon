import { sheetKey, type SheetImage, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { SPRITES } from '../data/sprites';
import { buildHaven, HORIZON, type HavenLayers } from './dusk-haven';
import type { Light } from './pixel-grid';
import { PALETTE } from './tokens';
import { TOWN_RESIDENTS, walkerAt } from './town-walkers';

/**
 * The animated backdrop of the menus: Dusk Haven under the Eclipse (src/ui/dusk-haven.ts
 * draws the town once per size; odd/tasks/title-hub.md T9). Per frame only the cheap,
 * living parts are drawn over the prerendered layers: a few twinkling stars, the
 * eclipse's breathing corona and slow rays, the props' lights (additive, flickering),
 * chimney smoke, the residents walking their corners (src/ui/town-walkers.ts), drifting
 * fog and embers. The buffer is about 300 px tall at any window size (whole-number
 * upscale with `image-rendering: pixelated`), so the art keeps its pixel size.
 */
const EMBERS = 60;
const TWINKLES = 26;

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

function cutOf(key: string, image: SheetImage): { lit: HTMLCanvasElement; rim: HTMLCanvasElement } {
  const cached = cuts.get(key);
  if (cached) return cached;
  const tinted = (color: string) => {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const g = c.getContext('2d');
    if (g) {
      g.drawImage(image, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = color;
      g.fillRect(0, 0, image.width, image.height);
    }
    return c;
  };
  const cut = { lit: tinted('rgba(30, 6, 14, 0.4)'), rim: tinted('#ff5a3d') };
  cuts.set(key, cut);
  return cut;
}

const depthAt = (y: number, h: number): number => Math.max(0, Math.min(1, (y / h - HORIZON) / (1 - HORIZON)));
/** Sprite scale at a ground depth: far small, near large. */
const scaleAt = (depth: number): number => 0.5 + depth * 0.8;

function drawResidents(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number, pulse: number): void {
  if (!castSheets) return;
  const placed = TOWN_RESIDENTS.map((r) => ({ r, at: walkerAt(r, ms) })).sort((a, b) => a.at.y - b.at.y);
  for (const { r, at } of placed) {
    const anims = SPRITES.sprites[r.sprite]?.anims;
    const meta = at.moving ? anims?.Walk : anims?.Idle;
    const image = meta && castSheets.get(sheetKey(r.sprite, meta.file));
    if (!meta || !image) continue;
    const scale = scaleAt(depthAt(at.y * h, h)) * (h / 300);
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
    ctx.fillStyle = `rgba(0, 0, 0, ${r.float ? 0.22 : 0.5})`;
    const sw = Math.max(3, Math.round(fw * scale * (r.float ? 0.3 : 0.42)));
    ctx.fillRect(Math.round(footX - sw / 2), Math.round(footY), sw, Math.max(1, Math.round(2 * scale)));
    const cut = cutOf(sheetKey(r.sprite, meta.file), image);
    const sx = frame * fw;
    const sy = row * fh;
    ctx.globalAlpha = 0.4 + 0.35 * pulse;
    ctx.drawImage(cut.rim, sx, sy, fw, fh, dx, dy - 1, dw, dh);
    ctx.globalAlpha = 1;
    ctx.drawImage(cut.lit, sx, sy, fw, fh, dx, dy, dw, dh);
  }
}

/** Radial glow sprites by colour and radius, made once. */
const glows = new Map<string, HTMLCanvasElement>();
function glowOf(color: string, r: number): HTMLCanvasElement {
  const key = `${color}|${r}`;
  let c = glows.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, r * 2, r * 2);
    }
    glows.set(key, c);
  }
  return c;
}

function drawLights(ctx: CanvasRenderingContext2D, lights: readonly Light[], ms: number): void {
  ctx.globalCompositeOperation = 'lighter';
  lights.forEach((l, i) => {
    const f = l.flicker > 0 ? 1 - l.flicker * 0.5 * (0.5 + 0.5 * Math.sin(ms / (90 + (i % 7) * 23) + i * 1.7)) * (0.6 + 0.4 * Math.sin(ms / 1300 + i)) : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, l.op * f * 0.55));
    const r = Math.max(2, Math.round(l.r));
    ctx.drawImage(glowOf(l.color, r), Math.round(l.x - r), Math.round(l.y - r));
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function drawSmoke(ctx: CanvasRenderingContext2D, smoke: readonly [number, number][], ms: number): void {
  smoke.forEach(([x, y], i) => {
    for (let k = 0; k < 6; k++) {
      const life = (ms / 4200 + k / 6 + i * 0.37) % 1;
      const px = x + Math.sin(life * 5 + i) * 2 + life * 6;
      const py = y - life * 22;
      const size = 1 + Math.round(life * 3);
      ctx.fillStyle = `rgba(120, 100, 110, ${0.28 * (1 - life)})`;
      ctx.fillRect(Math.round(px), Math.round(py), size, size);
    }
  });
}

/** A soft fog strip, made once per width and slid sideways. */
let fogStrip: HTMLCanvasElement | null = null;
function fogOf(w: number): HTMLCanvasElement {
  if (fogStrip && fogStrip.width === w * 2) return fogStrip;
  const c = document.createElement('canvas');
  c.width = w * 2;
  c.height = 14;
  const g = c.getContext('2d');
  if (g) {
    for (let x = 0; x < c.width; x += 2) {
      const a = 0.05 + 0.05 * Math.sin((x / c.width) * Math.PI * 8) + 0.03 * Math.sin((x / c.width) * Math.PI * 22);
      if (a <= 0) continue;
      g.fillStyle = `rgba(140, 70, 90, ${a})`;
      g.fillRect(x, 3 + Math.round(Math.sin(x / 17) * 2), 2, 8);
    }
  }
  fogStrip = c;
  return c;
}

let haven: HavenLayers | null = null;

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number): void {
  ctx.imageSmoothingEnabled = false;
  if (!haven || haven.sky.width !== w || haven.sky.height !== h) haven = buildHaven(w, h);
  ctx.drawImage(haven.sky, 0, 0);
  for (let i = 0; i < TWINKLES; i++) {
    ctx.fillStyle = `rgba(230, 235, 255, ${0.5 + 0.5 * Math.sin(ms / (500 + hash01(i + 500) * 1400) + i)})`;
    ctx.fillRect(Math.floor(hash01(i + 100) * w), Math.floor(hash01(i + 300) * h * HORIZON * 0.85), 1, 1);
  }
  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.27);
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.14));
  const pulse = 0.82 + 0.18 * Math.sin(ms / 1400);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, Math.round(h * HORIZON));
  ctx.clip();
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + ms / 60000;
    const length = r * (1.5 + hash01(i + 1200) * 1.4);
    ctx.fillStyle = `rgba(255, 106, 61, ${(0.05 + 0.06 * hash01(i + 1300)) * pulse})`;
    pxLine(ctx, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length, 1);
  }
  drawEclipse(ctx, cx, cy, r, pulse, w, h);
  ctx.restore();
  ctx.drawImage(haven.land, 0, 0);
  drawLights(ctx, haven.lights, ms);
  drawSmoke(ctx, haven.smoke, ms);
  drawResidents(ctx, w, h, ms, pulse);
  const fog = fogOf(w);
  for (const [fy, speed, alpha] of [[0.6, 9000, 0.9], [0.86, 6000, 1]] as const) {
    const off = Math.round(((ms / speed) * w) % w);
    ctx.globalAlpha = alpha;
    ctx.drawImage(fog, -off, Math.round(h * fy));
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < EMBERS; i++) {
    const e = emberAt(i, ms, w, h);
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = e.hot ? PALETTE.cursor : PALETTE.eclipseGlow;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(haven.vignette, 0, 0);
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
const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      // About 300 buffer pixels tall at any size, scaled up by a whole number.
      const pixel = Math.max(1, Math.round(window.innerHeight / 300));
      const w = Math.ceil(window.innerWidth / pixel);
      const h = Math.ceil(window.innerHeight / pixel);
      if (node.width !== w || node.height !== h) {
        node.width = w;
        node.height = h;
        node.style.width = `${w * pixel}px`;
        node.style.height = `${h * pixel}px`;
      }
      const ctx = node.getContext('2d');
      // Reduced motion: the scene holds still (one frame a second keeps the residents' places current).
      if (ctx) draw(ctx, w, h, reducedMotion() ? Math.floor((now - start) / 1000) * 1000 : now - start);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  return node;
}
