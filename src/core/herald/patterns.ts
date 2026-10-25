import type { HeraldCard, HeraldLayer, HeraldShot } from '../../data/herald';
import { deriveSeed, nextRandom } from '../rng';
import { add, angleOf, fromAngle, normalize, scale, sub, vec, type Vec2 } from '../vec';

/**
 * The heralds' pattern grammar (data/herald.ts `HeraldLayer`), pure: when
 * each part of a layer fires and which shots it throws. The same function
 * drives the fight (core/herald/brain.ts) and the fairness simulation
 * (core/herald/fairness.ts), so what is checked is exactly what is played.
 */
const DEG = Math.PI / 180;

/** Where and at what a cycle's attack is thrown. */
export interface EmitContext {
  /** The herald's body (it stands still while it attacks). */
  origin: Vec2;
  bossRadius: number;
  /** The mark: where the target stood when the wind-up began. */
  mark: Vec2;
  arena: { width: number; height: number };
  /** Tracking streams only: where the target is now (defaults to the mark). */
  target?: Vec2;
}

export interface ShotSpawn {
  /** Ms into the attack window. */
  t: number;
  at: Vec2;
  dir: Vec2;
  shot: HeraldShot;
}

/** The fire times of a layer's parts, in order (ms into the attack window). */
export function partTimes(layer: HeraldLayer): number[] {
  const every = (count: number, ms: number) => Array.from({ length: count }, (_, k) => layer.startMs + k * ms);
  switch (layer.kind) {
    case 'stream':
      return every(layer.bursts, layer.everyMs);
    case 'ring':
      return every(layer.rings, layer.everyMs);
    case 'spiral':
    case 'wave':
      return every(layer.emissions, layer.everyMs);
    case 'lanes':
      return every(layer.waves, layer.everyMs);
    case 'closing':
      return every(layer.rings, layer.everyMs);
    case 'scatter':
      return every(layer.bursts, layer.everyMs);
    case 'homing':
      return every(layer.volleys, layer.everyMs);
    case 'laser': {
      const beams = Math.max(1, Math.floor(layer.fireMs / layer.beamEveryMs));
      return Array.from({ length: layer.volleys * beams }, (_, i) => layer.startMs + Math.floor(i / beams) * layer.everyMs + layer.warnMs + (i % beams) * layer.beamEveryMs);
    }
    case 'pockets':
    case 'summon':
      return [layer.startMs];
  }
}

/** When a layer's last part has fired (pockets: their flash is over). */
export function layerEndMs(layer: HeraldLayer): number {
  if (layer.kind === 'pockets') return layer.startMs + layer.warnMs + layer.flashMs;
  const times = partTimes(layer);
  return times[times.length - 1] ?? layer.startMs;
}

/** A card's attack window: until its last layer is done (plus a beat). */
export const cardAttackMs = (card: Pick<HeraldCard, 'layers'>): number => Math.max(...card.layers.map(layerEndMs), 0) + 100;

const aimOf = (ctx: EmitContext): Vec2 => {
  const d = sub(ctx.mark, ctx.origin);
  return d.x === 0 && d.y === 0 ? vec(0, 1) : normalize(d);
};

const baseAngle = (aim: 'static' | 'aimed', offsetDeg: number, ctx: EmitContext): number => (aim === 'aimed' ? angleOf(aimOf(ctx)) + offsetDeg * DEG : offsetDeg * DEG);

const fromBody = (ctx: EmitContext, dir: Vec2, shot: HeraldShot): Vec2 => add(ctx.origin, scale(dir, ctx.bossRadius + shot.radius));

/** Directions of ring `index`: `perRing` slots, `gap` empty around `gapAngle` (radians). */
export function ringSlots(gapAngle: number, perRing: number, gap: number): Vec2[] {
  const step = (Math.PI * 2) / perRing;
  return Array.from({ length: perRing - gap }, (_, i) => fromAngle(gapAngle + (gap / 2 + 0.5 + i) * step));
}

