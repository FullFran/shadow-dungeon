import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { TOWN_TOUR, tourKeys } from '../../src/data/town-tour';
import { SPRITE_KEYS } from '../../src/data/sprites';
import { HUB, WORLD } from '../../src/data/world';
import { TILE, wallAt } from '../../src/core/tiles';
import { buildTownGrid } from '../../src/town/map';
import { hasSeenTour, markTourSeen, skipTour, startTour, stepTour, tourEndSpot, tourSpoken, tourStop, type TourState } from '../../src/town/tour';
import { catalog, LANGUAGES } from '../../src/i18n';

/**
 * The welcome tour of the Refugio after the Sunken Way (odd/tasks/tutorial-dungeon.md
 * S9-S10): the guide comes to the player, then leads it to the shop, the
 * move tutor, the notice board, the Santuario and last the waystone; Esc
 * skips it whole; it plays once per device.
 */
const SPAWN = { x: 15.5 * TILE, y: 9.5 * TILE };
const run = (state: TourState, ms: number): TourState => {
  let s = state;
  for (let i = 0; i < ms / 50 && s.phase !== 'talk' && s.phase !== 'done'; i++) s = stepTour(s, 50, TILE);
  return s;
};

describe('town tour', () => {
  it('stops at the shop, the tutor, the board, the shrine and last the waystone, after the welcome', () => {
    expect(TOWN_TOUR.stops.map((s) => s.id)).toEqual(['welcome', 'shop', 'tutor', 'board', 'shrine', 'waystone']);
  });

  it('waits for the banner, brings the guide to the player, then walks every stop in order and ends at the waystone', () => {
    let s = startTour(TILE, SPAWN);
    expect(s.phase).toBe('wait');
    expect(stepTour(s, 500, TILE).guide).toEqual(s.guide);
    const visited: string[] = [];
    for (let guard = 0; guard < 20 && s.phase !== 'done'; guard++) {
      s = run(s, 60_000);
      expect(s.phase).toBe('talk');
      const stop = tourStop(s)!;
      visited.push(stop.id);
      // Both stand at their spots for this stop while the guide speaks.
      const g = stop.guide.at(-1)!;
      expect(s.guide.x).toBeCloseTo(g.x * TILE);
      expect(s.guide.y).toBeCloseTo(g.y * TILE);
      const p = stop.player.at(-1);
      if (p) expect([s.player.x, s.player.y]).toEqual([p.x * TILE, p.y * TILE]);
      // Nothing moves while it talks.
      expect(stepTour(s, 1000, TILE).guide).toEqual(s.guide);
      s = tourSpoken(s);
    }
    expect(visited).toEqual(['welcome', 'shop', 'tutor', 'board', 'shrine', 'waystone']);
    expect(s.phase).toBe('done');
    expect(tourStop(s)).toBeNull();
    expect(s.player).toEqual(tourEndSpot(TILE));
  });

  it('the player trails the guide instead of walking into it', () => {
    let s = tourSpoken(run(startTour(TILE, SPAWN), 60_000));
    for (let i = 0; i < 400 && s.phase === 'walk'; i++) {
      s = stepTour(s, 50, TILE);
      if (s.phase === 'walk' && s.guideMoving) expect(Math.hypot(s.guide.x - s.player.x, s.guide.y - s.player.y)).toBeGreaterThan(TILE * 0.9);
    }
  });

  it('Esc skips it whole: done from any phase, and it ends at the waystone', () => {
    const waiting = startTour(TILE, SPAWN);
    const walking = stepTour(stepTour(waiting, 5000, TILE), 200, TILE);
    for (const s of [waiting, walking, run(waiting, 60_000)]) {
      expect(skipTour(s).phase).toBe('done');
      expect(tourSpoken(skipTour(s)).phase).toBe('done');
    }
    expect(tourEndSpot(TILE)).toEqual({ x: 29 * TILE, y: 9.6 * TILE });
  });

  it('every route crosses open ground of the hub, and the player ends by the waystone', () => {
    const map = WORLD[HUB];
    const grid = buildTownGrid(map);
    const home = TOWN_TOUR.home;
    const routes = TOWN_TOUR.stops.flatMap((stop, i) => {
      const prev = TOWN_TOUR.stops[i - 1];
      const guideFrom = prev ? prev.guide.at(-1)! : home;
      const playerFrom = prev ? (TOWN_TOUR.stops.slice(0, i).flatMap((s) => s.player).at(-1) ?? { x: 15.5, y: 9.5 }) : { x: 15.5, y: 9.5 };
      return [
        { who: `${stop.id} guide`, points: [guideFrom, ...stop.guide] },
        { who: `${stop.id} player`, points: [playerFrom, ...stop.player] },
      ];
    });
    for (const { who, points } of routes) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!;
        const b = points[i]!;
        for (let k = 0; k <= 20; k++) {
          const x = a.x + ((b.x - a.x) * k) / 20;
          const y = a.y + ((b.y - a.y) * k) / 20;
          // The guide sets off from its own (solid) NPC tile.
          if (Math.floor(x) === Math.floor(home.x) && Math.floor(y) === Math.floor(home.y)) continue;
          expect(wallAt(grid, { x: x * TILE, y: y * TILE }), `${who} ${x.toFixed(1)},${y.toFixed(1)}`).toBe(false);
        }
      }
    }
    const end = tourEndSpot(TILE);
    expect(Math.hypot(end.x - map.waystone.x * TILE, end.y - map.waystone.y * TILE)).toBeLessThan(48);
  });

  it('the guide is a villager of the hub (its own sheet, spot and name)', () => {
    const npc = WORLD[HUB].npcs.find((n) => n.id === TOWN_TOUR.npcId)!;
    expect(npc.species).toBe(TOWN_TOUR.species);
    expect(TOWN_TOUR.home).toEqual({ x: npc.x + 0.5, y: npc.y + 0.5 });
    expect(SPRITE_KEYS[TOWN_TOUR.species]).toBeTruthy();
    expect(catalog('es')[TOWN_TOUR.nameKey]).toBeTruthy();
  });

  for (const language of LANGUAGES) {
    it(`has every line in "${language}", short, and never with an em dash`, () => {
      const strings = catalog(language);
      for (const stop of TOWN_TOUR.stops) {
        expect(stop.lines).toBeGreaterThanOrEqual(1);
        expect(stop.lines).toBeLessThanOrEqual(2);
        for (const key of tourKeys(stop)) {
          expect(strings[key], key).toBeTruthy();
          expect(strings[key]!.length, key).toBeLessThanOrEqual(150);
          expect(strings[key], key).not.toContain('—');
        }
      }
    });
  }

  it('remembers it was seen on this device, and a broken store never traps the player in it', () => {
    const store = memoryStore();
    expect(hasSeenTour(store)).toBe(false);
    markTourSeen(store);
    expect(hasSeenTour(store)).toBe(true);
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); } };
    expect(hasSeenTour(broken)).toBe(true);
    expect(() => markTourSeen(broken)).not.toThrow();
  });
});
