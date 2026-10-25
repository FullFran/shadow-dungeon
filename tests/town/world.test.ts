import { describe, expect, it } from 'vitest';
import { TOWN_PROPS } from '../../src/data/town';
import { HUB, paintRows, SIMA_DUNGEON_ID, WORLD, type WorldMap, type WorldMapId } from '../../src/data/world';
import { CRYPT, DUNGEONS, ECLIPSE } from '../../src/data/dungeons';
import { clearedDungeons, EMPTY_RECORDS, recordRun } from '../../src/town/records';
import { unlockedDungeons } from '../../src/core/dungeon-select';
import { isWall, TILE, tileOf } from '../../src/core/tiles';
import { buildTownGrid, GROUND_CHARS, groundAt, propSolidTiles, reachableFrom } from '../../src/town/map';
import { INTERACT_RANGE } from '../../src/town/interact';
import { arrival, BANNER_MS, bannerAlpha, entranceAt, entranceState, loreLines, FADE_MS, fadeAlpha, inRect, linkAt, linkEdge, offsetAlong, OPPOSITE } from '../../src/town/overworld';

const MAPS = Object.values(WORLD);
const ids = Object.keys(WORLD) as WorldMapId[];

/** Floor tiles reachable from every arrival point of a map (and its spawn). */
function reachOf(map: WorldMap): { reach: Set<number>; cols: number } {
  const grid = buildTownGrid(map);
  const reach = new Set<number>();
  const starts = map.links.map((link) => tileOf(arrival(map, link, 0).pos));
  if (map.spawn) starts.push(map.spawn);
  for (const s of starts) for (const i of reachableFrom(grid, s)) reach.add(i);
  return { reach, cols: grid.cols };
}

/** Some reachable tile has its centre within interaction range of `point` (tiles). */
function reachableNear(map: WorldMap, point: { x: number; y: number }): boolean {
  const { reach, cols } = reachOf(map);
  for (const index of reach) {
    const cx = ((index % cols) + 0.5) * TILE;
    const cy = (Math.floor(index / cols) + 0.5) * TILE;
    if (Math.hypot(cx - point.x * TILE, cy - point.y * TILE) <= INTERACT_RANGE) return true;
  }
  return false;
}

describe('world maps', () => {
  it('registers each map under its own id and has the hub', () => {
    for (const id of ids) expect(WORLD[id].id).toBe(id);
    expect(WORLD[HUB].spawn).toBeDefined();
  });

  for (const map of MAPS) {
    describe(map.id, () => {
      const grid = buildTownGrid(map);
      const { reach, cols } = reachOf(map);

      it('is a rectangle of known ground characters', () => {
        for (const row of map.rows) {
          expect(row).toHaveLength(map.rows[0]!.length);
          for (const ch of row) expect(GROUND_CHARS).toContain(ch);
        }
      });

      it('keeps every prop inside the map, its solid rows off water and chasm', () => {
        for (const prop of map.props) {
          const spec = TOWN_PROPS[prop.kind];
          expect(prop.x).toBeGreaterThanOrEqual(0);
          expect(prop.y).toBeGreaterThanOrEqual(0);
          expect(prop.x + spec.width).toBeLessThanOrEqual(grid.cols);
          expect(prop.y + spec.height).toBeLessThanOrEqual(grid.rows);
          for (const t of propSolidTiles(prop)) expect(['grass', 'path']).toContain(groundAt(map, t.x, t.y));
        }
      });

      it('reaches every floor tile from its arrivals (no sealed pockets)', () => {
        const sealed: string[] = [];
        for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) if (!isWall(grid, x, y) && !reach.has(y * cols + x)) sealed.push(`${x},${y}`);
        expect(sealed).toEqual([]);
      });

      it('puts its links on one edge each, walkable, and lands arrivals on floor outside any link', () => {
        for (const link of map.links) {
          expect(linkEdge(map, link), link.id).not.toBeNull();
          for (let y = link.y; y < link.y + link.height; y++) for (let x = link.x; x < link.x + link.width; x++) expect(isWall(grid, x, y)).toBe(false);
          const span = (link.width + link.height - 1) * TILE;
          for (let offset = 0; offset < span; offset += TILE / 2) {
            const { pos } = arrival(map, link, offset);
            const t = tileOf(pos);
            expect(isWall(grid, t.x, t.y)).toBe(false);
            expect(linkAt(pos, map.links)).toBeNull();
          }
        }
      });

      it('lets the player talk to every NPC, none standing on a wall', () => {
        for (const npc of map.npcs) {
          expect(['grass', 'path', 'bridge']).toContain(groundAt(map, npc.x, npc.y));
          expect(reachableNear(map, { x: npc.x + 0.5, y: npc.y + 0.5 })).toBe(true);
        }
        if (map.board) expect(reachableNear(map, map.board)).toBe(true);
        if (map.waystone) expect(reachableNear(map, map.waystone)).toBe(true);
        for (const point of map.lore) expect(reachableNear(map, point), point.id).toBe(true);
      });

      it('puts each dungeon entrance on reachable floor with a reachable way back outside any trigger', () => {
        for (const e of map.entrances) {
          for (let y = e.y; y < e.y + e.height; y++) for (let x = e.x; x < e.x + e.width; x++) expect(reach.has(y * cols + x), `${e.dungeon} ${x},${y}`).toBe(true);
          expect(reach.has(e.back.y * cols + e.back.x)).toBe(true);
          const back = { x: (e.back.x + 0.5) * TILE, y: (e.back.y + 0.5) * TILE };
          expect(entranceAt(back, map.entrances)).toBeNull();
          expect(linkAt(back, map.links)).toBeNull();
          for (const link of map.links) expect(entranceAt(arrival(map, link, 0).pos, map.entrances)).toBeNull();
        }
      });

      it('homes every wanderer on reachable floor', () => {
        for (const w of map.wanderers) expect(reach.has(w.y * cols + w.x), w.id).toBe(true);
      });

      it('spawns on floor', () => {
        if (map.spawn) expect(isWall(grid, map.spawn.x, map.spawn.y)).toBe(false);
      });
    });
  }

  it('pairs every link both ways, on opposite edges with equal spans', () => {
    for (const map of MAPS) {
      for (const link of map.links) {
        const other = WORLD[link.to];
        const back = other.links.find((l) => l.id === link.toLink);
        expect(back, `${map.id}.${link.id} -> ${link.to}.${link.toLink}`).toBeDefined();
        expect(back!.to).toBe(map.id);
        expect(back!.toLink).toBe(link.id);
        expect(linkEdge(other, back!)).toBe(OPPOSITE[linkEdge(map, link)!]);
        expect(back!.width + back!.height).toBe(link.width + link.height);
      }
    }
  });

  it('reaches every map from the hub through links', () => {
    const seen = new Set<WorldMapId>([HUB]);
    const queue: WorldMapId[] = [HUB];
    while (queue.length > 0) for (const link of WORLD[queue.shift()!].links) if (!seen.has(link.to)) seen.add(link.to) && queue.push(link.to);
    expect([...seen].sort()).toEqual([...ids].sort());
  });
});

