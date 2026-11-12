import { GLOW_REACH } from './bullet-art';

/**
 * The perilous cue (docs/gdd.md §9, odd/tasks/perilous-counter.md S1): an
 * attack a roll's i-frames do not avoid (`pierceRoll`) wears a big red "!"
 * over its attacker while it winds up, and its shots wear a red spiked rim in
 * flight. Our own pixel art: a warning triangle (the shape reads without the
 * colour) with a thick white "!". Pure: cells as palette roles, the rim as
 * geometry; the renderer bakes and draws them.
 */

/** Palette roles of the mark's cells: `o` outline, `r` red, `d` red shade, `w` the white "!", `.` empty. */
export const MARK_COLORS: Readonly<Record<'o' | 'r' | 'd' | 'w', string>> = { o: '#1a0608', r: '#e8332a', d: '#9c1a16', w: '#ffffff' };

/** World pixels per cell: the mark is drawn 2x (42 px across), whole pixels so it stays crisp. */
export const MARK_CELL_PX = 2;
export const MARK_WIDTH = 21;
export const MARK_HEIGHT = 19;

/** The mark as rows of palette roles: a red warning triangle with a dark outline, a shaded base and a 3-cell white "!". */
export function perilousMarkGrid(): string[] {
  const rows: string[] = [];
  const mid = (MARK_WIDTH - 1) / 2;
  for (let y = 0; y < MARK_HEIGHT; y++) {
    let row = '';
    // The triangle widens by one cell each side every row, from a 1-cell tip.
    const half = Math.min(mid, Math.floor((y * (mid + 0.5)) / (MARK_HEIGHT - 1)));
    for (let x = 0; x < MARK_WIDTH; x++) {
      const off = Math.abs(x - mid);
      if (off > half) row += '.';
      else if (off === half || y === MARK_HEIGHT - 1) row += 'o';
      else if (y === MARK_HEIGHT - 2) row += 'd';
      else if (off <= 1 && ((y >= 6 && y <= 12) || (y >= 14 && y <= 15))) row += 'w';
      else row += 'r';
    }
    rows.push(row);
  }
  return rows;
}

/** How long the mark takes to pop in at a wind-up's start, and how big it starts. */
export const MARK_POP_MS = 160;
export const MARK_POP_SCALE = 1.6;

/** The mark's scale `modeMs` into its wind-up: it lands big and settles to 1, then breathes a little. */
export function perilousMarkScale(modeMs: number, timeMs: number): number {
  if (modeMs < MARK_POP_MS) return MARK_POP_SCALE - (MARK_POP_SCALE - 1) * (modeMs / MARK_POP_MS);
  return 1 + 0.06 * Math.sin(timeMs / 110);
}

/** One spike of the rim: a red triangle pointing out from the ring, at `angle`. */
export interface RimSpike {
  angle: number;
  inner: number;
  outer: number;
}

export interface PerilousRim {
  /** The ring's radius: always outside the bullet's colour and glow (the core is the hitbox; nothing else of the bullet changes). */
  ring: number;
  spikes: readonly RimSpike[];
  /** 0..1, the pulse of its red and white edges. */
  pulse: number;
}

export const RIM_SPIKES = 4;

/** The rim of a perilous shot of hitbox `radius` at `timeMs`: a ring past the glow, with four spikes turning slowly. */
export function perilousRim(radius: number, timeMs: number): PerilousRim {
  const ring = Math.ceil(radius * GLOW_REACH) + 2;
  const turn = (timeMs / 900) % (Math.PI * 2);
  const pulse = 0.5 + 0.5 * Math.sin(timeMs / 85);
  const spikes = Array.from({ length: RIM_SPIKES }, (_, i) => ({ angle: turn + (i * Math.PI * 2) / RIM_SPIKES, inner: ring, outer: ring + 3 + Math.round(radius / 4) }));
  return { ring, spikes, pulse };
}
