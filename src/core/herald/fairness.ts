import { scaledTelegraphMs, type Difficulty } from '../../data/difficulty';
import { ENEMY_SHOT_CAP } from '../../data/enemies';
import { HERALD_FAIRNESS, type HeraldCard, type HeraldLayer } from '../../data/herald';
import { TUNING } from '../../data/tuning';
import { vec, type Vec2 } from '../vec';
import { aimedThreat, asksChoice, emitPart, partTimes, type EmitContext } from './patterns';

/**
 * The heralds' fairness proof (docs/souls-difficulty-research.md P4, P5):
 * hard constraints a generated card must pass before it may be played
 * (core/herald/generate.ts rejects the ones that fail).
 *
 * Analytic: the wind-up floor after the tier's scaling (400 ms when the card
 * asks for a choice, 280 ms otherwise), laser warnings, at most 2 aimed
 * threats, at most 3 layers, density and speed never both above x1.3 and
 * their product capped, homing orbs slow and few, tracking streams that a
 * sidestep beats.
 *
 * Simulated: the card's whole cycle is played on a grid (8 px cells, a step
 * every `cell / player speed` ms so one step is one cell of walking) from
 * the start of its wind-up until its last shot is gone, from every attack
 * anchor and from 9 start positions (aimed layers re-aimed at each). Each
 * shot's swept capsule over a step, inflated by the player's radius and
 * half a cell, marks the cells it threatens; burning pockets mark
 * everything outside them. The player's reachable cells walk one cell per
 * step (4-neighbour, so diagonals are slower than real: conservative) and
 * may never stand on a marked cell before or after a step; the card is fair
 * only if every start keeps at least one cell to the end. Rolls are ignored
 * (they only help), cover is ignored for shots (it only stops them) but its
 * blocks are not walkable. Tracking streams and homing orbs are excluded
 * from the grid (they follow the player) and checked analytically instead.
 * The peak of shots in the air must stay under the boss's cap, so the cap
 * never decides the pattern.
 */
const CELL = 8;

export interface FairnessEnv {
  arena: { width: number; height: number; obstacles?: readonly { x: number; y: number; width: number; height: number }[] };
  /** Where the herald attacks from. */
  origins: readonly Vec2[];
  bossRadius: number;
  tier: Difficulty;
  maxShots: number;
  playerRadius?: number;
  playerSpeed?: number;
  /** Start positions (default: a 3 x 3 grid over the lower two thirds of the arena). */
  starts?: readonly Vec2[];
}

export interface FairnessReport {
  ok: boolean;
  failures: string[];
  /** Most enemy shots in the air at once (worst anchor and start). */
  peakShots: number;
  /** When the cycle's last shot is gone, ms after the attack starts (worst case). */
  clearMs: number;
}

export const defaultStarts = (arena: { width: number; height: number }): Vec2[] =>
  [0.58, 0.74, 0.9].flatMap((fy) => [0.18, 0.5, 0.82].map((fx) => vec(Math.round(arena.width * fx), Math.round(arena.height * fy))));

