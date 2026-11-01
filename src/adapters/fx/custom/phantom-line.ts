import { clamp, fit } from '../../../vendor/pixelfx/core/index.js';
import type { Painter } from '../../../vendor/pixelfx/core/index.js';

/**
 * Phantom Force: the user comes back cutting through everything in one long
 * line. The start is the origin and the line runs along +x, scaled to the
 * dash's real distance when played. Made for this game in pixelfx's format.
 */
export const meta = {
  name: 'Phantom line',
  size: [136, 40],
  origin: [6, 20],
  duration: 0.6,
  loop: false,
  options: { palette: ['#1a0b3a', '#3b1f73', '#8a5cf0', '#c9b0ff', '#ffffff'] },
};

const LENGTH = 124;
const WISPS = 12;

export function draw(p: Painter, t: number, o: { palette: string[] }): void {
  const C = fit(o.palette, 5) as number[];
  const u = t / meta.duration;
  // The cut races to the far end, then closes from the start.
  const head = LENGTH * clamp(u / 0.3);
  const tail = LENGTH * clamp((u - 0.35) / 0.65);
  if (head > tail) {
    const middle = (tail + head) / 2;
    const half = (head - tail) / 2;
    p.ellipse(middle, 0, half, 3.5, C[1] as number, 0.8);
    p.ellipse(middle, 0, half, 2, C[2] as number);
    p.line(tail, 0, head, 0, C[4] as number);
    p.light(Math.round(head), 0, C[3] as number, 1);
  }
  // Ghostly wisps left along the line, rising as they fade.
  for (let i = 0; i < WISPS; i++) {
    const x = ((i + 0.5) / WISPS) * LENGTH;
    if (x > head) continue;
    const age = clamp(u - (x / LENGTH) * 0.3);
    const y = (i % 2 === 0 ? -1 : 1) * (2 + age * 8) - age * 6;
    p.dot(x, y, C[i % 3 === 0 ? 3 : 2] as number, clamp(1 - age * 1.6));
  }
}
