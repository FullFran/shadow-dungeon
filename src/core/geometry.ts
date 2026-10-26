import type { Arena, Rect } from './state';
import { isWall, TILE, type TileGrid } from './tiles';
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

/** The point of tile (tx, ty) closest to `pos`, a hair inside it. */
function closestInTile(pos: Vec2, tx: number, ty: number): Vec2 {
  const e = 0.01;
  return vec(clamp(pos.x, tx * TILE + e, (tx + 1) * TILE - e), clamp(pos.y, ty * TILE + e, (ty + 1) * TILE - e));
}

/** How far a buried centre searches for floor (tiles, Chebyshev rings) before leaving it to the safety net (core/bounds.ts). */
const ESCAPE_RINGS = 4;

/**
 * A centre inside a wall tile leaves for the nearest floor tile: the closest
 * point of the nearest floor tile within a few rings (so a nudge into a wall
 * goes back the way it came). Never "out the nearest side" of the wall tile:
 * that side may be more rock, and repeated it marched walkers through solid
 * walls into the void (the wave-room soft-lock, odd/tasks/out-of-bounds-fix.md).
 */
export function escapeWall(grid: TileGrid, pos: Vec2): Vec2 {
  const tx = Math.floor(pos.x / TILE);
  const ty = Math.floor(pos.y / TILE);
  if (!isWall(grid, tx, ty)) return pos;
  for (let ring = 1; ring <= ESCAPE_RINGS; ring++) {
    let best: Vec2 | null = null;
    let bestD = Infinity;
    for (let y = ty - ring; y <= ty + ring; y++) {
      for (let x = tx - ring; x <= tx + ring; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== ring || isWall(grid, x, y)) continue;
        const p = closestInTile(pos, x, y);
        const d = Math.hypot(p.x - pos.x, p.y - pos.y);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
    }
    if (best) return best;
  }
  return pos;
}

/** Pushes a circle out of the wall tiles it overlaps (two passes settle corners); a buried centre first escapes to floor. */
function pushOutOfTiles(pos: Vec2, radius: number, arena: Arena): Vec2 {
  const grid = arena.tiles!;
  let next = escapeWall(grid, pos);
  for (let pass = 0; pass < 2; pass++) {
    const x0 = Math.floor((next.x - radius) / TILE);
    const x1 = Math.floor((next.x + radius) / TILE);
    const y0 = Math.floor((next.y - radius) / TILE);
    const y1 = Math.floor((next.y + radius) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (isWall(grid, tx, ty)) next = escapeWall(grid, pushOutOfRect(next, radius, { x: tx * TILE, y: ty * TILE, width: TILE, height: TILE }));
      }
    }
  }
  return next;
}

/**
 * Keeps a circle inside the arena and outside its wall tiles; walkers
 * (`walker`) also stay outside its obstacles. Floaters (Gastly) pass
 * `walker = false`: they drift over obstacles but never into the rock, so
 * they are always on floor the player can use (odd/tasks/floaters-usable-floor.md).
 */
export function confineCircle(arena: Arena, pos: Vec2, radius: number, walker = true): Vec2 {
  let next = pos;
  if (walker) for (const rect of arena.obstacles ?? []) next = pushOutOfRect(next, radius, rect);
  if (arena.tiles) next = pushOutOfTiles(next, radius, arena);
  next = vec(clamp(next.x, radius, arena.width - radius), clamp(next.y, radius, arena.height - radius));
  // The map clamp may itself land a big body's centre in rock: out again.
  return arena.tiles ? escapeWall(arena.tiles, next) : next;
}

/** Longest single resolution step of a swept move (px): a quarter tile, well under any walker's radius. */
export const SWEEP_STEP_PX = TILE / 4;

/**
 * Moves a circle by `delta` in steps of at most `SWEEP_STEP_PX`, confining it
 * after each: a long push (a heavy knockback, a lunge) meets the first wall on
 * its way instead of jumping past it. A short move is one plain `confineCircle`.
 */
export function sweepCircle(arena: Arena, from: Vec2, delta: Vec2, radius: number, walker = true): Vec2 {
  const steps = Math.max(1, Math.ceil(Math.hypot(delta.x, delta.y) / SWEEP_STEP_PX));
  if (steps === 1) return confineCircle(arena, vec(from.x + delta.x, from.y + delta.y), radius, walker);
  // Unobstructed, every step aims at `from + delta * i/steps`, so a free move ends exactly (bit for bit) where one jump would.
  let pos = from;
  let free = true;
  for (let i = 1; i <= steps; i++) {
    const target = free ? vec(from.x + delta.x * (i / steps), from.y + delta.y * (i / steps)) : vec(pos.x + delta.x / steps, pos.y + delta.y / steps);
    pos = confineCircle(arena, target, radius, walker);
    if (pos.x !== target.x || pos.y !== target.y) free = false;
  }
  return pos;
}
