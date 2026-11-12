import type { Rect } from '../core/state';

/**
 * The Sima del Eclipse's backdrop (presentation only): the dark void beyond
 * the map under a faint red wash that grows as you descend, with rocks
 * drifting in two parallax layers. No sun and no skyline: the view is
 * top-down (owner, 2026-11-04). In the abyss band the rooms are rock islands
 * floating over that void, and red light falls through it.
 */
export interface SimaLook {
  floor: number;
  /** The abyss band: walls are drawn as void, floors as floating rock. */
  abyss: boolean;
}

const TILE = 32;

/** Radius (view px) of the red wash on the backdrop: it grows with depth, up to a cap. */
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
  // The eclipse's light, not the eclipse: the view is top-down, so there is no sun to see, only a faint red wash from
  // far above that grows with depth (a tint, as in the town).
  const r = eclipseRadius(look.floor);
  const cx = Math.round(w * 0.7 - mod(view.x * 0.03, w * 0.4));
  const cy = Math.round(h * 0.3 - mod(view.y * 0.02, h * 0.15));
  const pulse = 0.85 + 0.15 * Math.sin(timeMs / 900);
  const wash = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
  wash.addColorStop(0, `rgba(160, 20, 40, ${0.22 * pulse})`);
  wash.addColorStop(1, 'rgba(60, 0, 20, 0)');
  ctx.fillStyle = wash;
  ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
  // Rocks drifting in the void, two parallax layers (they sit under the floating islands).
  const layers = [
    { factor: 0.08, period: 140, color: '#12081a' },
    { factor: 0.18, period: 96, color: '#09040c' },
  ];
  layers.forEach((layer, k) => {
    const shift = mod(view.x * layer.factor, layer.period);
    const first = Math.floor((view.x * layer.factor) / layer.period);
    ctx.fillStyle = layer.color;
    for (let i = -1; i <= Math.ceil(w / layer.period) + 1; i++) {
      const id = first + i;
      const x = i * layer.period - shift;
      if (hash(id, k + 13) < 0.5) {
        const bob = Math.sin(timeMs / 1400 + id) * 3;
        const rx = x + layer.period * 0.5;
        const ry = h * (0.2 + 0.6 * hash(id, k + 17)) + bob;
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

/** A Sima elite's look: a glow in its trait's colour around the sprite (a CSS filter on the canvas). */
export const eliteFilter = (tint: string): string => `drop-shadow(0 0 1px ${tint}) drop-shadow(0 0 2px ${tint})`;
