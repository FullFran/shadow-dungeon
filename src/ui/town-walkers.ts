import { SPRITE_KEYS } from '../data/sprites';

/**
 * The residents of Dusk Haven walking the title's backdrop (odd/tasks/title-hub.md T5;
 * docs/gdd.md "El mundo"): Mimikyu by its gacha stall and Gastly the storyteller by the
 * notice board, each keeping to its corner. Positions are a pure function of time
 * (stroll to a seeded point, rest, again), in 0..1 canvas units.
 */
export interface Resident {
  id: string;
  sprite: string;
  /** Where it may stand (feet), as fractions of the canvas; a zero-size area keeps it still. */
  area: { x0: number; x1: number; y0: number; y1: number };
  /** Floats above its feet point (a ghost, a balloon), in canvas pixels at depth 1. */
  float?: number;
  /** The prop of src/ui/dusk-haven.ts it keeps to (its stall, its forge, its tree...). */
  prop?: string;
  /** Rows to face while resting (PMD order), default the way it last walked. */
  restDir?: number;
}

// Owner, 2026-11-03: only Mimikyu (its gacha stall) and Gastly (the storyteller, by the board).
// Owner, 2026-11-03: only Mimikyu (its gacha stall) and Gastly (the storyteller, by the board).
export const TOWN_RESIDENTS: readonly Resident[] = [
  { id: 'mimikyu', sprite: SPRITE_KEYS.mimikyu, prop: 'stall', area: { x0: 0.435, x1: 0.47, y0: 0.73, y1: 0.8 } },
  { id: 'gastly', sprite: SPRITE_KEYS.gastly, prop: 'board', area: { x0: 0.53, x1: 0.56, y0: 0.7, y1: 0.765 }, float: 12 },
];

/** Deterministic 0..1 hash of an integer. */
function hash(n: number): number {
  let x = Math.imul(n ^ 0x2c1b3c6d, 0x297a2d39);
  x ^= x >>> 15;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 4294967296;
}

const seedOf = (id: string): number => [...id].reduce((s, c) => Math.imul(s ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

/** The PMD sheet row for a heading (y grows downwards): 0 down, 1 down-right, 2 right ... 7 down-left. */
export function directionRow(dx: number, dy: number): number {
  const steps = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return (((2 - steps) % 8) + 8) % 8;
}

/** Share of each stretch spent walking; the rest is a pause. */
const WALK_SHARE = 0.45;

export function walkerAt(r: Resident, ms: number): { x: number; y: number; dir: number; moving: boolean } {
  const seed = seedOf(r.id);
  const stretch = 6500 + hash(seed) * 3500;
  const time = ms + hash(seed + 1) * stretch * 10;
  const k = Math.floor(time / stretch);
  const t = (time - k * stretch) / stretch;
  const point = (i: number) => ({
    x: r.area.x0 + hash(seed * 31 + i * 2) * (r.area.x1 - r.area.x0),
    y: r.area.y0 + hash(seed * 31 + i * 2 + 1) * (r.area.y1 - r.area.y0),
  });
  const from = point(k - 1);
  const to = point(k);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const still = Math.abs(dx) + Math.abs(dy) < 1e-6;
  const dir = still ? (r.restDir ?? 0) : directionRow(dx, dy * 2);
  if (t < WALK_SHARE && !still) {
    const e = t / WALK_SHARE;
    return { x: from.x + dx * e, y: from.y + dy * e, dir, moving: true };
  }
  return { x: to.x, y: to.y, dir: r.restDir ?? dir, moving: false };
}
