import { clamp, fit, TAU } from '../../../vendor/pixelfx/core/index.js';
import type { Painter } from '../../../vendor/pixelfx/core/index.js';

/** Will-O-Wisp: several tiny ghost flames drifting round the user, flickering. Made for this game in pixelfx's format. */
export const meta = {
  name: 'Wisp orbit',
  size: [92, 80],
  origin: [46, 62],
  duration: 1.4,
  loop: false,
  options: { palette: ['#123a5e', '#1f6fa8', '#39b4e6', '#9fe9ff', '#ffffff'] },
};

const WISPS = 5;

function wisp(p: Painter, C: number[], x: number, y: number, flicker: number, fade: number): void {
  const h = 6 + flicker * 2;
  p.ellipse(x, y, 3, 2.5, C[1] as number, fade);
  p.tri(x - 2.5, y, x + 2.5, y, x + flicker, y - h, C[2] as number, fade);
  p.tri(x - 1.2, y, x + 1.2, y, x + flicker * 0.5, y - h * 0.6, C[3] as number, fade);
  p.dot(x, y - 1, C[4] as number, fade);
  p.light(Math.round(x), Math.round(y - 2), C[2] as number, 0.9 * fade);
}

export function draw(p: Painter, t: number, o: { palette: string[] }): void {
  const C = fit(o.palette, 5) as number[];
  const u = t / meta.duration;
  const grow = clamp(u / 0.25);
  const fade = clamp((1 - u) / 0.25);
  for (let i = 0; i < WISPS; i++) {
    const a = u * TAU + (i / WISPS) * TAU;
    const rise = Math.sin(u * TAU * 2 + i * 1.7) * 3;
    wisp(p, C, Math.cos(a) * 26 * grow, -18 + Math.sin(a) * 10 * grow + rise, Math.sin(u * TAU * 7 + i * 2.1), fade);
  }
}
