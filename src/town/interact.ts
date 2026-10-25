import { TUNING } from '../data/tuning';
import { confineCircle } from '../core/geometry';
import type { Arena } from '../core/state';
import { TILE, tileOf, type TileGrid } from '../core/tiles';
import { add, length, normalize, scale, type Vec2 } from '../core/vec';

/**
 * Pure rules of walking around the town: WASD steps with the core's tile
 * collision (same speed and body as in the dungeon, no roll or stamina),
 * the interaction range and the route exit.
 */

/** Talk/read range from the player's centre to a target's (world px): a neighbouring tile, diagonals included. */
export const INTERACT_RANGE = 48;

export interface Interactable {
  id: string;
  pos: Vec2;
}

export interface Walker {
  pos: Vec2;
  facing: Vec2;
}

export const townArena = (grid: TileGrid): Arena => ({ width: grid.cols * TILE, height: grid.rows * TILE, tiles: grid });

export function stepWalker(walker: Walker, move: Vec2, dtMs: number, arena: Arena): Walker {
  const dir = normalize(move);
  if (length(dir) === 0) return walker;
  const pos = confineCircle(arena, add(walker.pos, scale(dir, (TUNING.player.moveSpeed * dtMs) / 1000)), TUNING.player.radius);
  return { pos, facing: dir };
}

/** The closest target within INTERACT_RANGE, or null. */
export function nearestInteractable<T extends Interactable>(pos: Vec2, targets: readonly T[]): T | null {
  let best: T | null = null;
  let bestDist = INTERACT_RANGE;
  for (const target of targets) {
    const dist = Math.hypot(target.pos.x - pos.x, target.pos.y - pos.y);
    if (dist <= bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return best;
}

/** True when the player's tile is one of the exit tiles. */
export function inExit(pos: Vec2, exit: { x: number; y: number; width: number; height: number }): boolean {
  const tile = tileOf(pos);
  return tile.x >= exit.x && tile.x < exit.x + exit.width && tile.y >= exit.y && tile.y < exit.y + exit.height;
}
