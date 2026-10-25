import { PALETTE } from './tokens';

/**
 * The animated backdrop of the menus, drawn in code: a black sky with faint
 * stars, a red eclipse whose corona pulses slowly, a ruined skyline lit red
 * from behind and embers drifting up. It renders at a low resolution and is
 * scaled up by a whole number with `image-rendering: pixelated`, so it reads
 * as pixel art. Embers and stars are functions of time (no state).
 */
const PIXEL = 3;
const EMBERS = 70;
const STARS = 90;

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

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#000000');
  sky.addColorStop(0.7, '#07030a');
  sky.addColorStop(1, '#14040a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < STARS; i++) {
    const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ms / (700 + hash01(i + 500) * 1600) + i));
    ctx.fillStyle = `rgba(220, 225, 255, ${twinkle * hash01(i + 900)})`;
    ctx.fillRect(Math.floor(hash01(i + 100) * w), Math.floor(hash01(i + 300) * h * 0.75), 1, 1);
  }

  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.3);
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.13));
  const pulse = 0.82 + 0.18 * Math.sin(ms / 1400);
  drawEclipse(ctx, cx, cy, r, pulse, w, h);

  // Ruined skyline in two layers: a far, faint one and a near one of broken walls and towers, rim-lit red on top.
  skyline(ctx, w, h, Math.round(h * 0.8), 200, '#0b0410', 0.18 * pulse);
  skyline(ctx, w, h, Math.round(h * 0.88), 0, '#030104', 0.3 + 0.25 * pulse);

  for (let i = 0; i < EMBERS; i++) {
    const e = emberAt(i, ms, w, h);
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = e.hot ? PALETTE.cursor : PALETTE.eclipseGlow;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;
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
