import { isWall, type TileGrid, type TilePoint } from '../core/tiles';
import type { Rect } from '../core/state';
import { decorHash } from './crypt-decor';

/**
 * The Flooded Caves' atmosphere, drawn in code (docs/gdd.md §3, Cuevas
 * Inundadas): shallow pools with moving glints and a darker deep edge where
 * the water meets the rock, crystals glowing on the lit wall faces, and
 * drops falling from the ceiling that ripple where they land. Placement is a
 * pure function of the floor (a fixed tile hash), so it never flickers and
 * every peer sees the same caves; the drawing takes the canvas context.
 */
export interface CaveDecor {
  /** Lit wall faces (wall tile with floor below) carrying a crystal. */
  crystals: readonly TilePoint[];
  /** Wall faces a drop falls from (onto the floor tile below). */
  drips: readonly TilePoint[];
}

const CRYSTAL_SHARE = 0.16;
const DRIP_SHARE = 0.09;
const TILE = 32;

export function caveDecor(grid: TileGrid): CaveDecor {
  const crystals: TilePoint[] = [];
  const drips: TilePoint[] = [];
  for (let y = 0; y < grid.rows - 1; y++) {
    for (let x = 0; x < grid.cols; x++) {
      if (!isWall(grid, x, y) || isWall(grid, x, y + 1)) continue;
      if (decorHash(x, y, 21) < CRYSTAL_SHARE) crystals.push({ x, y });
      else if (decorHash(x, y, 22) < DRIP_SHARE) drips.push({ x, y });
    }
  }
  return { crystals, drips };
}

/** A shallow water tile at (x, y) px: `deep` when it borders rock (a darker edge), glints moving with time. */
export function waterTile(ctx: CanvasRenderingContext2D, x: number, y: number, tx: number, ty: number, timeMs: number, deep: boolean): void {
  ctx.fillStyle = deep ? 'rgba(10, 40, 70, 0.78)' : 'rgba(40, 110, 150, 0.5)';
  ctx.fillRect(x, y, TILE, TILE);
  if (deep) {
    ctx.fillStyle = 'rgba(4, 18, 34, 0.55)';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
  }
  const phase = decorHash(tx, ty, 7) * Math.PI * 2;
  for (let i = 0; i < 2; i++) {
    const wave = Math.sin(timeMs / 520 + phase + i * 2.1);
    ctx.fillStyle = `rgba(170, 225, 255, ${0.16 + 0.14 * wave})`;
    const gx = x + 4 + Math.round((decorHash(tx, ty, 30 + i) * 18 + timeMs / 160) % 22);
    ctx.fillRect(gx, y + 8 + i * 13, 6, 1);
  }
}

