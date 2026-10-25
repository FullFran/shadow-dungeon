import { describe, expect, it } from 'vitest';
import { RUN, RUN_PLAN } from '../../src/data/dungeon';
import { generateFloor } from '../../src/core/dungeon';
import { floorSeed, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { tileCenter } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { input } from './helpers';

const SEED = 20261025;

/** Puts the player on the stairs of the current floor. */
const toStairs = (world: WorldState): WorldState => ({
  ...world,
  player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) },
});

function descend(progress: RunProgress): RunProgress {
  return progressRun(progress.run, toStairs(progress.world));
}

describe('run structure', () => {
  it('starts on floor 1, generated from a floor seed derived from the run seed', () => {
    const { run, world } = startRun(SEED, {});
    expect(run).toEqual({ seed: SEED, floor: 1 });
    const floor = generateFloor(floorSeed(SEED, 1), 1);
    expect(world.arena.tiles).toEqual(floor);
    expect(world.player.pos).toEqual(tileCenter(floor.start));
    expect(floorSeed(SEED, 1)).not.toBe(floorSeed(SEED, 2));
    expect(floorSeed(SEED, 2)).toBe(floorSeed(SEED, 2));
  });

  it('follows the floor plan: stairs lead down floors 1-3 and floor 4 is the Aegislash arena', () => {
    expect(RUN_PLAN).toHaveLength(4);
    let progress: RunProgress = { ...startRun(SEED, {}), entered: false, outcome: null };
    for (const floor of [2, 3]) {
      progress = descend(progress);
      expect(progress.entered).toBe(true);
      expect(progress.run.floor).toBe(floor);
      expect(progress.world.arena.tiles).toEqual(generateFloor(floorSeed(SEED, floor), floor));
    }
    progress = descend(progress);
    expect(progress.run.floor).toBe(4);
    expect(progress.world.arena.tiles).toBeUndefined();
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['aegislash']);
  });

  it('does nothing while the player is off the stairs', () => {
    const { run, world } = startRun(SEED, {});
    const progress = progressRun(run, world);
    expect(progress.entered).toBe(false);
    expect(progress.run).toBe(run);
    expect(progress.world).toBe(world);
  });

  it('carries HP over, heals a fraction of max HP on each new floor and resets Disguise', () => {
    const { run, world } = startRun(SEED, {});
    const hurt = { ...world, player: { ...world.player, hp: 40, disguiseBroken: true } };
    const next = progressRun(run, toStairs(hurt));
    expect(next.world.player.hp).toBe(40 + RUN.floorHeal * world.player.maxHp);
    expect(next.world.player.disguiseBroken).toBe(false);
    const nearlyFull = { ...next.world, player: { ...next.world.player, hp: next.world.player.maxHp - 5 } };
    expect(progressRun(next.run, toStairs(nearlyFull)).world.player.hp).toBe(world.player.maxHp);
  });

  it('ends in defeat at 0 HP and in victory when the boss floor is cleared', () => {
    const { run, world } = startRun(SEED, {});
    expect(progressRun(run, { ...world, player: { ...world.player, hp: 0 } }).outcome).toBe('defeat');
    let progress: RunProgress = { run, world, entered: false, outcome: null };
    for (let i = 0; i < 3; i++) progress = descend(progress);
    expect(progressRun(progress.run, progress.world).outcome).toBeNull();
    const cleared = { ...progress.world, enemies: progress.world.enemies.map((e) => ({ ...e, alive: false })) };
    expect(progressRun(progress.run, cleared).outcome).toBe('victory');
  });

  it('replays a full scripted run identically from the same seed', () => {
    const script = (seed: number) => {
      let progress: RunProgress = { ...startRun(seed, {}), entered: false, outcome: null };
      const trace: unknown[] = [];
      for (let floor = 0; floor < 3; floor++) {
        for (let tick = 0; tick < 240; tick++) {
          const playerInput: PlayerInput = input({
            move: vec(Math.cos(tick / 20), Math.sin(tick / 30)),
            roll: tick % 50 === 0,
            slots: [tick % 37 < 3, false],
            aim: vec(300, 300),
          });
          progress = progressRun(progress.run, step(progress.world, playerInput, FIXED_DT_MS));
        }
        trace.push(progress.world.player, progress.world.enemies, progress.world.rng);
        progress = descend(progress);
      }
      trace.push(progress.run, progress.world);
      return trace;
    };
    const first = script(SEED);
    expect(script(SEED)).toEqual(first);
    expect(script(SEED + 1)).not.toEqual(first);
  });
});
