import { sheetKey, type SheetStore } from '../adapters/assets';
import { frameAtTime } from '../adapters/sprite-anim';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import { PALETTE } from './tokens';

/**
 * The animated backdrop of the menus, drawn in code: a black sky with faint
 * stars, a red eclipse whose corona breathes and throws slow rays, jagged
 * cliffs, two gothic spires lit from inside, a ruined skyline, a graveyard
 * with candles and dead trees, Pokémon of the dungeons as silhouettes rimmed
 * by the eclipse light, drifting fog and embers (odd/tasks/title-hub.md T5).
 * It renders at a low resolution and is scaled up by a whole number with
 * `image-rendering: pixelated`, so it reads as pixel art. Everything is a
 * function of time (no state) except the silhouettes cut from the sheets.
 */
const PIXEL = 3;
const EMBERS = 70;
const STARS = 110;

/** A Pokémon of the scene: its sprite folder, where its feet stand (0..1 of the canvas), a slow bob for the floating ones. */
export interface CastMember {
  sprite: string;
  x: number;
  y: number;
  bob?: number;
  flip?: boolean;
}

/** Who lives in the backdrop: the dungeons' own, never the player's partner (it stands on the hub's altar). */
export const BACKDROP_CAST: readonly CastMember[] = [
  { sprite: SPRITE_KEYS.hoothoot, x: 0.37, y: 0.49 },
  { sprite: SPRITE_KEYS.drifloon, x: 0.28, y: 0.62, bob: 4 },
  { sprite: SPRITE_KEYS.gengar, x: 0.31, y: 0.87 },
  { sprite: SPRITE_KEYS.sableye, x: 0.645, y: 0.9, flip: true },
  { sprite: SPRITE_KEYS.duskull, x: 0.66, y: 0.68, bob: 3, flip: true },
  { sprite: SPRITE_KEYS.aegislashBlade, x: 0.73, y: 0.89 },
];

let castSheets: SheetStore | null = null;
/** The silhouette and its rim light per sprite, cut once from the idle sheet's first row. */
const silhouettes = new Map<string, { dark: HTMLCanvasElement; rim: HTMLCanvasElement } | null>();

/** Lets the backdrop draw its Pokémon once the sheets are loaded (the scene is complete without them). */
export function setBackdropSheets(sheets: Promise<SheetStore>): void {
  void sheets.then((loaded) => {
    castSheets = loaded;
    silhouettes.clear();
  });
}

function silhouetteOf(sprite: string): { dark: HTMLCanvasElement; rim: HTMLCanvasElement } | null {
  if (silhouettes.has(sprite)) return silhouettes.get(sprite)!;
  const meta = SPRITES.sprites[sprite]?.anims.Idle;
  const image = meta && castSheets?.get(sheetKey(sprite, meta.file));
  if (!meta || !image) return null;
  const tint = (color: string) => {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = meta.frameHeight;
    const g = c.getContext('2d');
    if (!g) return c;
    g.drawImage(image, 0, 0, image.width, meta.frameHeight, 0, 0, image.width, meta.frameHeight);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  };
  // The sprite itself, sunk into the dark (its colours still read), and a red copy for the rim light.
  const dark = document.createElement('canvas');
  dark.width = image.width;
  dark.height = meta.frameHeight;
  const g = dark.getContext('2d');
  if (g) {
    g.drawImage(image, 0, 0, image.width, meta.frameHeight, 0, 0, image.width, meta.frameHeight);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(14, 4, 10, 0.66)';
    g.fillRect(0, 0, dark.width, dark.height);
  }
  const cut = { dark, rim: tint('#ff4a3d') };
  silhouettes.set(sprite, cut);
  return cut;
}