describe('dungeon entrances', () => {
  const entrances = MAPS.flatMap((m) => m.entrances.map((e) => ({ map: m.id, dungeon: e.dungeon })));

  it('places every dungeon of the registry in the world, once', () => {
    for (const d of DUNGEONS) expect(entrances.filter((e) => e.dungeon === d.id)).toHaveLength(1);
  });

  it('puts the Crypt in the ruins, the Misty Forest at the pass and the Sima in the crater', () => {
    expect(entrances).toEqual(
      expect.arrayContaining([
        { map: 'ruinas', dungeon: 'crypt-of-the-sword-king' },
        { map: 'mirador', dungeon: 'misty-forest' },
        { map: 'crater', dungeon: SIMA_DUNGEON_ID },
      ]),
    );
  });

  it('opens an unlocked dungeon, seals a locked one and one missing from the registry', () => {
    const registry = ['crypt-of-the-sword-king', 'misty-forest'];
    expect(entranceState('crypt-of-the-sword-king', ['crypt-of-the-sword-king'], registry)).toBe('open');
    expect(entranceState('misty-forest', ['crypt-of-the-sword-king'], registry)).toBe('locked');
    expect(entranceState(SIMA_DUNGEON_ID, ['crypt-of-the-sword-king', 'misty-forest'], registry)).toBe('missing');
    // Unlocked but unknown (a stale list) is still missing: never depart to a dungeon that does not exist.
    expect(entranceState(SIMA_DUNGEON_ID, [SIMA_DUNGEON_ID], registry)).toBe('missing');
  });

  it("the crater's mouth is the Sima del Eclipse of the registry, open from the start", () => {
    expect(SIMA_DUNGEON_ID).toBe(ECLIPSE.id);
    expect(SIMA_DUNGEON_ID).toBe('eclipse-chasm');
    const open = unlockedDungeons(new Set()).map((d) => d.id);
    expect(entranceState(SIMA_DUNGEON_ID, open, DUNGEONS.map((d) => d.id))).toBe('open');
  });
});

