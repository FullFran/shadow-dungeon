import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/core/dungeon';
import { placePools } from '../../src/core/toxic';
import { isWall, TILE } from '../../src/core/tiles';
import { shallowWater } from '../../src/core/water';
import { CAVES, CHALLENGES, DUNGEONS, SENDA_ROADS, TUTORIAL } from '../../src/data/dungeons';
import { SIMA_BANDS } from '../../src/data/sima';
import { ART_THEMES, artThemeOf, floorProps, floorVariant, floorSignature, THEME_SETS } from '../../src/adapters/floor-art';

/** The dungeon art pass (odd/tasks/dungeon-art-pass.md): presentation only, placed from the floor every peer shares. */

const EVERY_DUNGEON = [...DUNGEONS, TUTORIAL, ...CHALLENGES, ...SENDA_ROADS];
const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);

/** Doorways: a room's edge tile with walkable ground just outside the room (a corridor mouth). */
function isDoorway(rooms: readonly { x: number; y: number; width: number; height: number }[], grid: Parameters<typeof isWall>[0], x: number, y: number): boolean {
  return rooms.some((r) => {
    const inside = x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    if (!inside) return false;
    const out = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].filter(([nx, ny]) => !(nx! >= r.x && nx! < r.x + r.width && ny! >= r.y && ny! < r.y + r.height));
    return out.some(([nx, ny]) => !isWall(grid, nx!, ny!));
  });
}

describe('dungeon art sets', () => {
  it('gives every dungeon (main, tutorial, challenges, Senda roads) a decoration set', () => {
    for (const dungeon of EVERY_DUNGEON) {
      const theme = artThemeOf(dungeon.decor ?? null, false);
      expect(ART_THEMES, dungeon.id).toContain(theme);
      expect(THEME_SETS[theme].props.length, dungeon.id).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives every Sima band a decoration set, the abyss its own', () => {
    for (const band of SIMA_BANDS) {
      const theme = artThemeOf(band.decor ?? null, band.abyss === true);
      expect(ART_THEMES, band.id).toContain(theme);
      expect(theme).toBe(band.abyss ? 'abyss' : band.decor);
    }
  });
});

describe('prop placement', () => {
  it('is a pure, deterministic function of the floor', () => {
    for (const theme of ART_THEMES) {
      for (const seed of SEEDS) {
        const floor = generateFloor(seed, 3);
        const before = JSON.stringify(floor);
        const a = floorProps(floor, theme);
        const b = floorProps(structuredClone(floor), theme);
        expect(a).toEqual(b);
        expect(JSON.stringify(floor)).toBe(before);
      }
    }
  });

  it('keeps props off walls, stairs, the start, spawn points, doorways, water and toxic pools', () => {
    for (const theme of ART_THEMES) {
      for (const seed of SEEDS) {
        const floor = generateFloor(seed, 3);
        const water = theme === 'caves' ? shallowWater(floor, CAVES.water!) : undefined;
        const pools = theme === 'swamp' ? placePools(floor, seed) : undefined;
        const props = floorProps({ ...floor, ...(water ? { water } : {}), ...(pools ? { pools } : {}) }, theme);
        const reserved = new Set([floor.start, floor.stairs, ...floor.spawns.map((s) => s.tile)].map((t) => `${t.x},${t.y}`));
        for (const p of props) {
          const at = `${theme} seed ${seed} prop ${p.kind} at ${p.x},${p.y}`;
          expect(isWall(floor, p.x, p.y), at).toBe(false);
          expect(reserved.has(`${p.x},${p.y}`), at).toBe(false);
          expect(isDoorway(floor.rooms, floor, p.x, p.y), at).toBe(false);
          expect(Math.max(Math.abs(p.x - floor.stairs.x), Math.abs(p.y - floor.stairs.y)), at).toBeGreaterThan(1);
          if (water) expect(water[p.y * floor.cols + p.x], at).not.toBe(1);
          for (const pool of pools ?? []) expect(Math.hypot((p.x + 0.5) * TILE - pool.x, (p.y + 0.5) * TILE - pool.y), at).toBeGreaterThan(pool.radius);
        }
      }
    }
  });

  it('fills the rooms: every floor gets props in most of its rooms', () => {
    for (const theme of ART_THEMES) {
      let rooms = 0;
      let dressed = 0;
      for (const seed of SEEDS) {
        const floor = generateFloor(seed, 3);
        const props = floorProps(floor, theme);
        for (const r of floor.rooms) {
          rooms++;
          if (props.some((p) => p.x >= r.x && p.x < r.x + r.width && p.y >= r.y && p.y < r.y + r.height)) dressed++;
        }
      }
      expect(dressed / rooms, theme).toBeGreaterThan(0.75);
    }
  });

  it('changes with the floor: two floors do not share their props', () => {
    const a = floorProps(generateFloor(1, 3), 'crypt');
    const b = floorProps(generateFloor(2, 3), 'crypt');
    expect(a).not.toEqual(b);
  });
});

describe('floor tile variation', () => {
  it('picks several stable variants from a seeded hash', () => {
    const floor = generateFloor(4, 2);
    const sig = floorSignature(floor);
    expect(floorSignature(structuredClone(floor))).toBe(sig);
    const seen = new Set<number>();
    for (let y = 0; y < floor.rows; y++) {
      for (let x = 0; x < floor.cols; x++) {
        const v = floorVariant(x, y, sig);
        expect(floorVariant(x, y, sig)).toBe(v);
        seen.add(v);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
});

describe('decoration stays out of the simulation', () => {
  const ROOT = join(__dirname, '../..');
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const path = join(dir, entry);
      return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : [];
    });

  it('is imported by no simulation, netcode or harness module', () => {
    const offenders = ['src/core', 'src/data', 'src/net', 'src/sim']
      .flatMap((dir) => files(join(ROOT, dir)))
      .filter((file) => /floor-art|floor-layer/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