function drawCast(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number, pulse: number): void {
  if (!castSheets) return;
  BACKDROP_CAST.forEach((member, i) => {
    const meta = SPRITES.sprites[member.sprite]?.anims.Idle;
    const cut = silhouetteOf(member.sprite);
    if (!meta || !cut) return;
    const f = frameAtTime(meta.durations, ms + i * 377, true);
    const bob = member.bob ? Math.round(Math.sin(ms / 900 + i) * member.bob) : 0;
    const dx = Math.round(member.x * w - meta.frameWidth / 2);
    const dy = Math.round(member.y * h - meta.frameHeight) + bob;
    ctx.save();
    if (member.flip) {
      ctx.translate(dx * 2 + meta.frameWidth, 0);
      ctx.scale(-1, 1);
    }
    const sx = f * meta.frameWidth;
    // Rim light: the eclipse behind them, strongest on top.
    ctx.globalAlpha = 0.5 + 0.4 * pulse;
    ctx.drawImage(cut.rim, sx, 0, meta.frameWidth, meta.frameHeight, dx, dy - 1, meta.frameWidth, meta.frameHeight);
    ctx.globalAlpha = 0.3 + 0.2 * pulse;
    ctx.drawImage(cut.rim, sx, 0, meta.frameWidth, meta.frameHeight, dx - 1, dy, meta.frameWidth, meta.frameHeight);
    ctx.drawImage(cut.rim, sx, 0, meta.frameWidth, meta.frameHeight, dx + 1, dy, meta.frameWidth, meta.frameHeight);
    ctx.globalAlpha = 1;
    ctx.drawImage(cut.dark, sx, 0, meta.frameWidth, meta.frameHeight, dx, dy, meta.frameWidth, meta.frameHeight);
    ctx.restore();
  });
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

/** A gothic spire: body, pointed roof, a glowing rose window and lit lancets. */
function spire(ctx: CanvasRenderingContext2D, cx: number, base: number, width: number, height: number, glow: number): void {
  const top = base - height;
  ctx.fillStyle = '#0a0409';
  ctx.fillRect(cx - width / 2, top, width, height);
  for (let k = 0; k < width / 2 + 10; k++) ctx.fillRect(Math.round(cx - width / 2 + k * (width / (width + 20))), top - k, Math.max(1, Math.round(width - k * 2 * (width / (width + 20)))), 1);
  ctx.fillStyle = `rgba(170, 24, 40, ${0.3 + 0.25 * glow})`;
  const ry = top + Math.round(height * 0.18);
  ctx.beginPath();
  ctx.arc(cx, ry, Math.max(2, Math.round(width * 0.16)), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0a0409';
  ctx.fillRect(cx, ry - 3, 1, 7);
  ctx.fillRect(cx - 3, ry, 7, 1);
  ctx.fillStyle = `rgba(255, 138, 61, ${0.25 + 0.3 * glow})`;
  for (let row = 0; row < 3; row++) {
    const wy = ry + 8 + row * Math.round(height * 0.16);
    ctx.fillRect(Math.round(cx - width * 0.28), wy, 2, 5);
    ctx.fillRect(Math.round(cx + width * 0.28) - 2, wy, 2, 5);
  }
}

/** Jagged far cliffs between the sky and the city. */
function cliffs(ctx: CanvasRenderingContext2D, w: number, h: number, base: number): void {
  ctx.fillStyle = '#12050b';
  let y = base;
  for (let x = 0; x < w; x++) {
    y += (hash01(Math.floor(x / 3) + 400) - 0.5) * 3;
    y = Math.max(base - 34, Math.min(base + 4, y));
    const peak = Math.sin(x / 37) * 6 + Math.sin(x / 13) * 2;
    ctx.fillRect(x, Math.round(y + peak), 1, h);
  }
}

/** The graveyard on the near ground: stones and crosses, candles flickering on a few. */
function graveyard(ctx: CanvasRenderingContext2D, w: number, h: number, ground: number, ms: number): void {
  ctx.fillStyle = '#040203';
  ctx.fillRect(0, ground, w, h - ground);
  ctx.fillStyle = 'rgba(232, 40, 58, 0.22)';
  ctx.fillRect(0, ground, w, 1);
  const count = Math.max(8, Math.round(w / 34));
  for (let i = 0; i < count; i++) {
    const x = Math.round(((i + hash01(i + 700) * 0.6) / count) * w);
    const tall = 5 + Math.floor(hash01(i + 720) * 7);
    const cross = hash01(i + 740) > 0.55;
    ctx.fillStyle = '#0d080c';
    if (cross) {
      ctx.fillRect(x, ground - tall - 3, 2, tall + 3);
      ctx.fillRect(x - 2, ground - tall, 6, 2);
    } else {
      ctx.fillRect(x - 2, ground - tall, 6, tall);
      ctx.fillRect(x - 1, ground - tall - 1, 4, 1);
    }
    ctx.fillStyle = 'rgba(232, 40, 58, 0.35)';
    ctx.fillRect(cross ? x : x - 1, ground - tall - (cross ? 3 : 1), cross ? 2 : 4, 1);
    if (hash01(i + 760) > 0.6) {
      const flick = 0.6 + 0.4 * Math.sin(ms / 90 + i * 2.3);
      ctx.fillStyle = '#d9cfc0';
      ctx.fillRect(x + 5, ground - 3, 1, 3);
      ctx.fillStyle = `rgba(255, 191, 94, ${flick})`;
      ctx.fillRect(x + 5, ground - 5, 1, 2);
      ctx.fillStyle = `rgba(255, 138, 61, ${0.18 * flick})`;
      ctx.fillRect(x + 3, ground - 7, 5, 5);
    }
  }
}

/** Fog banks drifting over the ground. */
function fog(ctx: CanvasRenderingContext2D, w: number, h: number, ms: number): void {
  for (let band = 0; band < 3; band++) {
    const y = Math.round(h * (0.84 + band * 0.045));
    for (let x = 0; x < w; x += 2) {
      const a = 0.05 + 0.05 * Math.sin(x / (19 + band * 7) + ms / (2600 + band * 900) + band * 2) + 0.03 * Math.sin(x / 7 - ms / 1700);
      if (a <= 0) continue;
      ctx.fillStyle = `rgba(140, 70, 90, ${a})`;
      ctx.fillRect(x, y, 2, 6 + band * 2);
    }
  }
}

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
  sky.addColorStop(0.55, '#08030a');
  sky.addColorStop(0.82, '#22060f');
  sky.addColorStop(1, '#0c0306');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < STARS; i++) {
    const twinkle = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(ms / (700 + hash01(i + 500) * 1600) + i));
    ctx.fillStyle = `rgba(220, 225, 255, ${twinkle * hash01(i + 900)})`;
    ctx.fillRect(Math.floor(hash01(i + 100) * w), Math.floor(hash01(i + 300) * h * 0.7), 1, 1);
  }

  const cx = Math.round(w / 2);
  const cy = Math.round(h * 0.3);
  const r = Math.max(10, Math.round(Math.min(w, h) * 0.15));
  const pulse = 0.82 + 0.18 * Math.sin(ms / 1400);
  // Slow rays of the corona, turning once every few minutes.
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2 + ms / 60000;
    const length = r * (1.5 + hash01(i + 1200) * 1.4);
    ctx.fillStyle = `rgba(255, 106, 61, ${(0.05 + 0.06 * hash01(i + 1300)) * pulse})`;
    pxLine(ctx, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, cx + Math.cos(angle) * length, cy + Math.sin(angle) * length, 1);
  }
  drawEclipse(ctx, cx, cy, r, pulse, w, h);

  cliffs(ctx, w, h, Math.round(h * 0.7));
  spire(ctx, Math.round(w * 0.37), Math.round(h * 0.86), 18, Math.round(h * 0.36), pulse);
  spire(ctx, Math.round(w * 0.63), Math.round(h * 0.86), 16, Math.round(h * 0.31), pulse);
  // Ruined skyline in two layers: a far, faint one and a near one of broken walls and towers, rim-lit red on top.
  skyline(ctx, w, h, Math.round(h * 0.8), 200, '#0b0410', 0.18 * pulse);
  skyline(ctx, w, h, Math.round(h * 0.88), 0, '#030104', 0.3 + 0.25 * pulse);
  deadTree(ctx, Math.round(w * 0.05), Math.round(h * 0.95), Math.round(h * 0.5), 3, '#050204');
  deadTree(ctx, Math.round(w * 0.96), Math.round(h * 0.95), Math.round(h * 0.42), 8, '#050204');
  graveyard(ctx, w, h, Math.round(h * 0.95), ms);
  drawCast(ctx, w, h, ms, pulse);
  fog(ctx, w, h, ms);

  for (let i = 0; i < EMBERS; i++) {
    const e = emberAt(i, ms, w, h);
    ctx.globalAlpha = e.alpha;
    ctx.fillStyle = e.hot ? PALETTE.cursor : PALETTE.eclipseGlow;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;

  // A vignette keeps the hub's edges readable.
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