describe('lore points', () => {
  const points = MAPS.flatMap((m) => m.lore);

  it('shows the base lines, then one more line per cleared dungeon', () => {
    const knight = WORLD.ruinas.lore.find((p) => p.id === 'knight')!;
    expect(loreLines(knight, new Set())).toEqual(['world.lore.knight.1']);
    expect(loreLines(knight, new Set(['crypt-of-the-sword-king']))).toEqual(['world.lore.knight.1', 'world.lore.knight.2']);
    expect(loreLines(knight, new Set(['crypt-of-the-sword-king', 'misty-forest']))).toEqual(['world.lore.knight.1', 'world.lore.knight.2', 'world.lore.knight.3']);
  });

  it("grows with the remastered six-floor Crypt: losing on Aegislash's floor 6 adds nothing, beating it adds the line", () => {
    const knight = WORLD.ruinas.lore.find((p) => p.id === 'knight')!;
    const crypt = 'crypt-of-the-sword-king';
    expect(CRYPT.plan).toHaveLength(6);
    const lost = recordRun(EMPTY_RECORDS, { dungeon: crypt, floor: CRYPT.plan.length, level: 7, species: 'zorua', victory: false });
    expect(loreLines(knight, clearedDungeons(lost))).toEqual(['world.lore.knight.1']);
    // Floor 3 is Sableye's vault: a mid-boss never clears the dungeon.
    const sableye = recordRun(EMPTY_RECORDS, { dungeon: crypt, floor: 3, level: 3, species: 'zorua', victory: false });
    expect(loreLines(knight, clearedDungeons(sableye))).toEqual(['world.lore.knight.1']);
    const won = recordRun(lost, { dungeon: crypt, floor: CRYPT.plan.length, level: 8, species: 'zorua', victory: true });
    expect(loreLines(knight, clearedDungeons(won))).toEqual(['world.lore.knight.1', 'world.lore.knight.2']);
  });

  it('has a base line on every point, and ties the rest to dungeons of the registry', () => {
    const registry = new Set<string>(DUNGEONS.map((d) => d.id));
    for (const point of points) {
      expect(point.lines.some((l) => l.after === undefined), point.id).toBe(true);
      for (const line of point.lines) if (line.after !== undefined) expect(registry.has(line.after)).toBe(true);
    }
    expect(new Set(points.map((p) => p.id)).size).toBe(points.length);
    expect(points.length).toBeGreaterThanOrEqual(4);
  });
});

describe('links and arrivals', () => {
  const map = { rows: paintRows(10, 8, '.', []) };

  it('finds the edge a link lies on', () => {
    expect(linkEdge(map, { x: 0, y: 3, width: 1, height: 2 })).toBe('west');
    expect(linkEdge(map, { x: 9, y: 3, width: 1, height: 2 })).toBe('east');
    expect(linkEdge(map, { x: 4, y: 0, width: 2, height: 1 })).toBe('north');
    expect(linkEdge(map, { x: 4, y: 7, width: 2, height: 1 })).toBe('south');
    expect(linkEdge(map, { x: 4, y: 4, width: 1, height: 1 })).toBeNull();
  });

  it('arrives one tile inside, keeping the offset along the edge and facing inward', () => {
    const west = { x: 0, y: 3, width: 1, height: 2 };
    expect(arrival(map, west, TILE * 1.2)).toEqual({ pos: { x: 1.5 * TILE, y: 4.5 * TILE }, facing: { x: 1, y: 0 } });
    expect(arrival(map, west, -50).pos).toEqual({ x: 1.5 * TILE, y: 3.5 * TILE });
    const north = { x: 4, y: 0, width: 2, height: 1 };
    expect(arrival(map, north, 999)).toEqual({ pos: { x: 5.5 * TILE, y: 1.5 * TILE }, facing: { x: 0, y: 1 } });
    const east = { x: 9, y: 3, width: 1, height: 2 };
    expect(arrival(map, east, 0).pos).toEqual({ x: 8.5 * TILE, y: 3.5 * TILE });
  });

  it('measures the offset along the edge a walker leaves through', () => {
    const east = { x: 9, y: 3, width: 1, height: 2 };
    expect(offsetAlong({ x: 9.5 * TILE, y: 4.25 * TILE }, east, 'east')).toBe(1.25 * TILE);
    expect(inRect({ x: 9.5 * TILE, y: 4.25 * TILE }, east)).toBe(true);
    expect(inRect({ x: 8.5 * TILE, y: 4.25 * TILE }, east)).toBe(false);
  });

  it('paints strokes over a fill in order, clipped to the map', () => {
    expect(paintRows(4, 2, '.', [['F', 0, 0, 4, 1], [',', 2, 0, 5, 5]])).toEqual(['FF,,', '..,,']);
  });
});

describe('fade and banner', () => {
  it('goes black over the out half and back over the in half', () => {
    expect(fadeAlpha(null)).toBe(0);
    expect(fadeAlpha({ phase: 'out', ms: 0 })).toBe(0);
    expect(fadeAlpha({ phase: 'out', ms: FADE_MS })).toBe(1);
    expect(fadeAlpha({ phase: 'in', ms: FADE_MS / 2 })).toBeCloseTo(0.5);
    expect(fadeAlpha({ phase: 'in', ms: FADE_MS * 3 })).toBe(0);
  });

  it('shows the map name, then fades it out', () => {
    expect(bannerAlpha(1000)).toBe(1);
    expect(bannerAlpha(BANNER_MS - 250)).toBeCloseTo(0.5);
    expect(bannerAlpha(BANNER_MS)).toBe(0);
  });
});
