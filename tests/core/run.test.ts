import { describe, expect, it } from 'vitest';
import { RUN, RUN_PLAN } from '../../src/data/dungeon';
import { generateFloor, type Floor } from '../../src/core/dungeon';
import { withDoors } from '../../src/core/sima-events';
import { chooseItem, floorPlanOf, floorSeed, progressRun, startRun, withRewardOffer, type RunProgress } from '../../src/core/run';
import { ROOMS } from '../../src/data/rooms';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { tileCenter } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { input, openGate } from './helpers';

const SEED = 20261025;

/** Puts the player on the stairs of the current floor. */
const toStairs = (world: WorldState): WorldState => ({
  ...openGate(world),
  player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) },
});

/** Stands on the exit of a fixed room with its enemies down (the Crypt's mid-boss vault). */
const toExit = (world: WorldState, room: keyof typeof ROOMS): WorldState => {
  const exit = ROOMS[room].exit!;
  return {
    ...world,
    enemies: world.enemies.map((e) => ({ ...e, alive: false })),
    player: { ...world.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) },
  };
};

/** Takes the stairs, or the exit of a mid-boss room after beating it. */
function descend(progress: RunProgress): RunProgress {
  const plan = floorPlanOf(progress.run);
  return progressRun(progress.run, plan.kind === 'room' ? toExit(progress.world, plan.room) : toStairs(progress.world));
}

describe('run structure', () => {
  it('starts on floor 1, generated from a floor seed derived from the run seed', () => {
    const { run, world } = startRun(SEED, {});
    expect(run).toEqual({ seed: SEED, dungeon: 'crypt-of-the-sword-king', floor: 1, kind: 'normal', escape: null, offer: null });
    const floor = generateFloor(floorSeed(SEED, 1), 1);
    expect(world.arena.tiles).toEqual(floor);
    expect(world.player.pos).toEqual(tileCenter(floor.start));
    expect(floorSeed(SEED, 1)).not.toBe(floorSeed(SEED, 2));
    expect(floorSeed(SEED, 2)).toBe(floorSeed(SEED, 2));
  });

  it('follows the floor plan: floors 1-2 and 4-5 generated, Sableye on 3 (through its exit), Aegislash on 6', () => {
    expect(RUN_PLAN).toHaveLength(6);
    let progress: RunProgress = { ...startRun(SEED, {}), entered: false, outcome: null };
    for (const floor of [2, 3, 4, 5]) {
      progress = descend(progress);
      expect(progress.entered).toBe(true);
      expect(progress.run.floor).toBe(floor);
      if (floor === 3) {
        expect(progress.world.arena.tiles).toBeUndefined();
        expect(progress.world.enemies.map((e) => e.species)).toEqual(['sableye']);
        // The vault only opens once Sableye is down.
        const exit = ROOMS.vault.exit!;
        const standing = { ...progress.world, player: { ...progress.world.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } };
        expect(progressRun(progress.run, standing).entered).toBe(false);
      } else {
        // The floor as generated; its groups' leaders are crowned afterwards (core/leaders.ts), so compare the map, not the spawn list.
        // A key gate locks the stairs room's doorways (core/gates.ts): the generated map with those tiles shut.
        const { spawns: _crowned, ...map } = progress.world.arena.tiles as Floor;
        const drawn = generateFloor(floorSeed(SEED, floor), floor);
        const doors = progress.world.gate?.doors;
        const { spawns: _drawn, ...generated } = doors ? { ...drawn, ...withDoors(drawn, doors, true) } : drawn;
        expect(map).toEqual(generated);
      }
    }
    progress = descend(progress);
    expect(progress.run.floor).toBe(6);
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
    for (let i = 0; i < 5; i++) progress = descend(progress);
    expect(progressRun(progress.run, progress.world).outcome).toBeNull();
    const cleared = { ...progress.world, enemies: progress.world.enemies.map((e) => ({ ...e, alive: false })) };
    expect(progressRun(progress.run, cleared).outcome).toBe('victory');
  });

  it('replays a full scripted run identically from the same seed', () => {
    const script = (seed: number) => {
      let progress: RunProgress = { ...startRun(seed, {}), entered: false, outcome: null };
      const trace: unknown[] = [];
      for (let floor = 0; floor < 5; floor++) {
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
  it('a scripted run that fights gains levels and items, and replays identically', () => {
    const fight = (progress: RunProgress): RunProgress => {
      let current = progress;
      for (const target of progress.world.enemies) {
        // Scripted: stand on the enemy, healed, and swing until it falls (or time runs out).
        current = { ...current, world: { ...current.world, player: { ...current.world.player, pos: target.pos, hp: current.world.player.maxHp } } };
        for (let tick = 0; tick < 240 && current.world.enemies.find((e) => e.id === target.id)?.alive; tick++) {
          const swing = tick % 24 === 0;
          const playerInput = input({ aim: vec(target.pos.x + 30, target.pos.y), slots: [swing, false], slotMouse: [swing, false] });
          current = { ...current, world: step(current.world, playerInput, FIXED_DT_MS) };
        }
      }
      // Healed before the stairs too: the script tests progression, not survival.
      return { ...current, world: { ...current.world, player: { ...current.world.player, hp: current.world.player.maxHp } } };
    };
    const script = (seed: number) => {
      let progress: RunProgress = { ...startRun(seed, {}), entered: false, outcome: null };
      for (let floor = 1; floor <= 5; floor++) {
        progress = descend(fight(progress));
        progress = { ...progress, ...chooseItem(withRewardOffer(progress.run, progress.world), progress.world, floor % 3) };
      }
      return progress;
    };
    const first = script(SEED);
    expect(first.run.floor).toBe(6);
    expect(first.world.player.level).toBeGreaterThan(2);
    expect(first.world.player.items).toHaveLength(5);
    expect(script(SEED)).toEqual(first);
    expect(script(SEED + 1).world.player).not.toEqual(first.world.player);
  });
});
