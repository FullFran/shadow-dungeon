import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/data/world';
import { isWall, TILE, tileOf } from '../../src/core/tiles';
import { buildTownGrid } from '../../src/town/map';
import { townArena } from '../../src/town/interact';
import { birdAt, fogBank, leafAt, startWander, stepWander } from '../../src/town/ambience';

describe('ambient particles', () => {
  it('keeps leaves inside the view and birds in the sky band, the same at the same time', () => {
    for (let i = 0; i < 20; i++) {
      for (const ms of [0, 1234, 98765, 4e6]) {
        const leaf = leafAt(i, ms, 512, 320);
        expect(leaf.x).toBeGreaterThanOrEqual(0);
        expect(leaf.x).toBeLessThan(512);
        expect(leaf.y).toBeGreaterThanOrEqual(0);
        expect(leaf.y).toBeLessThan(320);
        const bird = birdAt(i, ms, 512, 64);
        expect(bird.y).toBeLessThan(64);
        expect(bird.x).toBeGreaterThanOrEqual(-30);
        expect(birdAt(i, ms, 512, 64)).toEqual(bird);
        const fog = fogBank(i, ms, 300, 512, 320);
        expect(fog.x).toBeGreaterThanOrEqual(-120);
        expect(fog.x).toBeLessThan(512 + 120);
      }
    }
  });

  it('moves leaves over time', () => {
    expect(leafAt(3, 0, 512, 320)).not.toEqual(leafAt(3, 500, 512, 320));
  });
});

describe('wandering Pokémon', () => {
  for (const map of Object.values(WORLD)) {
    for (const w of map.wanderers) {
      it(`${map.id}/${w.id} ambles on floor near home and does move`, () => {
        const arena = townArena(buildTownGrid(map));
        let state = startWander(w);
        const start = state.pos;
        let farthest = 0;
        for (let i = 0; i < 4000; i++) {
          state = stepWander(w, state, 16, arena);
          const t = tileOf(state.pos);
          expect(isWall(arena.tiles!, t.x, t.y)).toBe(false);
          expect(Math.abs(t.x - w.x)).toBeLessThanOrEqual(w.radius + 1);
          expect(Math.abs(t.y - w.y)).toBeLessThanOrEqual(w.radius + 1);
          farthest = Math.max(farthest, Math.hypot(state.pos.x - start.x, state.pos.y - start.y));
        }
        expect(farthest).toBeGreaterThan(TILE / 2);
      });
    }
  }

  it('is deterministic', () => {
    const w = WORLD.mirador.wanderers[0]!;
    const arena = townArena(buildTownGrid(WORLD.mirador));
    const run = () => {
      let s = startWander(w);
      for (let i = 0; i < 500; i++) s = stepWander(w, s, 16, arena);
      return s;
    };
    expect(run()).toEqual(run());
  });
});
