import { describe, expect, it } from 'vitest';
import { AFK_MS, hadInput, isActive, keepReady, partyAgreed, waitingFor, type GatherMember } from '../../src/core/gather';
import { atLeavingPoint, floorPlanOf, progressRun, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { ROOMS } from '../../src/data/rooms';
import { input, openGate } from './helpers';

/** The stairs prompt and the gather rule (odd/tasks/coop-flow.md T3, docs/gdd.md §7). */
const member = (over: Partial<GatherMember> = {}): GatherMember => ({ alive: true, active: true, ready: false, ...over });

const SEED = 20261025;

const onStairs = (world: WorldState): WorldState => ({ ...openGate(world), player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) } });

describe('gather rule', () => {
  it('solo: the player alone decides (ready = go)', () => {
    expect(partyAgreed([member()])).toBe(false);
    expect(partyAgreed([member({ ready: true })])).toBe(true);
  });

  it('co-op: every living, active player must be ready; it counts the ones still missing', () => {
    const party = [member({ ready: true }), member(), member({ ready: true })];
    expect(partyAgreed(party)).toBe(false);
    expect(waitingFor(party)).toBe(1);
    expect(partyAgreed(party.map((m) => ({ ...m, ready: true })))).toBe(true);
    expect(waitingFor(party.map((m) => ({ ...m, ready: true })))).toBe(0);
  });

  it('fainted and inactive (AFK or hidden tab) players are not waited for; they come along', () => {
    expect(partyAgreed([member({ ready: true }), member({ alive: false })])).toBe(true);
    expect(partyAgreed([member({ ready: true }), member({ active: false })])).toBe(true);
    expect(waitingFor([member({ ready: true }), member({ alive: false }), member({ active: false })])).toBe(0);
  });

  it('nobody ready (everyone down or away) never leaves', () => {
    expect(partyAgreed([member({ alive: false }), member({ active: false })])).toBe(false);
    expect(partyAgreed([])).toBe(false);
  });

  it('active means some input in the last 30 s and the tab in view', () => {
    expect(isActive(0, false)).toBe(true);
    expect(isActive(AFK_MS - 1, false)).toBe(true);
    expect(isActive(AFK_MS, false)).toBe(false);
    expect(isActive(0, true)).toBe(false);
  });

  it('any movement or button counts as input; standing still does not', () => {
    const idle = { ...input(), move: vec(0, 0) };
    expect(hadInput(idle)).toBe(false);
    expect(hadInput({ ...idle, move: vec(1, 0) })).toBe(true);
    expect(hadInput({ ...idle, roll: true })).toBe(true);
    expect(hadInput({ ...idle, slots: [false, true] })).toBe(true);
  });

  it('leaving the stairs unreadies; staying keeps it', () => {
    expect(keepReady(true, true)).toBe(true);
    expect(keepReady(true, false)).toBe(false);
    expect(keepReady(false, true)).toBe(false);
  });
});

describe('leaving a floor', () => {
  it('the stairs of a generated floor are a leaving point; elsewhere is not', () => {
    const { run, world } = startRun(SEED, {});
    const there = onStairs(world);
    expect(atLeavingPoint(run, there, there.player.pos)).toBe(true);
    expect(atLeavingPoint(run, there, vec(0, 0))).toBe(false);
  });

  it('standing on the stairs waits for the confirmation; agreeing descends', () => {
    const { run, world } = startRun(SEED, {});
    const there = onStairs(world);
    expect(progressRun(run, there, false).entered).toBe(false);
    expect(progressRun(run, there, true).run.floor).toBe(2);
    // Without a word (the balance and proof harnesses), standing on the stairs descends as before.
    expect(progressRun(run, there).run.floor).toBe(2);
  });

  it('a remote player standing on the stairs no longer moves the party by itself', () => {
    const { run, world } = startRun(SEED, { localId: 'p1', role: 'host' });
    const stairs = world.arena.stairs!;
    const remote = { ...world.player, pos: vec(stairs.x + 16, stairs.y + 16) };
    const withRemote: WorldState = { ...openGate(world), remotes: [{ id: 'p2', player: remote, projectiles: [] }] };
    expect(progressRun(run, withRemote).entered).toBe(false);
    expect(progressRun(run, withRemote, true).entered).toBe(true);
  });

  it("a room's exit is a leaving point only once the room is cleared", () => {
    // The Crypt's mid-boss vault: a fixed room with an exit.
    let { run, world } = startRun(SEED, {});
    for (let floor = 1; floor < 9 && floorPlanOf(run).kind !== 'room'; floor++) ({ run, world } = progressRun(run, onStairs(world), true));
    const plan = floorPlanOf(run);
    expect(plan.kind).toBe('room');
    if (plan.kind !== 'room') return;
    const exit = ROOMS[plan.room].exit!;
    const at = vec(exit.x + exit.width / 2, exit.y + exit.height / 2);
    expect(atLeavingPoint(run, world, at)).toBe(false);
    const cleared = { ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false })) };
    expect(atLeavingPoint(run, cleared, at)).toBe(true);
  });

  it('a fainted player comes along and stands up on the next floor with the floor heal (docs/gdd.md §3, §6)', () => {
    const { run, world } = startRun(SEED, { localId: 'p2', role: 'host' });
    // A teammate still stands (else the run is lost), elsewhere on the floor.
    const fainted = onStairs({ ...world, player: { ...world.player, hp: 0 }, remotes: [{ id: 'p1', player: world.player, projectiles: [] }] });
    const down = progressRun(run, fainted, true);
    expect(down.run.floor).toBe(2);
    expect(down.world.player.hp).toBeCloseTo(0.25 * down.world.player.maxHp, 5);
  });
});
