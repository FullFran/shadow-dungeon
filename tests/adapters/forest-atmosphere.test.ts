import { beforeEach, describe, expect, it } from 'vitest';
import { FOREST } from '../../src/data/dungeons';
import { generateFloor, tileDistances } from '../../src/core/dungeon';
import { floorSeed } from '../../src/core/run';
import { isWall } from '../../src/core/tiles';
import { forestDecor, wispGuide } from '../../src/adapters/forest-decor';
import { catalog, LANGUAGES, setLanguage, t } from '../../src/i18n';
import { tileCenter } from '../../src/core/tiles';

describe('Misty Forest atmosphere', () => {
  beforeEach(() => setLanguage('es'));

  it('has a short lore line for every forest floor in every language', () => {
    const keys = FOREST.lore.floorKeys ?? [];
    expect(keys).toHaveLength(FOREST.plan.length);
    for (const language of LANGUAGES) {
      const strings = catalog(language);
      for (const key of keys) {
        expect(strings[key], `${language} ${key}`).toBeTruthy();
        expect(strings[key]!.length).toBeLessThanOrEqual(64);
        expect(strings[key]).not.toMatch(/—|Necrozma/);
      }
    }
    expect(FOREST.decor).toBe('forest');
    expect(t('forest.wisp.appear')).toBeTruthy();
  });

  it('dresses a floor deterministically: roots on lit wall faces, mushrooms on floor by the walls, logs inside rooms, one shrine at most', () => {
    let shrines = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const floor = generateFloor(floorSeed(seed, 2), 2, FOREST.spawns);
      const decor = forestDecor(floor);
      expect(forestDecor(floor)).toEqual(decor);
      expect(decor.roots.length).toBeGreaterThan(0);
      expect(decor.mushrooms.length).toBeGreaterThan(0);
      for (const r of decor.roots) {
        expect(isWall(floor, r.x, r.y)).toBe(true);
        expect(isWall(floor, r.x, r.y + 1)).toBe(false);
      }
      const nextToWall = (x: number, y: number) => isWall(floor, x - 1, y) || isWall(floor, x + 1, y) || isWall(floor, x, y - 1) || isWall(floor, x, y + 1);
      for (const m of decor.mushrooms) {
        expect(isWall(floor, m.x, m.y)).toBe(false);
        expect(nextToWall(m.x, m.y)).toBe(true);
      }
      for (const tile of [...decor.logs, ...decor.mushrooms]) {
        expect(tile.x === floor.stairs.x && tile.y === floor.stairs.y).toBe(false);
        expect(tile.x === floor.start.x && tile.y === floor.start.y).toBe(false);
      }
      for (const l of decor.logs) {
        expect(isWall(floor, l.x, l.y)).toBe(false);
        expect(floor.rooms.some((r) => l.x > r.x && l.x < r.x + r.width - 1 && l.y > r.y && l.y < r.y + r.height - 1)).toBe(true);
      }
      expect(decor.shrines.length).toBeLessThanOrEqual(1);
      shrines += decor.shrines.length;
      for (const s of decor.shrines) expect(isWall(floor, s.x, s.y) && !isWall(floor, s.x, s.y + 1)).toBe(true);
      expect(decor.fireflies.length).toBeGreaterThan(0);
    }
    expect(shrines).toBeGreaterThan(5);
  });

  it('the spirit light floats ahead of the player along the walk to the cache, and over it once there', () => {
    const floor = generateFloor(floorSeed(3, 2), 2, FOREST.spawns);
    const cache = tileCenter(floor.stairs);
    const fromStart = wispGuide(floor, cache, tileCenter(floor.start));
    // Ahead on the walk: fewer steps left to the cache than from where the player stands.
    const walk = tileDistances(floor, floor.stairs);
    const at = (p: { x: number; y: number }) => walk[Math.floor(p.y / 32) * floor.cols + Math.floor(p.x / 32)]!;
    expect(at(fromStart)).toBeLessThan(at(tileCenter(floor.start)));
    expect(at(fromStart)).toBeGreaterThanOrEqual(0);
    expect(isWall(floor, Math.floor(fromStart.x / 32), Math.floor(fromStart.y / 32))).toBe(false);
    expect(wispGuide(floor, cache, cache)).toEqual(cache);
  });
});
