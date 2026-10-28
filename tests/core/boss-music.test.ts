import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { crossFogWall } from '../../src/core/fog-wall';
import { dungeonOf, floorCount, floorMusic, floorPlanOf, fogWallFloor, startRun, withFogWall } from '../../src/core/run';
import { CHALLENGES, DUNGEONS, musicFor, SENDA_ROADS } from '../../src/data/dungeons';
import { heraldStop, SHRINE_BOSSES, startTrial } from '../../src/core/shrine';

/**
 * Boss music only after the fog (odd/tasks/sima-fog-bonfires.md T1): behind
 * the fog the antechamber has no music (ambience only); once crossed, the
 * boss track of the floor plays. Every dungeon with a boss, so a missing one
 * fails here.
 */
const SEED = 4242;
const SIMA_FLOORS = 60;

/** Every floor of every dungeon that meets its boss behind a fog wall. */
function fogFloors(): { dungeon: string; floor: number }[] {
  const out: { dungeon: string; floor: number }[] = [];
  for (const def of [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS]) {
    const last = def.endless ? SIMA_FLOORS : floorCount({ dungeon: def.id });
    for (let floor = 1; floor <= last; floor++) if (fogWallFloor({ dungeon: def.id, floor, seed: SEED })) out.push({ dungeon: def.id, floor });
  }
  return out;
}

describe('boss music after the fog', () => {
  it('every dungeon with a boss is covered', () => {
    const floors = fogFloors();
    for (const def of [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS]) expect(floors.some((f) => f.dungeon === def.id), def.id).toBe(true);
  });

  it('no music behind the fog; the boss track once crossed', () => {
    for (const { dungeon, floor } of fogFloors()) {
      const { run, world } = startRun(SEED, {}, floor, dungeon as never);
      const fogged = withFogWall(run, world);
      expect(fogged.fogWall, `${dungeon} ${floor}`).toBeDefined();
      expect(floorMusic(run, fogged), `${dungeon} ${floor}`).toBeNull();
      const boss = musicFor(dungeonOf(run), floorPlanOf(run), run.kind, run.floor);
      expect(floorMusic(run, crossFogWall(fogged)), `${dungeon} ${floor}`).toBe(boss);
    }
  });

  it('every shrine trial arena: no music behind its fog, its track once crossed', () => {
    for (const stop of [...SHRINE_BOSSES, heraldStop(12345)]) {
      const { run, world } = startTrial(SEED, {}, [stop]);
      expect(world.fogWall, stop.boss).toBeDefined();
      expect(floorMusic(run, world), stop.boss).toBeNull();
      expect(floorMusic(run, crossFogWall(world)), stop.boss).toBe(musicFor(dungeonOf(run), floorPlanOf(run), run.kind, run.floor));
    }
  });

  it('a floor without a fog wall plays its music from the start', () => {
    const { run, world } = startRun(SEED, {}, 1, DUNGEONS[0]!.id);
    expect(world.fogWall).toBeUndefined();
    expect(floorMusic(run, world)).toBe(musicFor(dungeonOf(run), floorPlanOf(run), run.kind, run.floor));
  });
});

describe('the crossing sequence (app/game.ts)', () => {
  const game = readFileSync(join(__dirname, '../../src/app/game.ts'), 'utf8');
  const body = (name: string) => {
    const at = game.indexOf(`function ${name}(`);
    expect(at, name).toBeGreaterThan(-1);
    return game.slice(at, game.indexOf('\n  }\n', at));
  };

  it('the in-run music follows the fog rule', () => {
    expect(game).toMatch(/const music = \(\) => \{\s*const context = floorMusic\(run, world\);/);
  });

  it('crossing: boss scenes and cinematic first, then the boss music', () => {
    const crossed = body('crossedFog');
    const order = ['simaMoment(', 'guardianMoment(', 'heraldMoment(', 'music()'].map((s) => crossed.indexOf(s));
    expect(order.every((i) => i > -1), crossed).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('restarting a floor goes back to the antechamber music (none)', () => {
    expect(body('restartFloor')).toContain('music()');
  });
});