/** The centre of the safe lane of wave `index` (x for walls moving along y, y for flipped ones). */
export function laneCentre(span: number, mark: number, gapWidth: number, shiftPx: number, index: number): number {
  const lo = gapWidth / 2 + 8;
  const hi = span - gapWidth / 2 - 8;
  const side = mark < span / 2 ? 1 : -1;
  const c = index % 2 === 1 ? mark + side * shiftPx : mark;
  return Math.min(hi, Math.max(lo, c));
}

/** Which way a lane wall travels: away from the edge farther from the mark. */
export function laneDirection(layer: Extract<HeraldLayer, { kind: 'lanes' }>, ctx: Pick<EmitContext, 'mark' | 'arena'>): Vec2 {
  if (layer.flip) return ctx.mark.x > ctx.arena.width / 2 ? vec(1, 0) : vec(-1, 0);
  return ctx.mark.y > ctx.arena.height / 2 ? vec(0, 1) : vec(0, -1);
}

/** The seeded angles of scatter burst `k` (degrees off the centre), the same on every peer. */
export function scatterAngles(salt: number, k: number, count: number, coneDeg: number): number[] {
  let state = deriveSeed(salt, k + 1);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = nextRandom(state);
    state = r.state;
    // Stratified: one shot per equal slice of the cone, jittered inside it (no clumps, no holes wider than two slices).
    out.push(-coneDeg / 2 + ((i + 0.2 + 0.6 * r.value) * coneDeg) / count);
  }
  return out;
}

/** Laser line directions of volley `v` (unit vectors). */
export function laserLines(layer: Extract<HeraldLayer, { kind: 'laser' }>, ctx: EmitContext, v: number): Vec2[] {
  const centre = baseAngle(layer.aim, layer.offsetDeg, ctx) + v * layer.turnDeg * DEG;
  return Array.from({ length: layer.lines }, (_, i) => fromAngle(centre + (layer.lines === 1 ? 0 : (-layer.fanDeg / 2 + (i * layer.fanDeg) / (layer.lines - 1)) * DEG)));
}

