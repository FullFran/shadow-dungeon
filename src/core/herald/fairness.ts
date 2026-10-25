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

/** Marks every cell whose centre lies within `radius` of the segment p0-p1 (sampled as circles every radius/2). */
function markCapsule(g: Grid, x0: number, y0: number, x1: number, y1: number, radius: number): void {
  const len = Math.hypot(x1 - x0, y1 - y0);
  const n = Math.max(1, Math.ceil(len / (radius * 0.5)));
  const rr = radius + 1;
  for (let i = 0; i <= n; i++) {
    const cx = x0 + ((x1 - x0) * i) / n;
    const cy = y0 + ((y1 - y0) * i) / n;
    const r0 = Math.max(0, Math.ceil((cy - rr) / CELL - 0.5));
    const r1 = Math.min(g.rows - 1, Math.floor((cy + rr) / CELL - 0.5));
    for (let r = r0; r <= r1; r++) {
      const dy = (r + 0.5) * CELL - cy;
      const half = Math.sqrt(Math.max(0, rr * rr - dy * dy));
      const c0 = Math.max(0, Math.ceil((cx - half) / CELL - 0.5));
      const c1 = Math.min(g.cols - 1, Math.floor((cx + half) / CELL - 0.5));
      for (let c = c0; c <= c1; c++) g.data[r * g.words + (c >> 5)]! |= 1 << (c & 31);
    }
  }
}

/** reach := dilate4(reach & ~unsafe) & ~unsafe & valid, in place via `tmp`. */
function walk(reach: Grid, unsafe: Grid, valid: Grid, tmp: Uint32Array): void {
  const { words: W, rows } = reach;
  const a = reach.data;
  for (let i = 0; i < a.length; i++) tmp[i] = a[i]! & ~unsafe.data[i]!;
  for (let r = 0; r < rows; r++) {
    for (let w = 0; w < W; w++) {
      const i = r * W + w;
      const v = tmp[i]!;
      const left = (v << 1) | (w > 0 ? tmp[i - 1]! >>> 31 : 0);
      const right = (v >>> 1) | (w < W - 1 ? tmp[i + 1]! << 31 : 0);
      const up = r > 0 ? tmp[i - W]! : 0;
      const down = r < rows - 1 ? tmp[i + W]! : 0;
      a[i] = (v | left | right | up | down) & ~unsafe.data[i]! & valid.data[i]!;
    }
  }
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
  for (let r = 0; r < valid.rows; r++)
    for (let c = 0; c < valid.cols; c++) {
      if (!valid.get(c, r)) continue;
      const d = Math.hypot((c + 0.5) * CELL - p.x, (r + 0.5) * CELL - p.y);
      if (d < bestD) {
        bestD = d;
        best = [c, r];
      }
    }
  return bestD <= CELL * 3 ? best : null;
}

/** Whether a player starting at `start` survives the card's cycle (from the wind-up to the last shot) against `shots` and the pockets. */
function survives(shots: readonly SimShot[], pockets: readonly Extract<HeraldLayer, { kind: 'pockets' }>[], valid: Grid, start: [number, number], fromMs: number, toMs: number, pr: number, dtMs: number): boolean {
  const reach = new Grid(valid.cols, valid.rows);
  reach.set(start[0], start[1]);
  const unsafe = new Grid(valid.cols, valid.rows);
  const tmp = new Uint32Array(reach.data.length);
  const pocketSafe = pockets.map((p) => {
    const g = new Grid(valid.cols, valid.rows);
    for (let r = 0; r < valid.rows; r++)
      for (let c = 0; c < valid.cols; c++) {
        const x = (c + 0.5) * CELL;
        const y = (r + 0.5) * CELL;
        if (p.pockets.some((q) => Math.hypot(x - q.x, y - q.y) <= p.radius - CELL / 2 - 1)) g.set(c, r);
      }
    return g;
  });
  let first = 0;
  for (let t = fromMs; t < toMs; t += dtMs) {
    unsafe.data.fill(0);
    const t1 = t + dtMs;
    while (first < shots.length && shots[first]!.t1 <= t) first++;
    for (let i = first; i < shots.length; i++) {
      const s = shots[i]!;
      if (s.t0 >= t1) break;
      if (s.t1 <= t) continue;
      const a = Math.max(t, s.t0) - s.t0;
      const b = Math.min(t1, s.t1) - s.t0;
      markCapsule(unsafe, s.x + s.vx * a, s.y + s.vy * a, s.x + s.vx * b, s.y + s.vy * b, s.r + pr + CELL / 2);
    }
    pockets.forEach((p, i) => {
      const on = p.startMs + p.warnMs;
      if (t1 > on && t < on + p.flashMs) {
        const safe = pocketSafe[i]!.data;
        for (let j = 0; j < unsafe.data.length; j++) unsafe.data[j]! |= valid.data[j]! & ~safe[j]!;
      }
    });
    walk(reach, unsafe, valid, tmp);
    if (!reach.any()) return false;
  }
  return true;
}

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
  for (const origin of env.origins) {
    const valid = validGrid(cols, rows, env, origin, pr);
    for (const start of starts) {
      const cell = nearestValid(valid, start);
      if (!cell) continue;
      const ctx: EmitContext = { origin, bossRadius: env.bossRadius, mark: start, arena: env.arena };
      const shots = simShots(layers, ctx);
      peakShots = Math.max(peakShots, peakOf(layers, ctx, shots));
      const end = Math.max(0, ...shots.map((s) => s.t1), ...pockets.map((p) => p.startMs + p.warnMs + p.flashMs));
      const followers = layers.filter((l): l is Extract<HeraldLayer, { kind: 'homing' | 'stream' }> => l.kind === 'homing' || (l.kind === 'stream' && l.aim === 'tracking'));
      const followEnd = Math.max(0, ...followers.map((l) => Math.max(...partTimes(l)) + l.shot.lifetimeMs));
      clearMs = Math.max(clearMs, end, followEnd);
      if (!survives(shots, pockets, valid, cell, -tele, end + dtMs, pr, dtMs)) {
        failures.push(`no safe path from (${start.x}, ${start.y}) with the herald at (${Math.round(origin.x)}, ${Math.round(origin.y)})`);
        // One trapped start is enough to reject the card.
        return { ok: false, failures, peakShots, clearMs };
      }
    }
  }
  const cap = Math.min(env.maxShots, ENEMY_SHOT_CAP);
  if (peakShots > cap) failures.push(`peak shots ${peakShots} > cap ${cap}`);
  return { ok: failures.length === 0, failures, peakShots, clearMs };
}
