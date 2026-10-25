import type { Rect } from '../core/state';
import { isWall, type TileGrid } from '../core/tiles';

/**
 * The Sima del Eclipse's backdrop (presentation only): the eclipse hanging
 * in the dark beyond the map, growing as you descend, with distant spires
 * and drifting rocks in two parallax layers. In the abyss band the rooms are
 * rock islands floating over that void, and red light falls through it.
 */
export interface SimaLook {
  floor: number;
  /** The abyss band: walls are drawn as void, floors as floating rock. */
  abyss: boolean;
}

const TILE = 32;

/** Radius (view px) of the eclipse on the backdrop: it grows with depth, up to a cap. */
export const eclipseRadius = (floor: number): number => Math.round(14 + 46 * Math.min(1, Math.max(0, floor - 1) / 60));

function hash(i: number, salt: number): number {
  let h = Math.imul(i * 374761393 + salt * 668265263, 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const mod = (a: number, b: number): number => ((a % b) + b) % b;

/**
 * Draws the backdrop over the whole view, in view units: call it before the
 * world transform (it sets the pixel scale itself and leaves it so).
 */
export function drawSimaBackdrop(ctx: CanvasRenderingContext2D, view: Rect, pixelScale: number, look: SimaLook, timeMs: number): void {
  const { width: w, height: h } = view;
  ctx.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, look.abyss ? '#1a0a1c' : '#0e0812');
  sky.addColorStop(1, '#030105');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // The eclipse: a black disc in a red corona, barely moving (the farthest layer).
  const r = eclipseRadius(look.floor);
  const cx = Math.round(w * 0.7 - mod(view.x * 0.03, w * 0.4));
  const cy = Math.round(h * 0.3 - mod(view.y * 0.02, h * 0.15));
  const pulse = 0.85 + 0.15 * Math.sin(timeMs / 900);
  const corona = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 2.4);
  corona.addColorStop(0, `rgba(255, 70, 60, ${0.55 * pulse})`);
  corona.addColorStop(0.4, `rgba(160, 20, 40, ${0.25 * pulse})`);
  corona.addColorStop(1, 'rgba(60, 0, 20, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - r * 2.5, cy - r * 2.5, r * 5, r * 5);
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 120, 100, ${0.8 * pulse})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 0.5, 0, Math.PI * 2);
  ctx.stroke();
  // Distant silhouettes: spires of the sunken ruins and drifting rocks, two layers.
  const layers = [
    { factor: 0.08, period: 140, color: '#12081a', base: 0.62, rise: 0.3 },
    { factor: 0.18, period: 96, color: '#09040c', base: 0.8, rise: 0.36 },
  ];
  layers.forEach((layer, k) => {
    const shift = mod(view.x * layer.factor, layer.period);
    const first = Math.floor((view.x * layer.factor) / layer.period);
    ctx.fillStyle = layer.color;
    for (let i = -1; i <= Math.ceil(w / layer.period) + 1; i++) {
      const id = first + i;
      const x = i * layer.period - shift;
      const tall = layer.rise * h * (0.35 + 0.65 * hash(id, k + 1));
      const foot = h * layer.base;
      const half = layer.period * (0.12 + 0.12 * hash(id, k + 7));
      ctx.beginPath();
      ctx.moveTo(x - half, h);
      ctx.lineTo(x - half, foot);
      ctx.lineTo(x - half * 0.4, foot - tall * 0.7);
      ctx.lineTo(x, foot - tall);
      ctx.lineTo(x + half * 0.5, foot - tall * 0.6);
      ctx.lineTo(x + half, foot);
      ctx.lineTo(x + half, h);
      ctx.closePath();
      ctx.fill();
      // A rock drifting above every other spire.
      if (hash(id, k + 13) < 0.5) {
        const bob = Math.sin(timeMs / 1400 + id) * 3;
        const rx = x + layer.period * 0.5;
        const ry = h * (0.2 + 0.25 * hash(id, k + 17)) + bob;
        const size = 4 + 6 * hash(id, k + 19) * (k + 1);
        ctx.beginPath();
        ctx.moveTo(rx - size, ry);
        ctx.lineTo(rx + size, ry);
        ctx.lineTo(rx + size * 0.4, ry + size * 1.1);
        ctx.lineTo(rx - size * 0.3, ry + size * 0.8);
        ctx.closePath();
        ctx.fill();
      }
    }
  });
}

/** Abyss: a wall tile is void; under a floor tile it shows the island's rocky underside, tapering into the dark. */
export function abyssWallTile(ctx: CanvasRenderingContext2D, grid: TileGrid, tx: number, ty: number): void {
  if (isWall(grid, tx, ty - 1)) return;
  const x = tx * TILE;
  const y = ty * TILE;
  const depth = 10 + Math.round(10 * hash(tx * 31 + ty, 3));
  const rock = ctx.createLinearGradient(0, y, 0, y + depth);
  rock.addColorStop(0, '#2a1620');
  rock.addColorStop(1, 'rgba(20, 8, 16, 0)');
  ctx.fillStyle = rock;
  const inset = isWall(grid, tx - 1, ty - 1) ? 4 : 0;
  const outset = isWall(grid, tx + 1, ty - 1) ? 4 : 0;
  ctx.beginPath();
  ctx.moveTo(x + inset, y);
  ctx.lineTo(x + TILE - outset, y);
  ctx.lineTo(x + TILE - outset - 5, y + depth);
  ctx.lineTo(x + inset + 6, y + depth * 0.7);
  ctx.closePath();
  ctx.fill();
}

/** Abyss: the eclipse's light catches the rims of a floor tile that borders the void. */
export function abyssRim(ctx: CanvasRenderingContext2D, grid: TileGrid, tx: number, ty: number, color: string): void {
  const x = tx * TILE;
  const y = ty * TILE;
  ctx.fillStyle = color;
  if (isWall(grid, tx, ty - 1)) ctx.fillRect(x, y, TILE, 2);
  if (isWall(grid, tx - 1, ty)) ctx.fillRect(x, y, 1, TILE);
  if (isWall(grid, tx + 1, ty)) ctx.fillRect(x + TILE - 1, y, 1, TILE);
  if (isWall(grid, tx, ty + 1)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(x, y + TILE - 3, TILE, 3);
  }
}

/** Abyss: red light falling through the view (world units), streaks drifting down at their own pace. */
export function drawFallingLight(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number): void {
  const count = 22;
  for (let i = 0; i < count; i++) {
    const speed = 30 + 50 * hash(i, 41);
    const length = 8 + 18 * hash(i, 43);
    const x = view.x + mod(hash(i, 47) * view.width + Math.sin(timeMs / 3000 + i) * 6, view.width);
    const y = view.y + mod(hash(i, 53) * (view.height + 60) + (timeMs / 1000) * speed, view.height + 60) - 30;
    const streak = ctx.createLinearGradient(0, y, 0, y + length);
    streak.addColorStop(0, 'rgba(255, 60, 50, 0)');
    streak.addColorStop(1, `rgba(255, 90, 70, ${0.25 + 0.3 * hash(i, 59)})`);
    ctx.fillStyle = streak;
    ctx.fillRect(Math.round(x), Math.round(y), 1, length);
  }
}
