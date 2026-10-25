import { flowFieldFrom, flowStep, type FlowField } from '../core/flow';
import type { Arena } from '../core/state';
import { isWall, lineOfSight, tileCenter, tileOf, type TileGrid, type TilePoint } from '../core/tiles';
import { normalize, sub, vec, type Vec2 } from '../core/vec';

/**
 * Walking for the bots: straight at a goal in sight (or in a fixed room), and
 * on generated floors downhill on a breadth-first field to the goal's tile
 * (the same field the walkers use, `core/flow.ts`). Fields are cached per
 * grid and goal tile.
 */
export class Navigator {
  private grid: TileGrid | undefined;
  private fields = new Map<string, FlowField>();

  private fieldTo(grid: TileGrid, goal: TilePoint): FlowField {
    if (grid !== this.grid) {
      this.grid = grid;
      this.fields.clear();
    }
    const key = `${goal.x},${goal.y}`;
    let field = this.fields.get(key);
    if (!field) {
      field = flowFieldFrom(grid, [goal]);
      this.fields.set(key, field);
    }
    return field;
  }

  /** Unit direction to walk from `from` towards `goal` (zero once there or when no way is known). */
  direction(arena: Arena, from: Vec2, goal: Vec2): Vec2 {
    const grid = arena.tiles;
    if (!grid || lineOfSight(grid, from, goal)) return normalize(sub(goal, from));
    const target = nearestFloor(grid, tileOf(goal));
    if (!target) return normalize(sub(goal, from));
    const next = flowStep(grid, this.fieldTo(grid, target), tileOf(from));
    return next ? normalize(sub(tileCenter(next), from)) : normalize(sub(goal, from));
  }

  /** Walking distance in tiles (generated floors), -1 when unreachable; straight-line tiles elsewhere. */
  tilesTo(arena: Arena, from: Vec2, goal: Vec2): number {
    const grid = arena.tiles;
    if (!grid) return Math.hypot(goal.x - from.x, goal.y - from.y) / 32;
    const a = tileOf(from);
    const field = this.fieldTo(grid, tileOf(goal));
    return isWall(grid, a.x, a.y) ? -1 : (field.dist[a.y * grid.cols + a.x] ?? -1);
  }
}

/** The floor tile nearest to `tile` (itself when it is floor), searching up to 4 tiles out; null when none. A floater inside a wall is reached from beside it. */
function nearestFloor(grid: TileGrid, tile: TilePoint): TilePoint | null {
  if (!isWall(grid, tile.x, tile.y)) return tile;
  for (let r = 1; r <= 4; r++) {
    let best: TilePoint | null = null;
    let bestD = Number.POSITIVE_INFINITY;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || isWall(grid, tile.x + dx, tile.y + dy)) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x: tile.x + dx, y: tile.y + dy };
        }
      }
    if (best) return best;
  }
  return null;
}

/** Centre of a room of a generated floor, in world pixels. */
export const roomCentre = (room: { x: number; y: number; width: number; height: number }): Vec2 =>
  tileCenter({ x: Math.floor(room.x + room.width / 2), y: Math.floor(room.y + room.height / 2) });

export const ZERO_MOVE = vec(0, 0);
