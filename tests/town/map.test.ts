import { describe, expect, it } from 'vitest';
import { TOWN, TOWN_PROPS, type TownMap } from '../../src/data/town';
import { isWall, TILE } from '../../src/core/tiles';
import { buildTownGrid, groundAt, pathPatchCell, propSolidTiles, reachableFrom } from '../../src/town/map';
import { INTERACT_RANGE } from '../../src/town/interact';

const grid = buildTownGrid(TOWN);
const reach = reachableFrom(grid, TOWN.spawn);
const reachable = (x: number, y: number) => reach.has(y * grid.cols + x);
const center = (x: number, y: number) => ({ x: (x + 0.5) * TILE, y: (y + 0.5) * TILE });

/** Some reachable tile has its centre within interaction range of `point` (tile units). */
function reachableNear(point: { x: number; y: number }): boolean {
  const target = { x: point.x * TILE, y: point.y * TILE };
  for (const index of reach) {
    const c = center(index % grid.cols, Math.floor(index / grid.cols));
    if (Math.hypot(c.x - target.x, c.y - target.y) <= INTERACT_RANGE) return true;
  }
  return false;
}

describe('town map data', () => {
  it('is a rectangle of known ground characters', () => {
    const cols = TOWN.rows[0]!.length;
    for (const row of TOWN.rows) {
      expect(row).toHaveLength(cols);
      expect(row).toMatch(/^[SF.,]+$/);
    }
  });

  it('keeps every prop inside the map and off the sky', () => {
    for (const prop of TOWN.props) {
      const spec = TOWN_PROPS[prop.kind];
      expect(prop.x).toBeGreaterThanOrEqual(0);
      expect(prop.x + spec.width).toBeLessThanOrEqual(grid.cols);
      expect(prop.y + spec.height).toBeLessThanOrEqual(grid.rows);
      for (const t of propSolidTiles(prop)) expect(groundAt(TOWN, t.x, t.y)).not.toBe('sky');
    }
  });
});

describe('town grid', () => {
  it('blocks sky, forest, prop footprints and NPCs, and nothing else', () => {
        expect(isWall(grid, 0, 1)).toBe(true);
    // The stall's top row (awning) can be walked behind; its bottom rows are solid.
    expect(isWall(grid, 6, 3)).toBe(false);
    expect(isWall(grid, 6, 4)).toBe(true);
    for (const npc of TOWN.npcs) expect(isWall(grid, npc.x, npc.y)).toBe(true);
    expect(isWall(grid, TOWN.spawn.x, TOWN.spawn.y)).toBe(false);
  });

  it('reaches every walkable tile from the spawn (no sealed pockets)', () => {
    const sealed: string[] = [];
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) if (!isWall(grid, x, y) && !reachable(x, y)) sealed.push(`${x},${y}`);
    }
    expect(sealed).toEqual([]);
  });

  it('puts no NPC on a wall, a forest or the sky, and every NPC can be talked to', () => {
    const props = new Set(TOWN.props.flatMap((p) => propSolidTiles(p).map((t) => `${t.x},${t.y}`)));
    for (const npc of TOWN.npcs) {
      expect(['grass', 'path']).toContain(groundAt(TOWN, npc.x, npc.y));
      expect(props.has(`${npc.x},${npc.y}`)).toBe(false);
      expect(reachableNear({ x: npc.x + 0.5, y: npc.y + 0.5 })).toBe(true);
    }
  });

  it('lets the player read the notice board', () => {
    expect(reachableNear(TOWN.board)).toBe(true);
  });

  it('opens the route exit on the map edge, walkable and reachable', () => {
    const { exit } = TOWN;
    expect(exit.x === 0 || exit.y === 0 || exit.x + exit.width === grid.cols || exit.y + exit.height === grid.rows).toBe(true);
    for (let y = exit.y; y < exit.y + exit.height; y++) {
      for (let x = exit.x; x < exit.x + exit.width; x++) expect(reachable(x, y)).toBe(true);
    }
  });

  it('flags a sealed pocket in a broken map', () => {
    const broken: TownMap = { ...TOWN, rows: TOWN.rows.map((row, y) => (y === 16 ? `FF.F${row.slice(4)}` : y === 15 || y === 17 ? `FFFF${row.slice(4)}` : row)), props: [] };
    const g = buildTownGrid(broken);
    const r = reachableFrom(g, broken.spawn);
    // (2,16) is grass with forest on all four sides.
    expect(isWall(g, 2, 16)).toBe(false);
    expect(r.has(16 * g.cols + 2)).toBe(false);
  });
});

describe('path tiles', () => {
  it('uses the centre of the patch inside the plaza and the edges next to grass', () => {
    expect(pathPatchCell(TOWN, 15, 10)).toEqual({ col: 1, row: 1 });
    // Left edge of the vertical spur at x = 6 (grass at x = 5), top row 6 (grass above).
    expect(pathPatchCell(TOWN, 6, 6)).toEqual({ col: 0, row: 0 });
    expect(pathPatchCell(TOWN, 7, 7)).toEqual({ col: 2, row: 1 });
  });
});