interface SimShot {
  t0: number;
  t1: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

/** Time until a shot leaving `at` with velocity `v` (px/ms) is outside the arena. */
function exitMs(x: number, y: number, vx: number, vy: number, w: number, h: number): number {
  if (x < 0 || y < 0 || x > w || y > h) return 0;
  const tx = vx > 0 ? (w - x) / vx : vx < 0 ? x / -vx : Infinity;
  const ty = vy > 0 ? (h - y) / vy : vy < 0 ? y / -vy : Infinity;
  return Math.min(tx, ty);
}

/** The shots of `layers` for one anchor and mark, as straight segments in time. */
function simShots(layers: readonly HeraldLayer[], ctx: EmitContext): SimShot[] {
  const out: SimShot[] = [];
  for (const layer of layers) {
    if (layer.kind === 'homing' || (layer.kind === 'stream' && layer.aim === 'tracking')) continue;
    partTimes(layer).forEach((t, k) => {
      for (const s of emitPart(layer, k, t, ctx)) {
        const vx = (s.dir.x * s.shot.speed) / 1000;
        const vy = (s.dir.y * s.shot.speed) / 1000;
        const life = Math.min(s.shot.lifetimeMs, exitMs(s.at.x, s.at.y, vx, vy, ctx.arena.width, ctx.arena.height));
        if (life <= 0) continue;
        out.push({ t0: t, t1: t + life, x: s.at.x, y: s.at.y, vx, vy, r: s.shot.radius });
      }
    });
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

/** Peak of shots alive at once, counting every layer (homing and tracking ones too, at their lifetime). */
function peakOf(layers: readonly HeraldLayer[], ctx: EmitContext, sims: readonly SimShot[]): number {
  const events: [number, number][] = [];
  for (const s of sims) events.push([s.t0, 1], [s.t1, -1]);
  for (const layer of layers) {
    if (layer.kind !== 'homing' && !(layer.kind === 'stream' && layer.aim === 'tracking')) continue;
    partTimes(layer).forEach((t, k) => {
      const n = emitPart(layer, k, t, ctx).length;
      const life = layer.kind === 'homing' ? layer.shot.lifetimeMs : Math.min(layer.shot.lifetimeMs, (Math.hypot(ctx.arena.width, ctx.arena.height) / layer.shot.speed) * 1000);
      events.push([t, n], [t + life, -n]);
    });
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0;
  let peak = 0;
  for (const [, d] of events) {
    now += d;
    peak = Math.max(peak, now);
  }
  return peak;
}

/** A bit grid of cells (rows of 32-bit words). */
class Grid {
  readonly words: number;
  readonly data: Uint32Array;
  constructor(
    readonly cols: number,
    readonly rows: number,
  ) {
    this.words = Math.ceil(cols / 32);
    this.data = new Uint32Array(this.words * rows);
  }
  set(c: number, r: number): void {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return;
    this.data[r * this.words + (c >> 5)]! |= 1 << (c & 31);
  }
  get(c: number, r: number): boolean {
    return (this.data[r * this.words + (c >> 5)]! & (1 << (c & 31))) !== 0;
  }
  any(): boolean {
    for (let i = 0; i < this.data.length; i++) if (this.data[i] !== 0) return true;
    return false;
  }
}

/**
 * Marks every cell whose centre lies within `radius` of the segment p0-p1: a
 * short segment as one circle around its middle (radius + half its length,
 * which covers the capsule), a long one (lasers) as circles every radius/2.
 */
function markCapsule(g: Grid, x0: number, y0: number, x1: number, y1: number, radius: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const short = len <= radius * 0.5;
  const n = short ? 0 : Math.ceil(len / (radius * 0.5));
  const rr = radius + 1 + (short ? len / 2 : 0);
  for (let i = 0; i <= n; i++) {
    const cx = short ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / n;
    const cy = short ? (y0 + y1) / 2 : y0 + ((y1 - y0) * i) / n;
    const r0 = Math.max(0, Math.ceil((cy - rr) / CELL - 0.5));
    const r1 = Math.min(g.rows - 1, Math.floor((cy + rr) / CELL - 0.5));
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5) * CELL - cy;
      const half = Math.sqrt(Math.max(0, rr * rr - dy * dy));
      const c0 = Math.max(0, Math.ceil((cx - half) / CELL - 0.5));
      const c1 = Math.min(g.cols - 1, Math.floor((cx + half) / CELL - 0.5));
      if (c1 >= c0) setSpan(g.data, r * g.words, c0, c1);
    }
  }
}

/** Sets bits c0..c1 of the row starting at word `base`, a word at a time. */
function setSpan(data: Uint32Array, base: number, c0: number, c1: number): void {
  for (let w = c0 >> 5; w <= c1 >> 5; w++) {
    const lo = w === c0 >> 5 ? c0 & 31 : 0;
    const hi = w === c1 >> 5 ? c1 & 31 : 31;
    const bits = hi - lo === 31 ? 0xffffffff : ((1 << (hi - lo + 1)) - 1) << lo;
    data[base + w]! |= bits;
  }
}

/** reach := dilate4(reach & ~unsafe) & ~unsafe & valid in place (unsafe = `base` | `own`), via `tmp`; whether any cell is left. */
function walk(reach: Grid, base: Uint32Array, own: Uint32Array | null, valid: Grid, tmp: Uint32Array): boolean {
  const { words: W, rows } = reach;
  const a = reach.data;
  for (let i = 0; i < a.length; i++) tmp[i] = a[i]! & ~(base[i]! | (own ? own[i]! : 0));
  let any = 0;
  for (let r = 0; r < rows; r++) {
    for (let w = 0; w < W; w++) {
      const i = r * W + w;
      const v = tmp[i]!;
      const left = (v << 1) | (w > 0 ? tmp[i - 1]! >>> 31 : 0);
      const right = (v >>> 1) | (w < W - 1 ? tmp[i + 1]! << 31 : 0);
      const up = r > 0 ? tmp[i - W]! : 0;
      const down = r < rows - 1 ? tmp[i + W]! : 0;
      const next = (v | left | right | up | down) & ~(base[i]! | (own ? own[i]! : 0)) & valid.data[i]!;
      a[i] = next;
      any |= next;
    }
  }
  return any !== 0;
}

function validGrid(cols: number, rows: number, env: FairnessEnv, origin: Vec2, pr: number): Grid {
  const g = new Grid(cols, rows);
  const { width: w, height: h } = env.arena;
  const blocks = env.arena.obstacles ?? [];
  for (let r = 0; r < rows; r++) {
    const y = (r + 0.5) * CELL;
    for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * CELL;
      if (x < pr || y < pr || x > w - pr || y > h - pr) continue;
      if (Math.hypot(x - origin.x, y - origin.y) <= env.bossRadius + pr + CELL / 2) continue;
      if (blocks.some((o) => x > o.x - pr && x < o.x + o.width + pr && y > o.y - pr && y < o.y + o.height + pr)) continue;
      g.set(c, r);
    }
  }
  return g;
}

/** The valid cell nearest to `p`, or null. */
function nearestValid(valid: Grid, p: Vec2): [number, number] | null {
  let best: [number, number] | null = null;
  let bestD = Infinity;
  const pc = Math.floor(p.x / CELL);
  const pr = Math.floor(p.y / CELL);
  for (let r = Math.max(0, pr - 4); r <= Math.min(valid.rows - 1, pr + 4); r++)
    for (let c = Math.max(0, pc - 4); c <= Math.min(valid.cols - 1, pc + 4); c++) {
      if (!valid.get(c, r)) continue;
      const d = Math.hypot((c + 0.5) * CELL - p.x, (r + 0.5) * CELL - p.y);
      if (d < bestD) {
        bestD = d;
        best = [c, r];
      }
    }
  return bestD <= CELL * 3 ? best : null;
}

/** Rasterises the shots alive in [t, t + dt) into `unsafe` (`from` keeps the sorted scan's place). */
function markShots(unsafe: Grid, shots: readonly SimShot[], t: number, dtMs: number, pr: number, box?: Box): void {
  const t1 = t + dtMs;
  const reachR = pr + CELL / 2 + 8;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]!;
    if (s.t0 >= t1) break;
    if (s.t1 <= t) continue;
    const a = Math.max(t, s.t0) - s.t0;
    const b = Math.min(t1, s.t1) - s.t0;
    if (box) {
      // Far from every cell the player can be in this step: it cannot matter.
      const xa = s.x + s.vx * a;
      const xb = s.x + s.vx * b;
      const ya = s.y + s.vy * a;
      const yb = s.y + s.vy * b;
      const m = s.r + reachR;
      if (Math.max(xa, xb) + m < box.x0 || Math.min(xa, xb) - m > box.x1 || Math.max(ya, yb) + m < box.y0 || Math.min(ya, yb) - m > box.y1) continue;
    }
    markCapsule(unsafe, s.x + s.vx * a, s.y + s.vy * a, s.x + s.vx * b, s.y + s.vy * b, s.r + pr + CELL / 2);
  }
}