/** A crystal growing on a lit wall face, pulsing, with a cold glow on the floor below. */
export function crystal(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, look: number): void {
  const pulse = 0.7 + 0.3 * Math.sin(timeMs / 700 + look * 30);
  const violet = look < 0.35;
  const cx = x + 8 + Math.round(look * 16);
  const base = y + TILE - 4;
  const glow = ctx.createRadialGradient(cx, base + 6, 1, cx, base + 6, 34);
  glow.addColorStop(0, violet ? `rgba(190, 140, 255, ${0.3 * pulse})` : `rgba(120, 230, 255, ${0.3 * pulse})`);
  glow.addColorStop(1, 'rgba(120, 230, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 34, base - 28, 68, 68);
  ctx.fillStyle = violet ? '#8c6ad8' : '#4fb6d8';
  ctx.beginPath();
  ctx.moveTo(cx - 5, base);
  ctx.lineTo(cx - 2, base - 13);
  ctx.lineTo(cx + 1, base);
  ctx.moveTo(cx, base);
  ctx.lineTo(cx + 4, base - 9);
  ctx.lineTo(cx + 7, base);
  ctx.fill();
  ctx.fillStyle = `rgba(235, 250, 255, ${0.6 + 0.4 * pulse})`;
  ctx.fillRect(cx - 2, base - 11, 1, 6);
}

/** A drop falling from a wall face to the floor below, a ripple where it lands. */
export function drip(ctx: CanvasRenderingContext2D, x: number, y: number, timeMs: number, look: number): void {
  const period = 1600 + look * 1400;
  const t = ((timeMs + look * 5000) % period) / period;
  const cx = x + 6 + Math.round(look * 20);
  const top = y + TILE - 2;
  const fall = 26;
  if (t < 0.55) {
    const drop = top + fall * (t / 0.55) ** 2;
    ctx.fillStyle = 'rgba(170, 225, 255, 0.85)';
    ctx.fillRect(cx, Math.round(drop), 1, 3);
  } else {
    const r = 2 + 9 * ((t - 0.55) / 0.45);
    ctx.strokeStyle = `rgba(170, 225, 255, ${0.7 * (1 - (t - 0.55) / 0.45)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, top + fall + 2, r, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/** A fixed caves arena: the whole floor is ankle-deep water with drifting caustics. */
export function cavesArena(ctx: CanvasRenderingContext2D, width: number, height: number, timeMs: number): void {
  ctx.fillStyle = 'rgba(30, 90, 130, 0.28)';
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 26; i++) {
    const x = (decorHash(i, 1, 3) * width + timeMs / (70 + i * 3)) % width;
    const y = decorHash(i, 2, 4) * height;
    const a = 0.08 + 0.08 * Math.sin(timeMs / 600 + i);
    ctx.fillStyle = `rgba(170, 230, 255, ${a})`;
    ctx.fillRect(Math.round(x), Math.round(y), 14 + Math.round(decorHash(i, 3, 5) * 16), 1);
  }
  for (let x = 40; x < width - 20; x += 120) crystal(ctx, x - 16, -TILE, timeMs, decorHash(x, 0, 11));
}

/** A cover block of a caves arena: a long one is the sunken ship's broken hull, the others crystal-capped rocks. */
export function caveCover(ctx: CanvasRenderingContext2D, rect: Rect, lift: number, timeMs: number): void {
  const { x, y, width: w, height: h } = rect;
  if (w > h * 1.8) {
    // Hull: dark wet planks with ribs, barnacles and a torn edge.
    ctx.fillStyle = '#2a1d14';
    ctx.fillRect(x, y - lift + h - 4, w, lift + 4);
    ctx.fillStyle = '#4a3322';
    ctx.fillRect(x, y - lift, w, h);
    ctx.fillStyle = '#5e4330';
    for (let py = y - lift + 4; py < y - lift + h; py += 8) ctx.fillRect(x + 2, py, w - 4, 2);
    ctx.fillStyle = '#20160f';
    for (let rx = x + 10; rx < x + w - 6; rx += 22) ctx.fillRect(rx, y - lift, 3, h);
    ctx.fillStyle = '#9ab8a8';
    for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x + 8 + decorHash(x, i, 6) * (w - 16)), Math.round(y - lift + 4 + decorHash(y, i, 7) * (h - 8)), 2, 2);
    return;
  }
  ctx.fillStyle = '#1b2a33';
  ctx.fillRect(x, y - lift + h - 4, w, lift + 4);
  ctx.fillStyle = '#2f4652';
  ctx.fillRect(x + 2, y - lift, w - 4, h);
  ctx.fillStyle = '#3b5664';
  ctx.fillRect(x + 6, y - lift + 2, w - 14, 4);
  crystal(ctx, x + w / 2 - 20, y - lift - TILE + 10, timeMs, decorHash(x, y, 13));
}

/** Inundación: the rising water over the whole view, deeper blue and livelier waves as `level` (0..1) climbs. */
export function floodVeil(ctx: CanvasRenderingContext2D, view: Rect, level: number, timeMs: number): void {
  if (level <= 0) return;
  ctx.fillStyle = `rgba(30, 90, 150, ${0.12 + 0.3 * level})`;
  ctx.fillRect(view.x - 20, view.y - 20, view.width + 40, view.height + 40);
  const rows = 10;
  for (let i = 0; i < rows; i++) {
    const y = view.y + ((i + 0.5) * view.height) / rows + Math.sin(timeMs / 700 + i) * 4;
    ctx.fillStyle = `rgba(180, 230, 255, ${0.06 + 0.12 * level})`;
    for (let x = view.x - 40 + ((timeMs / (40 + i * 4)) % 80); x < view.x + view.width; x += 80) ctx.fillRect(Math.round(x), Math.round(y), 22, 1);
  }
}

/** True when a shallow tile borders a wall (drawn as the deep edge). */
export const deepEdge = (grid: TileGrid, x: number, y: number): boolean => isWall(grid, x - 1, y) || isWall(grid, x + 1, y) || isWall(grid, x, y - 1) || isWall(grid, x, y + 1);
