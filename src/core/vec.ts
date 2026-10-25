/** Minimal immutable 2D vector helpers. World y grows downwards (screen convention). */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export const vec = (x: number, y: number): Vec2 => ({ x, y });
export const ZERO: Vec2 = vec(0, 0);

export const add = (a: Vec2, b: Vec2): Vec2 => vec(a.x + b.x, a.y + b.y);
export const sub = (a: Vec2, b: Vec2): Vec2 => vec(a.x - b.x, a.y - b.y);
export const scale = (a: Vec2, k: number): Vec2 => vec(a.x * k, a.y * k);
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec2): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec2, b: Vec2): number => length(sub(a, b));

/** Unit vector in the same direction, or ZERO for a zero vector. */
export function normalize(a: Vec2): Vec2 {
  const len = length(a);
  return len === 0 ? ZERO : vec(a.x / len, a.y / len);
}

/** Angle in radians, atan2 convention; with y down, increasing angle turns clockwise on screen. */
export const angleOf = (a: Vec2): number => Math.atan2(a.y, a.x);
export const fromAngle = (radians: number): Vec2 => vec(Math.cos(radians), Math.sin(radians));

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