/** The cells outside every pocket (where a burning pocket layer hurts). */
function pocketBurn(p: Extract<HeraldLayer, { kind: 'pockets' }>, valid: Grid): Uint32Array {
  const g = new Grid(valid.cols, valid.rows);
  for (let r = 0; r < valid.rows; r++)
    for (let c = 0; c < valid.cols; c++) {
      const x = (c + 0.5) * CELL;
      const y = (r + 0.5) * CELL;
      if (!p.pockets.some((q) => Math.hypot(x - q.x, y - q.y) <= p.radius - CELL / 2 - 1)) g.set(c, r);
    }
  for (let j = 0; j < g.data.length; j++) g.data[j]! &= valid.data[j]!;
  return g.data;
}

/** The unsafe cells of every step from `fromMs` for the shots and pockets that do not depend on the player (shared by every start). */
function timeline(shots: readonly SimShot[], pockets: readonly Extract<HeraldLayer, { kind: 'pockets' }>[], valid: Grid, fromMs: number, steps: number, dtMs: number, pr: number): Uint32Array[] {
  const burns = pockets.map((p) => pocketBurn(p, valid));
  const out: Uint32Array[] = [];
  for (let k = 0; k < steps; k++) {
    const t = fromMs + k * dtMs;
    const unsafe = new Grid(valid.cols, valid.rows);
    markShots(unsafe, shots, t, dtMs, pr);
    pockets.forEach((p, i) => {
      const on = p.startMs + p.warnMs;
      if (t + dtMs > on && t < on + p.flashMs) for (let j = 0; j < unsafe.data.length; j++) unsafe.data[j]! |= burns[i]![j]!;
    });
    out.push(unsafe.data);
  }
  return out;
}

