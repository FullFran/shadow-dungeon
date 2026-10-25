import { floatsOf } from '../data/enemies';
import { TUNING } from '../data/tuning';
import { confineCircle, insideRect } from './geometry';
import type { EnemyState, Rect, WorldState } from './state';
import { isWall, TILE, tileCenter, tileOf, type TileGrid, type TilePoint } from './tiles';
import { add, clamp, distance, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * The out-of-bounds safety net (odd/tasks/out-of-bounds-fix.md), host and solo
 * only, every step; guests take the result from the snapshot. Collision
 * (geometry.ts) should already keep every walker on the floor; this catches
 * whatever slips past it, so no enemy is ever out of reach:
 *
 * - a walker whose centre is in a wall tile, or on floor no living player can
 *   walk to, is snapped to the nearest floor tile they can (BFS from its tile);
 * - a floater (Gastly) may cross walls but stays inside the map;
 * - during a sealed wave room, a wave enemy outside the room drifts back
 *   (floaters) and, after `TUNING.bounds.strayMs`, is brought to a free tile
 *   inside it with a poof (`warpMs`).
 */

const BOUNDS = TUNING.bounds;

/** 4-connected floor components of a grid: label per tile (-1 on walls). Cached per grid object. */
const componentCache = new WeakMap<TileGrid, { doors: readonly number[] | undefined; labels: Int32Array }>();

function components(grid: TileGrid, openDoors?: readonly number[]): Int32Array {
  const cached = componentCache.get(grid);
  if (cached && cached.doors === openDoors) return cached.labels;
  const open = new Set(openDoors ?? []);
  const floor = (i: number) => grid.tiles[i] === 1 || open.has(i);
  const labels = new Int32Array(grid.cols * grid.rows).fill(-1);
  let next = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== -1 || !floor(i)) continue;
    const queue = [i];
    labels[i] = next;
    while (queue.length > 0) {
      const at = queue.pop()!;
      const x = at % grid.cols;
      const y = Math.floor(at / grid.cols);
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
        const n = ny * grid.cols + nx;
        if (labels[n] === -1 && floor(n)) {
          labels[n] = next;
          queue.push(n);
        }
      }
    }
    next++;
  }
  componentCache.set(grid, { doors: openDoors, labels });
  return labels;
}

/** The nearest tile to `from` (BFS over every tile, walls too, 4-connected, fixed order) that `accept`s; null if none. */
export function nearestTile(grid: TileGrid, from: TilePoint, accept: (x: number, y: number) => boolean): TilePoint | null {
  const sx = clamp(from.x, 0, grid.cols - 1);
  const sy = clamp(from.y, 0, grid.rows - 1);
  const seen = new Uint8Array(grid.cols * grid.rows);
  const queue: number[] = [sy * grid.cols + sx];
  seen[queue[0]!] = 1;
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    const x = at % grid.cols;
    const y = Math.floor(at / grid.cols);
    if (accept(x, y)) return { x, y };
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
      const n = ny * grid.cols + nx;
      if (!seen[n]) {
        seen[n] = 1;
        queue.push(n);
      }
    }
  }
  return null;
}

const livingPlayers = (state: WorldState) => [state.player, ...state.remotes.map((r) => r.player)].filter((p) => p.hp > 0);

/** The sealed wave room in progress, if any. */
const sealedWaves = (state: WorldState) => {
  const e = state.simaEvent;
  return e && e.kind === 'waves' && e.sealed === true && !e.done ? e : null;
};

/**
 * A free tile inside `rect` (tiles) for an enemy coming back: off the room's
 * edge, away from the players and the other enemies, nearest to `near`.
 */
export function freeRoomTile(state: WorldState, rect: Rect, near: Vec2, selfId?: string): Vec2 {
  const grid = state.arena.tiles;
  const x0 = Math.round(rect.x / TILE);
  const y0 = Math.round(rect.y / TILE);
  const x1 = x0 + Math.round(rect.width / TILE);
  const y1 = y0 + Math.round(rect.height / TILE);
  const players = livingPlayers(state);
  let best: Vec2 | null = null;
  let bestScore = Infinity;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (grid && isWall(grid, x, y)) continue;
      const c = tileCenter({ x, y });
      const inner = x > x0 && y > y0 && x < x1 - 1 && y < y1 - 1;
      const crowded = state.enemies.some((e) => e.alive && e.id !== selfId && distance(e.pos, c) < TILE);
      const nearPlayer = players.some((p) => distance(p.pos, c) < TILE * 2.5);
      // Penalties first (edge, crowd, players), then distance: always some tile, the best one free.
      const score = (inner ? 0 : 1e7) + (crowded ? 1e6 : 0) + (nearPlayer ? 1e5 : 0) + distance(c, near);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
  return best ?? vec(rect.x + rect.width / 2, rect.y + rect.height / 2);
}

