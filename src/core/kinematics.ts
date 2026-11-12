import type { ShotKinDef } from '../data/enemies';
import { add, dot, length, scale, vec, type Vec2 } from './vec';

export type { ShotKinDef };

/**
 * Enemy shot kinematics (docs/research/boss-patterns.md E2 and E4): bullets
 * whose motion changes over time, for the families the straight shots could
 * not draw: acceleration and deceleration, shots that slow, turn round and
 * come back, shots that brake and hang, constant curves (arcs, swirls),
 * gravity (arcs that fall) and a bounce off the arena edge. Pure and
 * deterministic: the host steps it in core/combat.ts and every guest steps
 * the same numbers from the snapshot (net/protocol.ts carries `kin`).
 *
 * What a shot can do is data (`ShotKinDef` on a `DanmakuShot`, data/enemies.ts); what it is
 * doing is state (`ShotKin` on the projectile). The hitbox never changes.
 */

/** A shot's kinematics in flight (ProjectileState `kin`, on the wire). */
export interface ShotKin {
  /** Px/s²: the launch-heading accel plus gravity, fixed at spawn. */
  acc: Vec2;
  /** Degrees per second. */
  curve: number;
  /** Px/s cap, 0 = none. */
  max: number;
  stop?: true;
  /** Bounces left. */
  bounces: number;
}

/** The data of part `index` of a pattern: `curveAlternate` flips the curve on odd parts. */
export function kinFor(def: ShotKinDef | undefined, index: number): ShotKinDef | undefined {
  if (!def?.curveAlternate || !def.curveDegPerSec || index % 2 === 0) return def;
  return { ...def, curveDegPerSec: -def.curveDegPerSec };
}

/** The state of a shot fired along unit `dir` with kinematics `def` (none when it is a plain straight shot). */
export function kinAtSpawn(def: ShotKinDef | undefined, dir: Vec2): ShotKin | undefined {
  if (!def) return undefined;
  const acc = add(scale(dir, def.accel ?? 0), def.gravity ?? vec(0, 0));
  const curve = def.curveDegPerSec ?? 0;
  const bounces = Math.max(0, Math.floor(def.bounces ?? 0));
  if (acc.x === 0 && acc.y === 0 && curve === 0 && bounces === 0) return undefined;
  return { acc, curve, max: def.maxSpeed ?? 0, bounces, ...(def.stop ? { stop: true as const } : {}) };
}

const DEG = Math.PI / 180;

/** One step of `ms` of a shot's velocity: the curve turns it, the acceleration adds to it, the cap clamps it; a `stop` shot that would reverse halts for good. */
export function driveShot(vel: Vec2, kin: ShotKin, ms: number): { vel: Vec2; kin: ShotKin } {
  const dt = ms / 1000;
  let v = vel;
  if (kin.curve !== 0) {
    const a = kin.curve * DEG * dt;
    const c = Math.cos(a);
    const s = Math.sin(a);
    v = vec(v.x * c - v.y * s, v.x * s + v.y * c);
  }
  const before = v;
  v = add(v, scale(kin.acc, dt));
  if (kin.stop && dot(v, before) <= 0 && (before.x !== 0 || before.y !== 0)) return { vel: vec(0, 0), kin: { ...kin, acc: vec(0, 0), curve: 0 } };
  if (kin.max > 0) {
    const speed = length(v);
    if (speed > kin.max) v = scale(v, kin.max / speed);
  }
  return { vel: v, kin };
}

/**
 * A shot that moved from `prev` into something solid at `next` (the arena
 * edge, a wall tile): the velocity component that hit is reflected (both in
 * a corner) and the shot stays at `prev` this step. Null when `prev` is solid
 * too (nothing to bounce from).
 */
export function bounceOff(prev: Vec2, next: Vec2, vel: Vec2, solid: (p: Vec2) => boolean): { pos: Vec2; vel: Vec2 } | null {
  if (solid(prev)) return null;
  const hitX = solid(vec(next.x, prev.y));
  const hitY = solid(vec(prev.x, next.y));
  const both = !hitX && !hitY;
  return { pos: prev, vel: vec(hitX || both ? -vel.x : vel.x, hitY || both ? -vel.y : vel.y) };
}
