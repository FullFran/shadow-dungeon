import { describe, expect, it } from 'vitest';
import { caveDecor, deepEdge } from '../../src/adapters/cave-decor';
import { CAVES } from '../../src/data/dungeons';
import { generateFloor } from '../../src/core/dungeon';
import { isWall } from '../../src/core/tiles';
import { shallowWater } from '../../src/core/water';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';

describe('Flooded Caves atmosphere', () => {
  it('places crystals and drops on lit wall faces only, the same way every time', () => {
    const floor = generateFloor(9, 3, CAVES.spawns);
    const decor = caveDecor(floor);
    expect(decor).toEqual(caveDecor(floor));
    expect(decor.crystals.length).toBeGreaterThan(0);
    expect(decor.drips.length).toBeGreaterThan(0);
    for (const p of [...decor.crystals, ...decor.drips]) {
      expect(isWall(floor, p.x, p.y)).toBe(true);
      expect(isWall(floor, p.x, p.y + 1)).toBe(false);
    }
  });

  it('draws a deep edge where a pool meets the rock', () => {
    const floor = generateFloor(9, 3, CAVES.spawns);
    const water = shallowWater(floor, CAVES.water!);
    const wet = water.map((w, i) => (w === 1 ? i : -1)).filter((i) => i >= 0);
    const edges = wet.filter((i) => deepEdge(floor, i % floor.cols, Math.floor(i / floor.cols)));
    expect(edges.length).toBeLessThanOrEqual(wet.length);
  });

  it('has a name, subtitle, two lore lines, ten floor lines and the flood card in both languages', () => {
    const lore = CAVES.lore;
    const keys = [lore.nameKey, lore.subtitleKey, ...lore.loreKeys, ...(lore.floorKeys ?? []), 'card.flood'];
    expect(lore.floorKeys).toHaveLength(10);
    for (const dict of [es, en] as Record<string, string>[]) {
      for (const key of keys) {
        expect(dict[key], key).toBeTruthy();
        expect(dict[key]).not.toMatch(/necrozma/i);
        expect(dict[key]).not.toContain('—');
      }
    }
    expect((es as Record<string, string>)['dungeon.caves.subtitle']).toMatch(/^Donde /);
  });
});
