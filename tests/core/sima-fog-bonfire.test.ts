import { describe, expect, it } from 'vitest';
import { bonfireFloor, bonfireLights, bonfirePos, bonfireReturn, bonfireSpot } from '../../src/core/bonfire';
import { crossFogWall, FOG_ANTE } from '../../src/core/fog-wall';
import { floorMusic, floorPlanOf, fogWallFloor, runClockStep, startRun, strayHere, withFogWall } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { CRYPT, ECLIPSE } from '../../src/data/dungeons';
import { catalog, LANGUAGES } from '../../src/i18n';
import { isEchoFloor, isHeraldFloor, isWoundFloor, ENDLESS } from '../../src/data/endless';

/** The Sima's bosses behind a fog wall with a bonfire (odd/tasks/sima-fog-bonfires.md T2). */
const SEED = 4242;
const FLOORS = 60;

const at = (floor: number, seed = SEED) => {
  const { run, world } = startRun(seed, {}, floor, ECLIPSE.id);
  return { run, world: withFogWall(run, world) };
};

describe('Sima fog walls', () => {
  it('every boss floor kind waits behind a fog: guardian echoes, the Eco del Eclipse, heralds and wounds; generated floors do not', () => {
    const kinds = new Set<string>();
    for (let floor = 1; floor <= FLOORS; floor++) {
      const boss = isEchoFloor(ENDLESS, floor);
      expect(fogWallFloor({ dungeon: ECLIPSE.id, floor }), `floor ${floor}`).toBe(boss);
      if (!boss) continue;
      kinds.add(isHeraldFloor(ENDLESS, floor) ? 'herald' : isWoundFloor(ENDLESS, floor) ? 'wound' : floor % (ENDLESS.eclipseEvery ?? 10) === 0 ? 'eco' : 'echo');
      const { run, world } = at(floor);
      expect(world.fogWall, `floor ${floor}`).toBeDefined();
      expect(world.enemies).toEqual([]);
      expect(floorMusic(run, world)).toBeNull();
      expect(crossFogWall(world).enemies.length).toBeGreaterThan(0);
    }
    expect([...kinds].sort()).toEqual(['echo', 'eco', 'herald', 'wound']);
  });

  it('a lost shadow still has its fog and its stairs past it', () => {
    let found = false;
    for (let seed = 1; seed <= 300 && !found; seed++)
      for (let floor = 12; floor <= 40 && !found; floor++) {
        if (!strayHere({ dungeon: ECLIPSE.id, floor, seed })) continue;
        const { world } = at(floor, seed);
        expect(world.fogWall).toBeDefined();
        expect(world.arena.stairs).toBeDefined();
        found = true;
      }
    expect(found).toBe(true);
  });
});

describe('Sima bonfire', () => {
  it('every boss floor has one, generated floors none; the main dungeons keep theirs at the mid-boss', () => {
    for (let floor = 1; floor <= FLOORS; floor++) expect(bonfireFloor({ dungeon: ECLIPSE.id, floor }), `floor ${floor}`).toBe(floorPlanOf({ dungeon: ECLIPSE.id, floor }).kind === 'room');
    const crypt = CRYPT.plan.map((p, i) => bonfireFloor({ dungeon: CRYPT.id, floor: i + 1 }) === (p.kind === 'room' && p.role === 'midboss'));
    expect(crypt.every(Boolean)).toBe(true);
  });

  it('lights on arrival in the antechamber, once, and burns there', () => {
    const { run, world } = at(10);
    expect(bonfireLights(run, world, false)).toBe(true);
    expect(bonfireLights(run, world, true)).toBe(false);
    const spot = bonfireSpot(run, world)!;
    expect(spot.y).toBeGreaterThan(world.fogWall!.line);
    expect(spot.y).toBeLessThan(world.fogWall!.line + FOG_ANTE);
    // Past the fog the antechamber is gone, and so is the bonfire's place.
    expect(bonfireSpot(run, crossFogWall(world))).toBeNull();
    expect(bonfireLights(run, crossFogWall(world), false)).toBe(false);
  });

  it('a main dungeon bonfire burns in the middle of its room as before', () => {
    const floor = CRYPT.plan.findIndex((p) => p.kind === 'room' && p.role === 'midboss') + 1;
    const { run, world } = startRun(SEED, {}, floor, CRYPT.id);
    const cleared: WorldState = { ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    expect(bonfireSpot(run, cleared)).toEqual(bonfirePos(cleared));
  });

  it('going back to it never gives time back: the clock stays as it was at the wipe', () => {
    const { run } = at(10);
    const lit = { ...run, clockMs: 200_000, graceMs: 3_000 };
    const now = { ...run, clockMs: 90_000, graceMs: 0 };
    expect(bonfireReturn(lit, now)).toEqual({ ...lit, clockMs: 90_000, graceMs: 0 });
    // Outside the Sima there is no clock: the snapshot comes back as it was.
    const crypt = startRun(SEED, {}, 1, CRYPT.id).run;
    expect(bonfireReturn(crypt, { ...crypt, floor: 5 })).toEqual(crypt);
  });
});

describe('the eclipse clock behind the fog', () => {
  it('stands still in the antechamber and runs again once the fog is crossed', () => {
    const { run, world } = at(15);
    const ticking = { ...run, clockMs: 100_000, graceMs: 0 };
    expect(runClockStep(ticking, world, 1000).clockMs).toBe(100_000);
    expect(runClockStep(ticking, crossFogWall(world), 1000).clockMs).toBe(99_000);
  });
});

describe('Sima bonfire texts', () => {
  it('every language says the Sima bonfire gives no time back', () => {
    for (const language of LANGUAGES)
      for (const key of ['bonfire.sima.goText', 'bonfire.sima.goLeft', 'bonfire.sima.giveText']) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
    for (const language of LANGUAGES) expect(catalog(language)['bonfire.sima.goLeft']).toContain('{n}');
  });
});
