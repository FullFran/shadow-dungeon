import { describe, expect, it } from 'vitest';
import { bonfireFloor, bonfireLights, bonfirePos, bonfireSnapshot, respawnsLeft } from '../../src/core/bonfire';
import { floorPlanOf, returnToFloor, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { CHALLENGES, CRYPT, DUNGEONS } from '../../src/data/dungeons';
import { DIFFICULTIES } from '../../src/data/difficulty';

/** The mid-boss bonfire (odd/tasks/coop-flow.md T5, docs/gdd.md §3). */
const SEED = 515;

const midbossFloor = (dungeon: (typeof DUNGEONS)[number]): number => dungeon.plan.findIndex((p) => p.kind === 'room' && p.role === 'midboss') + 1;

const cleared = (world: WorldState): WorldState => ({ ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });

describe('bonfire', () => {
  it('respawns per tier: easy unlimited, normal 3, hard 1, nightmare none', () => {
    expect(respawnsLeft('easy', 99)).toBeNull();
    expect(respawnsLeft('normal', 0)).toBe(3);
    expect(respawnsLeft('normal', 3)).toBe(0);
    expect(respawnsLeft('hard', 0)).toBe(1);
    expect(respawnsLeft('nightmare', 0)).toBe(0);
    for (const d of DIFFICULTIES) expect(respawnsLeft(d, 0) === null || respawnsLeft(d, 0)! >= 0).toBe(true);
  });

  it('every main dungeon with a mid-boss has its bonfire there; every Sima boss floor has one in its antechamber; the plain challenges (no mid-boss) have none; a Senda lights one on each of its mid-bosses', () => {
    for (const def of DUNGEONS) {
      const floors = def.endless ? 30 : def.plan.length;
      for (let floor = 1; floor <= floors; floor++) {
        const plan = floorPlanOf({ dungeon: def.id, floor });
        const expected = def.endless ? plan.kind === 'room' : plan.kind === 'room' && plan.role === 'midboss';
        expect(bonfireFloor({ dungeon: def.id, floor }), `${def.id} ${floor}`).toBe(expected);
      }
      if (!def.endless) expect(midbossFloor(def)).toBeGreaterThan(0);
    }
    for (const def of CHALLENGES) for (let floor = 1; floor <= def.plan.length; floor++) { const plan = def.plan[floor - 1]!; expect(bonfireFloor({ dungeon: def.id, floor }), `${def.id} ${floor}`).toBe(plan.kind === 'room' && plan.role === 'midboss'); }
  });

  it('lights once the mid-boss falls, not before, and only once', () => {
    const floor = midbossFloor(CRYPT);
    const { run, world } = startRun(SEED, {}, floor, CRYPT.id);
    expect(bonfireLights(run, world, false)).toBe(false);
    expect(bonfireLights(run, cleared(world), false)).toBe(true);
    expect(bonfireLights(run, cleared(world), true)).toBe(false);
    const other = startRun(SEED, {}, 1, CRYPT.id);
    expect(bonfireLights(other.run, cleared(other.world), false)).toBe(false);
  });

  it('the snapshot keeps HP, items and level; a fainted player stands up with the floor heal', () => {
    const { world } = startRun(SEED, {}, midbossFloor(CRYPT), CRYPT.id);
    const hurt = { ...world, player: { ...world.player, hp: 40, level: 5, items: ['oran-berry'] as never } };
    const snap = bonfireSnapshot(hurt);
    expect(snap.player.hp).toBe(40);
    expect(snap.player.level).toBe(5);
    expect(snap.player.items).toEqual(['oran-berry']);
    const fainted = bonfireSnapshot({ ...world, player: { ...world.player, hp: 0 } });
    expect(fainted.player.hp).toBeGreaterThan(0);
  });

  it('the bonfire stands in the middle of the room', () => {
    const { world } = startRun(SEED, {}, midbossFloor(CRYPT), CRYPT.id);
    expect(bonfirePos(world)).toEqual({ x: world.arena.width / 2, y: world.arena.height / 2 });
  });

  it('a player without a snapshot (joined after it was lit) goes back to the bonfire floor', () => {
    const later = startRun(SEED, {}, midbossFloor(CRYPT) + 2, CRYPT.id);
    const back = returnToFloor(later.run, { ...later.world, player: { ...later.world.player, hp: 0 } }, midbossFloor(CRYPT));
    expect(back.run.floor).toBe(midbossFloor(CRYPT));
    expect(back.world.player.hp).toBeGreaterThan(0);
    expect(back.world.depth).toBe(midbossFloor(CRYPT));
  });
});
