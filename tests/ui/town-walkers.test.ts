import { describe, expect, it } from 'vitest';
import { SPRITES } from '../../src/data/sprites';
import { directionRow, TOWN_RESIDENTS, walkerAt } from '../../src/ui/town-walkers';

/** The residents walking the title's Dusk Haven (odd/tasks/title-hub.md T5). */
describe('town walkers', () => {
  it('every resident has its idle and walk sheets', () => {
    expect(TOWN_RESIDENTS.length).toBeGreaterThanOrEqual(6);
    for (const r of TOWN_RESIDENTS) {
      expect(SPRITES.sprites[r.sprite]?.anims.Idle, r.id).toBeDefined();
      expect(SPRITES.sprites[r.sprite]?.anims.Walk, r.id).toBeDefined();
    }
  });

  it('is a pure function of time and stays inside its area', () => {
    for (const r of TOWN_RESIDENTS) {
      for (let ms = 0; ms < 120000; ms += 731) {
        const a = walkerAt(r, ms);
        expect(walkerAt(r, ms)).toEqual(a);
        expect(a.x).toBeGreaterThanOrEqual(r.area.x0 - 1e-9);
        expect(a.x).toBeLessThanOrEqual(r.area.x1 + 1e-9);
        expect(a.y).toBeGreaterThanOrEqual(r.area.y0 - 1e-9);
        expect(a.y).toBeLessThanOrEqual(r.area.y1 + 1e-9);
      }
    }
  });

  it('walks some of the time and rests some of the time', () => {
    const r = TOWN_RESIDENTS.find((x) => x.area.x1 > x.area.x0)!;
    const states = Array.from({ length: 400 }, (_, i) => walkerAt(r, i * 250).moving);
    expect(states.some(Boolean)).toBe(true);
    expect(states.some((m) => !m)).toBe(true);
  });

  it('faces where it goes (PMD rows: 0 down, 2 right, 4 up, 6 left)', () => {
    expect(directionRow(0, 1)).toBe(0);
    expect(directionRow(1, 0)).toBe(2);
    expect(directionRow(0, -1)).toBe(4);
    expect(directionRow(-1, 0)).toBe(6);
    expect(directionRow(1, 1)).toBe(1);
    expect(directionRow(-1, 1)).toBe(7);
  });
});
