import { DUNGEON } from '../data/dungeon';
import { vec, type Vec2 } from './vec';

/** Size of one map tile in world pixels. */
export const TILE = DUNGEON.tileSize;

/** Tile coordinates (column, row). */
export interface TilePoint {
  x: number;
  y: number;
}

/** A wall/floor grid: `tiles[y * cols + x]` is 1 for floor, 0 for wall. */
export interface TileGrid {
  cols: number;
  rows: number;
  tiles: readonly number[];
}

/** Outside the grid counts as wall. */
export function isWall(grid: TileGrid, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows) return true;
  return grid.tiles[y * grid.cols + x] === 0;
}

export const tileCenter = (tile: TilePoint): Vec2 => vec((tile.x + 0.5) * TILE, (tile.y + 0.5) * TILE);

export const tileOf = (pos: Vec2): TilePoint => ({ x: Math.floor(pos.x / TILE), y: Math.floor(pos.y / TILE) });

export const wallAt = (grid: TileGrid, pos: Vec2): boolean => {
  const { x, y } = tileOf(pos);
  return isWall(grid, x, y);
};