/** Host and solo: the safety net for one step. */
export function keepEnemiesInBounds(state: WorldState, dtMs: number): WorldState {
  const grid = state.arena.tiles;
  const waves = sealedWaves(state);
  // Reachability is judged with the wave room's doors open: an enemy elsewhere on the floor is not stranded by the seal.
  const labels = grid ? components(grid, waves ? waves.doors : undefined) : null;
  const playerLabels = new Set<number>();
  if (grid && labels)
    for (const p of livingPlayers(state)) {
      const t = tileOf(p.pos);
      const l = t.x >= 0 && t.y >= 0 && t.x < grid.cols && t.y < grid.rows ? labels[t.y * grid.cols + t.x]! : -1;
      if (l >= 0) playerLabels.add(l);
    }
  let changed = false;
  const enemies = state.enemies.map((start) => {
    if (!start.alive) return start;
    let enemy: EnemyState = start;
    if (enemy.warpMs !== undefined) {
      const left = enemy.warpMs - dtMs;
      const { warpMs: _gone, ...rest } = enemy;
      enemy = left > 0 ? { ...rest, warpMs: left } : rest;
    }
    const floats = floatsOf(enemy.species);
    if (floats) {
      const inside = vec(clamp(enemy.pos.x, enemy.radius, state.arena.width - enemy.radius), clamp(enemy.pos.y, enemy.radius, state.arena.height - enemy.radius));
      if (inside.x !== enemy.pos.x || inside.y !== enemy.pos.y) enemy = { ...enemy, pos: inside };
    } else if (grid && labels) {
      const t = tileOf(enemy.pos);
      const index = t.y * grid.cols + t.x;
      const buried = isWall(grid, t.x, t.y);
      const cut = playerLabels.size > 0 && !playerLabels.has(labels[index] ?? -1);
      if (buried || cut) {
        const onFloor = (x: number, y: number) => !isWall(grid, x, y) && (playerLabels.size === 0 || playerLabels.has(labels[y * grid.cols + x]!));
        const to = nearestTile(grid, t, onFloor);
        if (to) enemy = { ...enemy, pos: confineCircle(state.arena, tileCenter(to), enemy.radius), knockback: vec(0, 0) };
      }
    }
    if (waves && (waves.ids ?? []).includes(enemy.id)) enemy = herd(state, enemy, waves.rect, floats, dtMs);
    else if (enemy.strayMs !== undefined) {
      const { strayMs: _gone, ...rest } = enemy;
      enemy = rest;
    }
    if (enemy !== start) changed = true;
    return enemy;
  });
  return changed ? { ...state, enemies } : state;
}

/** A wave enemy outside its sealed room: floaters drift back; anyone out too long is brought in with a poof. */
function herd(state: WorldState, start: EnemyState, rect: Rect, floats: boolean, dtMs: number): EnemyState {
  if (insideRect(start.pos, rect)) {
    if (start.strayMs === undefined) return start;
    const { strayMs: _gone, ...rest } = start;
    return rest;
  }
  const strayMs = (start.strayMs ?? 0) + dtMs;
  let enemy: EnemyState = { ...start, strayMs };
  if (strayMs > BOUNDS.strayMs) {
    const { strayMs: _gone, ...rest } = enemy;
    const to = freeRoomTile(state, rect, enemy.pos, enemy.id);
    return { ...rest, pos: confineCircle(state.arena, to, enemy.radius, !floats), knockback: vec(0, 0), warpMs: BOUNDS.warpMs };
  }
  if (floats) {
    const toRoom = sub(vec(rect.x + rect.width / 2, rect.y + rect.height / 2), enemy.pos);
    const stepPx = Math.min(length(toRoom), (BOUNDS.floaterPullSpeed * dtMs) / 1000);
    enemy = { ...enemy, pos: confineCircle(state.arena, add(enemy.pos, scale(normalize(toRoom), stepPx)), enemy.radius, false) };
  }
  return enemy;
}