/** The shots of part `k` of `layer` (fired at `t`). Pockets and summons throw none. */
export function emitPart(layer: HeraldLayer, k: number, t: number, ctx: EmitContext): ShotSpawn[] {
  const out: ShotSpawn[] = [];
  const push = (dir: Vec2, shot: HeraldShot, at?: Vec2) => out.push({ t, dir, shot, at: at ?? fromBody(ctx, dir, shot) });
  switch (layer.kind) {
    case 'stream': {
      const centre = layer.aim === 'tracking' && ctx.target ? angleOf(normalize(sub(ctx.target, ctx.origin))) : angleOf(aimOf(ctx));
      for (let i = 0; i < layer.perBurst; i++) {
        const off = layer.perBurst === 1 ? 0 : -layer.spreadDeg / 2 + (i * layer.spreadDeg) / (layer.perBurst - 1);
        push(fromAngle(centre + off * DEG), layer.shot);
      }
      break;
    }
    case 'ring': {
      const gapAngle = baseAngle(layer.aim, layer.offsetDeg, ctx) + k * layer.gapTurnDeg * DEG;
      for (const dir of ringSlots(gapAngle, layer.perRing, layer.gap)) push(dir, layer.shot);
      break;
    }
    case 'spiral': {
      const base = layer.offsetDeg * DEG;
      for (let a = 0; a < layer.arms; a++) {
        push(fromAngle(base + (k * layer.turnDeg + (a * 360) / layer.arms) * DEG), layer.shot);
        if (layer.mirror) push(fromAngle(base + (-k * layer.turnDeg + (a * 360) / layer.arms + 180 / layer.arms) * DEG), layer.shot);
      }
      break;
    }
    case 'wave': {
      const base = baseAngle(layer.aim, layer.offsetDeg, ctx);
      const swing = layer.amplitudeDeg * Math.sin((2 * Math.PI * (t - layer.startMs)) / layer.periodMs);
      for (let a = 0; a < layer.arms; a++) {
        const arm = base + ((a * 360) / layer.arms) * DEG;
        push(fromAngle(arm + swing * DEG), layer.shot);
        if (layer.mirror) push(fromAngle(arm - swing * DEG), layer.shot);
      }
      break;
    }
    case 'lanes': {
      const dir = laneDirection(layer, ctx);
      const span = layer.flip ? ctx.arena.height : ctx.arena.width;
      const markAlong = layer.flip ? ctx.mark.y : ctx.mark.x;
      const centre = laneCentre(span, markAlong, layer.gapWidth, layer.shiftPx, k);
      const edge = layer.shot.radius + 2;
      for (let p = layer.spacing / 2; p < span; p += layer.spacing) {
        if (Math.abs(p - centre) <= layer.gapWidth / 2) continue;
        const at = layer.flip ? vec(dir.x > 0 ? edge : ctx.arena.width - edge, p) : vec(p, dir.y > 0 ? edge : ctx.arena.height - edge);
        push(dir, layer.shot, at);
      }
      break;
    }
    case 'closing': {
      const centre = vec(ctx.arena.width / 2, ctx.arena.height / 2);
      const toMark = sub(ctx.mark, centre);
      const gapAngle = (toMark.x === 0 && toMark.y === 0 ? Math.PI / 2 : angleOf(toMark)) + k * layer.gapTurnDeg * DEG;
      for (const u of ringSlots(gapAngle, layer.perRing, layer.gap)) {
        const at = add(centre, scale(u, layer.radius));
        if (at.x < 1 || at.y < 1 || at.x > ctx.arena.width - 1 || at.y > ctx.arena.height - 1) continue;
        push(scale(u, -1), layer.shot, at);
      }
      break;
    }
    case 'scatter': {
      const centre = baseAngle(layer.aim, 0, ctx);
      for (const off of scatterAngles(layer.salt, k, layer.count, layer.coneDeg)) push(fromAngle(centre + off * DEG), layer.shot);
      break;
    }
    case 'homing': {
      const centre = angleOf(aimOf(ctx));
      for (let i = 0; i < layer.orbs; i++) push(fromAngle(centre + (layer.orbs === 1 ? 0 : -40 + (i * 80) / (layer.orbs - 1)) * DEG), layer.shot);
      break;
    }
    case 'laser': {
      const beams = Math.max(1, Math.floor(layer.fireMs / layer.beamEveryMs));
      for (const dir of laserLines(layer, ctx, Math.floor(k / beams))) push(dir, layer.shot);
      break;
    }
    case 'pockets':
    case 'summon':
      break;
  }
  return out;
}

/** Every shot a layer throws with its fire time `t` in `(fromMs, toMs]` (the fight's step). */
export function emitBetween(layer: HeraldLayer, fromMs: number, toMs: number, ctx: EmitContext): ShotSpawn[] {
  const times = partTimes(layer);
  const out: ShotSpawn[] = [];
  times.forEach((t, k) => {
    if (t > fromMs && t <= toMs) out.push(...emitPart(layer, k, t, ctx));
  });
  return out;
}

/** Whether a pockets layer is burning `t` ms into the attack, and whether `pos` is outside every pocket. */
export function pocketsBurning(layer: Extract<HeraldLayer, { kind: 'pockets' }>, t: number): boolean {
  const at = layer.startMs + layer.warnMs;
  return t >= at && t < at + layer.flashMs;
}

export const outsidePockets = (layer: Extract<HeraldLayer, { kind: 'pockets' }>, pos: Vec2): boolean =>
  layer.pockets.every((p) => Math.hypot(pos.x - p.x, pos.y - p.y) > layer.radius);

/** Layers that aim at a player (the P5 threat count): aimed or tracking shapes, homing orbs, summons. */
export function aimedThreat(layer: HeraldLayer): boolean {
  if (layer.kind === 'homing' || layer.kind === 'summon') return true;
  if (layer.kind === 'stream') return true;
  if (layer.kind === 'ring' || layer.kind === 'wave' || layer.kind === 'scatter' || layer.kind === 'laser') return layer.aim === 'aimed';
  return false;
}

/** Layers that ask for a choice (a gap, a lane, a pocket, a laser's side): their card's wind-up floor is the higher one. */
export const asksChoice = (layer: HeraldLayer): boolean =>
  layer.kind === 'ring' || layer.kind === 'lanes' || layer.kind === 'closing' || layer.kind === 'pockets' || layer.kind === 'laser';
