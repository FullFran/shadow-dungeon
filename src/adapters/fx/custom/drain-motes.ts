import { clamp, fit, TAU } from '../../../vendor/pixelfx/core/index.js';
import type { Painter } from '../../../vendor/pixelfx/core/index.js';

/**
 * A draining hit: motes of life flowing from the target back to the user. The
 * user is the origin and the target lies along +x, at `LENGTH` (scaled to the
 * real distance when played). Made for this game in pixelfx's format.
 */
export const meta = {
  name: 'Drain motes',
  size: [132, 44],
  origin: [6, 22],
  duration: 0.8,
  loop: false,
  options: { palette: ['#123a1a', '#2f8f3f', '#6fd86a', '#c8ffb0', '#ffffff'] },
};

const LENGTH = 120;
const MOTES = 14;

export function draw(p: Painter, t: number, o: { palette: string[] }): void {
  const C = fit(o.palette, 5) as number[];
  const u = t / meta.duration;
  for (let i = 0; i < MOTES; i++) {
    // Each mote leaves a little after the one before and takes the same time to arrive.
    const left = (i / MOTES) * 0.55;
    const k = clamp((u - left) / 0.45);
    if (k <= 0 || k >= 1) continue;
    const x = LENGTH * (1 - k * k);
    const y = Math.sin(k * TAU + i * 1.9) * (4 + (i % 3) * 3) * (1 - k);
    const big = i % 3 === 0;
    p.dot(x, y, C[big ? 3 : 2] as number);
    if (big) {
      p.dot(x + 1, y, C[2] as number);
      p.dot(x, y + 1, C[2] as number);
    }
    p.light(Math.round(x), Math.round(y), C[2] as number, 0.8);
  }
}
