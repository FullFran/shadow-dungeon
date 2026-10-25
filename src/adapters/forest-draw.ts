import type { Rect } from '../core/state';
import type { Vec2 } from '../core/vec';
import { decorHash } from './crypt-decor';
import type { Firefly, ForestDecor } from './forest-decor';

/**
 * The Misty Forest drawn in code (no tile assets): roots, glowing mushrooms,
 * fallen logs, a shrine, fireflies and drifting mist on generated floors;
 * root-veined clearings and old trees in the fixed arenas; the spirit light.
 * Presentation only. Called by the renderer with the world transform set.
 */
const TILE = 32;

const visibleIn = (view: Rect, x: number, y: number, margin = TILE) =>
  x + margin >= view.x && x - margin <= view.x + view.width && y + margin >= view.y && y - margin <= view.y + view.height;

/** Gnarled roots hanging down a lit wall face and spilling onto the floor below. */
function roots(ctx: CanvasRenderingContext2D, x: number, y: number, look: number): void {
  ctx.strokeStyle = '#4a3522';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const strands = 2 + Math.floor(look * 2);
  for (let i = 0; i < strands; i++) {
    const sx = x + 5 + ((i * 11 + look * 23) % 24);
    const bend = (decorHash(x, y, i) - 0.5) * 10;
    ctx.beginPath();
    ctx.moveTo(sx, y + TILE - 13);
    ctx.quadraticCurveTo(sx + bend, y + TILE - 2, sx + bend * 1.6, y + TILE + 6 + look * 6);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6b4f33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + TILE - 12);
  ctx.lineTo(x + 26, y + TILE - 12);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** A cluster of glowing mushrooms, their caps pulsing softly. */
function mushroom(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, look: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(timeMs / 700 + look * 20);
  const hue = look < 0.5 ? '120, 230, 220' : '180, 150, 255';
  const cx = x + 8 + Math.round(look * 16);
  const cy = y + 20 + Math.round(look * 6);
  const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 22);
  glow.addColorStop(0, `rgba(${hue}, ${0.28 * pulse})`);
  glow.addColorStop(1, `rgba(${hue}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 22, cy - 22, 44, 44);
  for (const [dx, dy, r] of [[0, 0, 4], [6, 3, 3], [-5, 4, 2.5]] as const) {
    ctx.fillStyle = '#d8d2c0';
    ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 4);
    ctx.fillStyle = `rgba(${hue}, ${0.75 + 0.25 * pulse})`;
    ctx.beginPath();
    ctx.ellipse(cx + dx, cy + dy - 1, r, r * 0.6, 0, Math.PI, 0);
    ctx.fill();
  }
}

/** A mossy fallen log across the tile. */
function log(ctx: CanvasRenderingContext2D, x: number, y: number, look: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(x + 1, y + 18, 32, 8);
  ctx.fillStyle = '#5a3f28';
  ctx.fillRect(x - 2, y + 12, 34, 10);
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(x - 2, y + 12, 34, 2);
  ctx.fillStyle = '#3d6b3a';
  ctx.fillRect(x + 4 + Math.round(look * 10), y + 10, 10, 3);
  ctx.fillStyle = '#8a6a48';
  ctx.beginPath();
  ctx.ellipse(x + 31, y + 17, 3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** A small stone shrine set into the wall, its lantern lit. */
function shrine(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number): void {
  const flicker = 0.8 + 0.2 * Math.sin(timeMs / 120 + x);
  const cx = x + 16;
  const glow = ctx.createRadialGradient(cx, y + TILE + 4, 2, cx, y + TILE + 4, 40);
  glow.addColorStop(0, `rgba(255, 220, 140, ${0.3 * flicker})`);
  glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 40, y + TILE - 36, 80, 80);
  ctx.fillStyle = '#6d6f6a';
  ctx.fillRect(cx - 10, y + TILE - 6, 20, 10);
  ctx.fillStyle = '#878a82';
  ctx.fillRect(cx - 13, y + TILE - 9, 26, 4);
  ctx.fillStyle = '#4f514c';
  ctx.fillRect(cx - 4, y + TILE - 3, 8, 6);
  ctx.fillStyle = `rgba(255, 210, 120, ${flicker})`;
  ctx.fillRect(cx - 2, y + TILE - 2, 4, 4);
  // A red cord with paper streamers.
  ctx.fillStyle = '#a8322a';
  ctx.fillRect(cx - 13, y + TILE - 11, 26, 2);
  ctx.fillStyle = '#e8e4d8';
  ctx.fillRect(cx - 8, y + TILE - 9, 2, 5);
  ctx.fillRect(cx + 6, y + TILE - 9, 2, 5);
}

/** The floor dressing of a generated forest floor (only what is in view). */
export function drawForestFloorDecor(ctx: CanvasRenderingContext2D, decor: ForestDecor, view: Rect, timeMs: number, fallen: (x: number, y: number) => boolean): void {
  const seen = (t: { x: number; y: number }) => visibleIn(view, t.x * TILE + 16, t.y * TILE + 16, 48);
  for (const l of decor.logs) if (seen(l) && !fallen(l.x, l.y)) log(ctx, l.x * TILE, l.y * TILE, decorHash(l.x, l.y, 3));
  for (const r of decor.roots) if (seen(r)) roots(ctx, r.x * TILE, r.y * TILE, decorHash(r.x, r.y, 5));
  for (const s of decor.shrines) if (seen(s)) shrine(ctx, s.x * TILE, s.y * TILE, timeMs);
  for (const m of decor.mushrooms) if (seen(m) && !fallen(m.x, m.y)) mushroom(ctx, m.x * TILE, m.y * TILE, timeMs, decorHash(m.x, m.y, 7));
}

/** A forest arena (the hollow, the roost): root veins across the clearing and mushrooms along its edges. */
export function drawForestArena(ctx: CanvasRenderingContext2D, width: number, height: number, timeMs: number): void {
  ctx.strokeStyle = 'rgba(70, 50, 32, 0.6)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const sx = width * decorHash(i, width, 51);
    const sy = i % 2 === 0 ? 0 : height;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(sx + 60 * (decorHash(i, 1, 53) - 0.5), height * 0.3, sx + 90 * (decorHash(i, 2, 57) - 0.5), height * 0.6, width * decorHash(i, height, 59), sy === 0 ? height * 0.45 : height * 0.55);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  for (let x = 24; x < width - 16; x += 72) {
    mushroom(ctx, x, -6, timeMs, decorHash(x, 0, 61));
    mushroom(ctx, x + 30, height - 30, timeMs, decorHash(x, 1, 61));
  }
}

/** An old tree on an arena obstacle: roots at its foot, a dark trunk and a canopy. */
export function drawForestTree(ctx: CanvasRenderingContext2D, rect: Rect, lift: number, cover: boolean): void {
  const cx = rect.x + rect.width / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(cx, rect.y + rect.height - 2, rect.width * 0.75, rect.height * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3e2c1c';
  ctx.lineWidth = 4;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 6, rect.y + rect.height - 8);
    ctx.quadraticCurveTo(cx + side * rect.width * 0.5, rect.y + rect.height - 2, cx + side * rect.width * 0.8, rect.y + rect.height + 4);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2a1b';
  ctx.fillRect(rect.x + 6, rect.y - lift, rect.width - 12, rect.height + lift - 4);
  ctx.fillStyle = '#5b4330';
  ctx.fillRect(rect.x + 9, rect.y - lift, 4, rect.height + lift - 6);
  // The canopy: denser on the trees that stop arrows.
  ctx.fillStyle = cover ? 'rgba(24, 52, 30, 0.92)' : 'rgba(28, 58, 34, 0.8)';
  ctx.beginPath();
  ctx.ellipse(cx, rect.y - lift - 10, rect.width * 0.95, rect.height * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(70, 110, 64, 0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - 6, rect.y - lift - 16, rect.width * 0.5, rect.height * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Fireflies over an arena of this size (fixed by its size, like the floor's). */
export function arenaFireflies(width: number, height: number): Firefly[] {
  return Array.from({ length: 10 }, (_, i) => ({
    x: width * (0.1 + 0.8 * decorHash(i, width, 71)),
    y: height * (0.1 + 0.8 * decorHash(i, height, 73)),
    rx: 50 + 60 * decorHash(i, 3, 79),
    ry: 30 + 40 * decorHash(i, 5, 83),
    phase: decorHash(i, 7, 89) * Math.PI * 2,
  }));
}

/** Fireflies blinking as they drift, and two slow layers of mist across the view. */
export function drawForestAir(ctx: CanvasRenderingContext2D, fireflies: readonly Firefly[], view: Rect, timeMs: number): void {
  for (const f of fireflies) {
    const t = timeMs / 4200 + f.phase;
    const x = f.x + Math.sin(t * 1.3) * f.rx;
    const y = f.y + Math.sin(t * 0.9 + f.phase) * f.ry;
    if (!visibleIn(view, x, y)) continue;
    const blink = Math.max(0, Math.sin(timeMs / 380 + f.phase * 7));
    if (blink <= 0.05) continue;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 9);
    glow.addColorStop(0, `rgba(230, 255, 140, ${0.55 * blink})`);
    glow.addColorStop(1, 'rgba(230, 255, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 9, y - 9, 18, 18);
    ctx.fillStyle = `rgba(250, 255, 200, ${blink})`;
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  for (const [speed, alpha, band, offset] of [[0.012, 0.07, 120, 0], [-0.008, 0.05, 180, 300]] as const) {
    const drift = (timeMs * speed + offset) % 640;
    for (let k = -1; k <= Math.ceil(view.width / 640) + 1; k++) {
      const x = view.x - (view.x % 640) + k * 640 + drift;
      const y = view.y + view.height * 0.35 + Math.sin(timeMs / 5000 + k + offset) * 40 + (offset ? 120 : 0);
      const g = ctx.createLinearGradient(0, y - band / 2, 0, y + band / 2);
      g.addColorStop(0, 'rgba(190, 210, 200, 0)');
      g.addColorStop(0.5, `rgba(190, 210, 200, ${alpha})`);
      g.addColorStop(1, 'rgba(190, 210, 200, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 320, y - band / 2, 640, band);
    }
  }
}

/** The spirit light: a pale blue flame with a halo and a short trail, bobbing; brighter once it rests over the cache. */
export function drawWisp(ctx: CanvasRenderingContext2D, pos: Vec2, timeMs: number, settled: boolean): void {
  const bob = Math.sin(timeMs / 260) * 4;
  const x = pos.x;
  const y = pos.y - 18 + bob;
  const size = settled ? 1.3 : 1;
  const halo = ctx.createRadialGradient(x, y, 1, x, y, 30 * size);
  halo.addColorStop(0, 'rgba(160, 220, 255, 0.55)');
  halo.addColorStop(1, 'rgba(160, 220, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - 30 * size, y - 30 * size, 60 * size, 60 * size);
  for (let i = 1; i <= 4; i++) {
    ctx.fillStyle = `rgba(190, 235, 255, ${0.5 - i * 0.1})`;
    ctx.fillRect(Math.round(x + Math.sin(timeMs / 200 - i) * 3) - 1, Math.round(y + i * 4), 3, 3);
  }
  ctx.fillStyle = 'rgba(200, 240, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(x, y, 5 * size, 7 * size, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 3);
}
