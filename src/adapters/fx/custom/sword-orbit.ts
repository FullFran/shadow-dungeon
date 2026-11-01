import { clamp, fit, TAU } from '../../../vendor/pixelfx/core/index.js';
import type { Painter } from '../../../vendor/pixelfx/core/index.js';

/** Swords Dance: little swords whirling round the user on a tilted ring, each spinning on itself. Made for this game in pixelfx's format. */
export const meta = {
  name: 'Sword orbit',
  size: [100, 76],
  origin: [50, 60],
  duration: 1,
  loop: false,
  options: { palette: ['#20242e', '#4a5364', '#8c97aa', '#c8d2dc', '#ffffff'] },
};

const SWORDS = 6;
const RING = { rx: 32, ry: 12, y: -20 };
const BLADE = 9;

function sword(p: Painter, C: number[], x: number, y: number, a: number, fade: number): void {
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tipX = x + dx * BLADE;
  const tipY = y + dy * BLADE;
  p.line(x, y, tipX, tipY, C[3] as number, fade);
  p.line(x - dy, y + dx, tipX - dy * 0.5, tipY + dx * 0.5, C[2] as number, fade);
  // The guard across, and the grip behind it.
  p.line(x - dy * 2.5, y + dx * 2.5, x + dy * 2.5, y - dx * 2.5, C[1] as number, fade);
  p.line(x, y, x - dx * 3, y - dy * 3, C[0] as number, fade);
  p.light(Math.round(tipX), Math.round(tipY), C[4] as number, 0.8 * fade);
}

function swords(p: Painter, t: number, o: { palette: string[] }, back: boolean): void {
  const C = fit(o.palette, 5) as number[];
  const u = t / meta.duration;
  // Out of the body, a good whirl, then gone.
  const grow = clamp(u / 0.2);
  const fade = clamp((1 - u) / 0.25);
  const turn = u * TAU * 1.5;
  for (let i = 0; i < SWORDS; i++) {
    const a = turn + (i / SWORDS) * TAU;
    if (Math.sin(a) < 0 !== back) continue;
    const x = Math.cos(a) * RING.rx * grow;
    const y = RING.y + Math.sin(a) * RING.ry * grow;
    sword(p, C, x, y, a * 2.5 + i, fade);
  }
}

export const drawBack = (p: Painter, t: number, o: { palette: string[] }): void => swords(p, t, o, true);
export const draw = (p: Painter, t: number, o: { palette: string[] }): void => swords(p, t, o, false);
