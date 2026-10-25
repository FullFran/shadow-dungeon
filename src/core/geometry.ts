import type { Arena, Rect } from './state';
import { clamp, vec, type Vec2 } from './vec';

export function insideRect(pos: Vec2, rect: Rect): boolean {
  return pos.x >= rect.x && pos.x <= rect.x + rect.width && pos.y >= rect.y && pos.y <= rect.y + rect.height;
}

/** Pushes a circle out of one rectangle along the shortest way. */
function pushOutOfRect(pos: Vec2, radius: number, rect: Rect): Vec2 {
  const closest = vec(clamp(pos.x, rect.x, rect.x + rect.width), clamp(pos.y, rect.y, rect.y + rect.height));
  const dx = pos.x - closest.x;
  const dy = pos.y - closest.y;
  const dist = Math.hypot(dx, dy);
  if (dist >= radius) return pos;
  if (dist > 0) return vec(closest.x + (dx / dist) * radius, closest.y + (dy / dist) * radius);
  // Centre inside the rectangle: leave through the nearest side.
  const exits = [
    { d: pos.x - rect.x, p: vec(rect.x - radius, pos.y) },
    { d: rect.x + rect.width - pos.x, p: vec(rect.x + rect.width + radius, pos.y) },
    { d: pos.y - rect.y, p: vec(pos.x, rect.y - radius) },
    { d: rect.y + rect.height - pos.y, p: vec(pos.x, rect.y + rect.height + radius) },
  ];
  return exits.reduce((best, exit) => (exit.d < best.d ? exit : best)).p;
}

/**
 * Keeps a circle inside the arena and, for walkers (`solid`), outside its
 * obstacles. Floaters (Gastly) pass `solid = false` and only meet the walls.
 */
export function confineCircle(arena: Arena, pos: Vec2, radius: number, solid = true): Vec2 {
  let next = pos;
  if (solid) for (const rect of arena.obstacles ?? []) next = pushOutOfRect(next, radius, rect);
  return vec(clamp(next.x, radius, arena.width - radius), clamp(next.y, radius, arena.height - radius));
}