/** Whether a player starting at `start` survives every step: the shared timeline plus this start's own (aimed) shots. */
function survives(base: readonly Uint32Array[], own: readonly SimShot[], valid: Grid, start: [number, number], fromMs: number, dtMs: number, pr: number): boolean {
  const reach = new Grid(valid.cols, valid.rows);
  reach.set(start[0], start[1]);
  const unsafe = new Grid(valid.cols, valid.rows);
  const tmp = new Uint32Array(reach.data.length);
  for (let k = 0; k < base.length; k++) {
    if (own.length > 0) {
      unsafe.data.fill(0);
      markShots(unsafe, own, fromMs + k * dtMs, dtMs, pr, boxOf(reach));
    }
    if (!walk(reach, base[k]!, own.length > 0 ? unsafe.data : null, valid, tmp)) return false;
  }
  return true;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The pixel box around the reachable cells, one step of walking wider. */
function boxOf(g: Grid): Box {
  let r0 = -1;
  let r1 = -1;
  let cols = new Uint32Array(g.words);
  for (let r = 0; r < g.rows; r++) {
    let any = 0;
    for (let w = 0; w < g.words; w++) {
      const v = g.data[r * g.words + w]!;
      any |= v;
      cols[w]! |= v;
    }
    if (any !== 0) {
      if (r0 < 0) r0 = r;
      r1 = r;
    }
  }
  let c0 = 0;
  let c1 = g.cols - 1;
  for (let c = 0; c < g.cols; c++) if (cols[c >> 5]! & (1 << (c & 31))) { c0 = c; break; }
  for (let c = g.cols - 1; c >= 0; c--) if (cols[c >> 5]! & (1 << (c & 31))) { c1 = c; break; }
  cols = cols.fill(0);
  return { x0: (c0 - 1) * CELL, y0: (r0 - 1) * CELL, x1: (c1 + 2) * CELL, y1: (r1 + 2) * CELL };
}

/** Layers whose shots depend on where the player stood (the mark): simulated once per start; the rest once per anchor. */
const followsMark = (l: HeraldLayer): boolean =>
  l.kind === 'lanes' || l.kind === 'closing' || l.kind === 'stream' || ((l.kind === 'ring' || l.kind === 'wave' || l.kind === 'scatter' || l.kind === 'laser') && l.aim === 'aimed');

/** Every hard constraint on one card; `ok` only when there is no failure. */
export function checkCard(card: Pick<HeraldCard, 'telegraphMs' | 'layers' | 'density' | 'speed'>, env: FairnessEnv): FairnessReport {
  const pr = env.playerRadius ?? TUNING.player.radius;
  const ps = env.playerSpeed ?? TUNING.player.moveSpeed;
  const failures: string[] = [];
  const layers = card.layers;
  if (layers.length === 0) failures.push('no layers');
  if (layers.length > HERALD_FAIRNESS.maxLayers) failures.push(`layers ${layers.length} > ${HERALD_FAIRNESS.maxLayers}`);
  // Wind-up floor after the tier's scaling.
  const choice = layers.some(asksChoice);
  const floor = choice ? HERALD_FAIRNESS.choiceTelegraphMs : HERALD_FAIRNESS.plainTelegraphMs;
  const tele = scaledTelegraphMs(card.telegraphMs, env.tier);
  if (tele < floor) failures.push(`telegraph ${Math.round(tele)} < ${floor}`);
  for (const l of layers) if (l.kind === 'laser' && l.warnMs < HERALD_FAIRNESS.laserWarnMs) failures.push(`laser warning ${l.warnMs} < ${HERALD_FAIRNESS.laserWarnMs}`);
  // Aimed threats.
  const aimed = layers.filter(aimedThreat).length;
  if (aimed > HERALD_FAIRNESS.maxAimed) failures.push(`aimed threats ${aimed} > ${HERALD_FAIRNESS.maxAimed}`);
  if (layers.filter((l) => l.kind === 'summon').length > 1) failures.push('more than one summon');
  // Density x speed.
  if (card.density > HERALD_FAIRNESS.knobLimit && card.speed > HERALD_FAIRNESS.knobLimit) failures.push('density and speed both above x1.3');
  if (card.density * card.speed > HERALD_FAIRNESS.maxProduct) failures.push(`density x speed ${(card.density * card.speed).toFixed(2)} > ${HERALD_FAIRNESS.maxProduct}`);
  // Followers, analytically.
  const starts = env.starts ?? defaultStarts(env.arena);
  const nearest = Math.min(...env.origins.flatMap((o) => starts.map((s) => Math.hypot(s.x - o.x, s.y - o.y))));
  for (const l of layers) {
    if (l.kind === 'homing') {
      if (l.shot.speed > ps * HERALD_FAIRNESS.homingSpeedShare) failures.push(`homing orbs too fast (${l.shot.speed})`);
      if (l.orbs > HERALD_FAIRNESS.maxOrbs) failures.push(`homing orbs ${l.orbs} > ${HERALD_FAIRNESS.maxOrbs}`);
      if (!l.shot.steer || l.shot.steer.degPerSec > 120) failures.push('homing orbs steer too hard');
    }
    if (l.kind === 'stream' && l.aim === 'tracking') {
      const half = nearest * Math.tan(((l.spreadDeg / 2) * Math.PI) / 180);
      const sidestep = (l.shot.radius + pr + half) / ps;
      const flight = nearest / l.shot.speed;
      if (sidestep > 0.8 * flight) failures.push('tracking stream outpaces a sidestep');
      if (l.everyMs < 200) failures.push('tracking stream too frequent');
    }
  }
  // The simulation only for cards that pass the cheap rules.
  if (failures.length > 0) return { ok: false, failures, peakShots: 0, clearMs: 0 };
  const cols = Math.ceil(env.arena.width / CELL);
  const rows = Math.ceil(env.arena.height / CELL);
  const dtMs = (CELL / ps) * 1000;
  const pockets = layers.filter((l): l is Extract<HeraldLayer, { kind: 'pockets' }> => l.kind === 'pockets');
  let peakShots = 0;
  let clearMs = 0;
  const shared = layers.filter((l) => !followsMark(l));
  const personal = layers.filter(followsMark);
  const followers = layers.filter((l): l is Extract<HeraldLayer, { kind: 'homing' | 'stream' }> => l.kind === 'homing' || (l.kind === 'stream' && l.aim === 'tracking'));
  const followEnd = Math.max(0, ...followers.map((l) => Math.max(...partTimes(l)) + l.shot.lifetimeMs));
  const pocketEnd = Math.max(0, ...pockets.map((p) => p.startMs + p.warnMs + p.flashMs));
  for (const origin of env.origins) {
    const valid = validGrid(cols, rows, env, origin, pr);
    const ctx0: EmitContext = { origin, bossRadius: env.bossRadius, mark: origin, arena: env.arena };
    const sharedShots = simShots(shared, ctx0);
    const runs = starts.map((start) => {
      const ctx: EmitContext = { ...ctx0, mark: start };
      const own = simShots(personal, ctx);
      const all = [...sharedShots, ...own].sort((x, y) => x.t0 - y.t0);
      peakShots = Math.max(peakShots, peakOf(layers, ctx, all));
      return { start, cell: nearestValid(valid, start), own, end: Math.max(0, ...own.map((x) => x.t1)) };
    });
    const end = Math.max(pocketEnd, ...sharedShots.map((x) => x.t1), ...runs.map((r) => r.end));
    clearMs = Math.max(clearMs, end, followEnd);
    const steps = Math.ceil((end + dtMs + tele) / dtMs);
    const base = timeline(sharedShots, pockets, valid, -tele, steps, dtMs, pr);
    for (const run of runs) {
      if (!run.cell) continue;
      if (!survives(base, run.own, valid, run.cell, -tele, dtMs, pr)) {
        failures.push(`no safe path from (${run.start.x}, ${run.start.y}) with the herald at (${Math.round(origin.x)}, ${Math.round(origin.y)})`);
        // One trapped start is enough to reject the card.
        return { ok: false, failures, peakShots, clearMs };
      }
    }
  }
  const cap = Math.min(env.maxShots, ENEMY_SHOT_CAP);
  if (peakShots > cap) failures.push(`peak shots ${peakShots} > cap ${cap}`);
  return { ok: failures.length === 0, failures, peakShots, clearMs };
}
