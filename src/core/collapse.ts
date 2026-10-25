import { COLLAPSE } from '../data/dungeon';
import { floatsOf } from '../data/enemies';
import { tileDistances, type Floor } from './dungeon';
import { confineCircle } from './geometry';
import { isInvulnerable } from './player';
import type { GameEvent, WorldState } from './state';
import { isWall, tileCenter, tileOf, type TileGrid, type TilePoint } from './tiles';
import { TUNING } from '../data/tuning';
import { add, length, normalize, scale, sub } from './vec';

/**
 * The collapse urgent floor (docs/gdd.md §3 "Plantas con prisa"): after a
 * grace delay a front advances from the start along the walking distance
 * field at a constant speed, so it always reaches the stairs last. Tiles
 * behind the front are rubble: standing there hurts on an interval (roll
 * i-frames skip a tick, Disguise does not absorb it: the ground is not an
 * attack) and pushes the player towards the nearest standing ground;
 * walking enemies on rubble fall (ghosts float on).
 */
export interface CollapseState {
  /** Walking distance in tiles from the start tile, -1 on walls and unreachable tiles. */
  dist: readonly number[];
  /** Time since the floor was entered. */
  elapsedMs: number;
  /** Time left before the next damage tick while on rubble (0: the next contact hurts at once). */
  damageMs: number;
}

export const startCollapse = (floor: Floor): CollapseState => ({ dist: tileDistances(floor, floor.start), elapsedMs: 0, damageMs: 0 });

/** Distance of the front from the start, in tiles (0 during the grace delay). */
export const collapseFront = (c: CollapseState): number => Math.max(0, ((c.elapsedMs - COLLAPSE.graceMs) / 1000) * COLLAPSE.frontTilesPerSecond);

const distAt = (c: CollapseState, cols: number, tile: TilePoint): number => {
  if (tile.x < 0 || tile.y < 0 || tile.x >= cols) return -1;
  return c.dist[tile.y * cols + tile.x] ?? -1;
};

export function isCollapsed(c: CollapseState, cols: number, tile: TilePoint): boolean {
  const d = distAt(c, cols, tile);
  return d >= 0 && d < collapseFront(c);
}

export const advanceCollapse = (c: CollapseState, dtMs: number): CollapseState => ({ ...c, elapsedMs: c.elapsedMs + dtMs });

/** Tiles between the player and the front once it moves (negative on rubble); null when there is no moving front. */
export function collapseProximity(state: WorldState): number | null {
  const c = state.collapse;
  const grid = state.arena.tiles;
  if (!c || !grid || c.elapsedMs < COLLAPSE.graceMs) return null;
  const d = distAt(c, grid.cols, tileOf(state.player.pos));
  return d < 0 ? null : d - collapseFront(c);
}

const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * First tile on the shortest walk from `from` to ground that stands
 * `COLLAPSE.pushMarginTiles` past the front (or, failing that, to any standing
 * ground); null when nothing stands any more.
 */
function wayOut(grid: TileGrid, c: CollapseState, from: TilePoint): TilePoint | null {
  const seen = new Map<number, number>([[from.y * grid.cols + from.x, -1]]);
  const queue: TilePoint[] = [from];
  const safe = collapseFront(c) + COLLAPSE.pushMarginTiles;
  let fallback: number | null = null;
  const firstStep = (key: number): TilePoint => {
    // Walk back to the step right after `from`.
    let current = key;
    while (seen.get(current) !== from.y * grid.cols + from.x) current = seen.get(current)!;
    return { x: current % grid.cols, y: Math.floor(current / grid.cols) };
  };
  for (let head = 0; head < queue.length; head++) {
    const tile = queue[head]!;
    const key = tile.y * grid.cols + tile.x;
    if (head > 0 && !isCollapsed(c, grid.cols, tile)) {
      if (distAt(c, grid.cols, tile) >= safe) return firstStep(key);
      fallback ??= key;
    }
    for (const [dx, dy] of STEPS) {
      const next = { x: tile.x + dx, y: tile.y + dy };
      const nextKey = next.y * grid.cols + next.x;
      if (isWall(grid, next.x, next.y) || seen.has(nextKey)) continue;
      seen.set(nextKey, key);
      queue.push(next);
    }
  }
  return fallback === null ? null : firstStep(fallback);
}

function hurtPlayer(state: WorldState, c: CollapseState, dtMs: number, events: GameEvent[]): { state: WorldState; collapse: CollapseState } {
  const { player } = state;
  const damageMs = Math.max(0, c.damageMs - dtMs);
  if (damageMs > 0 || isInvulnerable(player)) return { state, collapse: { ...c, damageMs } };
  const damage = COLLAPSE.damageFraction * player.maxHp;
  events.push({ type: 'collapseHurt', damage });
  return {
    state: { ...state, player: { ...player, hp: Math.max(0, player.hp - damage) } },
    collapse: { ...c, damageMs: COLLAPSE.damageIntervalMs },
  };
}

function pushPlayer(state: WorldState, grid: TileGrid, c: CollapseState, dtMs: number): WorldState {
  const out = wayOut(grid, c, tileOf(state.player.pos));
  if (!out) return state;
  const dir = normalize(sub(tileCenter(out), state.player.pos));
  if (length(dir) === 0) return state;
  const pos = confineCircle(state.arena, add(state.player.pos, scale(dir, (COLLAPSE.pushSpeed * dtMs) / 1000)), TUNING.player.radius);
  return { ...state, player: { ...state.player, pos } };
}

/**
 * One step of the collapse: advance the front, hurt and push the local player on rubble (each peer its own),
 * drop walkers on it (the host only: guests get enemies from its snapshots).
 */
export function updateCollapse(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const grid = state.arena.tiles;
  if (!state.collapse || !grid) return state;
  let c = advanceCollapse(state.collapse, dtMs);
  let next: WorldState = state;
  if (isCollapsed(c, grid.cols, tileOf(state.player.pos))) {
    const hurt = hurtPlayer(next, c, dtMs, events);
    c = hurt.collapse;
    next = pushPlayer(hurt.state, grid, c, dtMs);
  } else if (c.damageMs !== 0) {
    c = { ...c, damageMs: 0 };
  }
  const falling = next.role !== 'guest' && next.enemies.some((e) => e.alive && !floatsOf(e.species) && isCollapsed(c, grid.cols, tileOf(e.pos)));
  if (falling) {
    const enemies = next.enemies.map((enemy) => {
      if (!enemy.alive || floatsOf(enemy.species) || !isCollapsed(c, grid.cols, tileOf(enemy.pos))) return enemy;
      events.push({ type: 'enemyDefeated', enemyId: enemy.id });
      return { ...enemy, alive: false, hp: 0 };
    });
    next = { ...next, enemies };
  }
  return { ...next, collapse: c };
}
