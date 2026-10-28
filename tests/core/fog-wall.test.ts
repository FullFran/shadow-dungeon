import { describe, expect, it } from 'vitest';
import { atFogWall, closeFogWall, crossFogWall, FOG_ANTE } from '../../src/core/fog-wall';
import { atLeavingPoint, floorCount, floorPlanOf, fogWallFloor, progressRun, startRun, type RunState } from '../../src/core/run';
import { roomCleared } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { CHALLENGES, CRYPT, DUNGEONS, dungeonById } from '../../src/data/dungeons';
import { ROOMS } from '../../src/data/rooms';
import { input } from './helpers';

/** The fog wall before a boss (odd/tasks/coop-flow.md T4, docs/gdd.md §3). */
const SEED = 4242;

/** Every fixed-room floor of every main and challenge dungeon (the Sima's first floors of its echoes too). */
function roomFloors(): { dungeon: string; floor: number }[] {
  const out: { dungeon: string; floor: number }[] = [];
  for (const def of [...DUNGEONS, ...CHALLENGES]) {
    const last = def.endless ? 30 : def.plan.length;
    for (let floor = 1; floor <= last; floor++) {
      const plan = floorPlanOf({ dungeon: def.id, floor });
      if (plan.kind === 'room') out.push({ dungeon: def.id, floor });
    }
  }
  return out;
}

const bossRoom = (dungeon: string, floor: number): { run: RunState; world: WorldState } => startRun(SEED, {}, floor, dungeon as never);

const crypt = () => {
  const def = CRYPT;
  const floor = def.plan.length;
  return bossRoom(CRYPT.id, floor);
};

describe('fog wall', () => {
  it('every boss room has one: mid-bosses and guardians of the main and challenge dungeons, and every Sima boss (echoes, Eco, heralds, wounds); generated floors do not', () => {
    const floors = roomFloors();
    expect(floors.length).toBeGreaterThan(8);
    expect(floors.some(({ dungeon }) => dungeonById(dungeon as never).endless)).toBe(true);
    for (const { dungeon, floor } of floors) expect(fogWallFloor({ dungeon: dungeon as never, floor }), `${dungeon} ${floor}`).toBe(true);
    expect(fogWallFloor({ dungeon: CRYPT.id, floor: 1 })).toBe(false);
    for (const def of CHALLENGES) expect(fogWallFloor({ dungeon: def.id, floor: floorCount({ dungeon: def.id }) })).toBe(true);
  });

  it('closing it holds the boss back and puts the party in an antechamber below the room', () => {
    const { run, world } = crypt();
    const fogged = closeFogWall(world);
    const room = ROOMS[(floorPlanOf(run) as { room: keyof typeof ROOMS }).room];
    expect(fogged.enemies).toEqual([]);
    expect(fogged.arena.height).toBe(room.height + FOG_ANTE);
    expect(fogged.player.pos.y).toBeGreaterThan(room.height);
    expect(roomCleared(fogged)).toBe(false);
    // Nothing happens while the party waits: no victory on the last floor.
    expect(progressRun(run, fogged, false).outcome).toBeNull();
  });

  it('nobody walks through it before the party agrees', () => {
    const fogged = closeFogWall(crypt().world);
    let w = fogged;
    for (let i = 0; i < 120; i++) w = step(w, input({ move: vec(0, -1) }), 1000 / 60);
    expect(w.player.pos.y).toBeGreaterThan(fogged.fogWall!.line);
    expect(atFogWall(w, w.player.pos)).toBe(true);
    expect(atFogWall(fogged, fogged.player.pos)).toBe(false);
  });

  it('touching it is the floor\'s leaving point (the prompt and the gather rule)', () => {
    const { run, world } = crypt();
    const fogged = closeFogWall(world);
    const line = fogged.fogWall!.line;
    expect(atLeavingPoint(run, fogged, vec(200, line + 14))).toBe(true);
    expect(atLeavingPoint(run, fogged, vec(200, line + FOG_ANTE - 10))).toBe(false);
  });

  it('crossing restores the room exactly as it was (the fight is unchanged)', () => {
    const { run, world } = crypt();
    const fogged = closeFogWall(world);
    const at = { ...fogged, player: { ...fogged.player, pos: vec(300, fogged.fogWall!.line + 14) } };
    const crossed = progressRun(run, at, true);
    expect(crossed.crossed).toBe(true);
    expect(crossed.entered).toBe(false);
    expect(crossed.world.fogWall).toBeUndefined();
    expect(crossed.world).toEqual(world);
    expect(crossFogWall(fogged)).toEqual(world);
  });

  it('the harness path: without `agreed`, the player touching the fog crosses at once', () => {
    const { run, world } = crypt();
    const fogged = closeFogWall(world);
    expect(progressRun(run, fogged).crossed).toBeUndefined();
    const at = { ...fogged, player: { ...fogged.player, pos: vec(300, fogged.fogWall!.line + 14) } };
    expect(progressRun(run, at).crossed).toBe(true);
  });

  it('a guest crosses when the host\'s snapshot no longer carries the fog', () => {
    const host = startRun(SEED, { localId: 'p1', role: 'host' }, CRYPT.plan.length).world;
    const guest = closeFogWall(startRun(SEED, { localId: 'p2', role: 'guest' }, CRYPT.plan.length).world);
    const stillShut = applyHostSnapshot(guest, hostSnapshot(closeFogWall(host)));
    expect(stillShut.fogWall).toBeDefined();
    expect(stillShut.enemies).toEqual([]);
    const crossed = applyHostSnapshot(guest, hostSnapshot(host));
    expect(crossed.fogWall).toBeUndefined();
    expect(crossed.enemies.length).toBe(host.enemies.length);
    expect(crossed.arena.height).toBe(host.arena.height);
  });
});
