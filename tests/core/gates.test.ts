import { describe, expect, it } from 'vitest';
import { GATE } from '../../src/data/encounters';
import { DUNGEONS, ECLIPSE, planAt, type DungeonDef } from '../../src/data/dungeons';
import { tileDistances, type Floor } from '../../src/core/dungeon';
import { chooseGate, gateBonus, gateShut, reachable, updateGate } from '../../src/core/gates';
import { enemyXp, creditDefeats } from '../../src/core/progression';
import { floorKind, progressRun, startRun, type RunState } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { isWall, tileCenter, tileOf } from '../../src/core/tiles';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { IDLE } from './helpers';

const floorsOf = (d: DungeonDef): number[] => Array.from({ length: d.endless ? 30 : d.plan.length }, (_, i) => i + 1).filter((f) => planAt(d, f)?.kind === 'generated');

/** The first run (seed, floor) of a dungeon whose floor holds a gate of `kind`. */
function findGate(d: DungeonDef, kind: 'seal' | 'key' | 'waves'): { run: RunState; world: WorldState } {
  for (let seed = 1; seed < 4000; seed++)
    for (const floor of floorsOf(d)) {
      if (chooseGate(seed, floor, floorKind(seed, floor, d), d.gates) !== kind) continue;
      const started = startRun(seed, {}, floor, d.id);
      if (started.world.gate?.kind === kind) return started;
    }
  throw new Error(`no ${kind} gate`);
}

const onStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
const kill = (w: WorldState, id: string): WorldState => ({ ...w, enemies: w.enemies.map((e) => (e.id === id ? { ...e, alive: false, hp: 0 } : e)) });

describe('gates: when a floor needs a kill', () => {
  it('never on floor 1, never on an urgent floor, never on a fixed room; some floors of every dungeon, not most', () => {
    for (const d of DUNGEONS) {
      let gated = 0;
      let total = 0;
      for (let seed = 1; seed <= 300; seed++) {
        expect(chooseGate(seed, 1, 'normal', d.gates)).toBeNull();
        for (const floor of floorsOf(d)) {
          const kind = floorKind(seed, floor, d);
          const gate = chooseGate(seed, floor, kind, d.gates);
          expect(chooseGate(seed, floor, kind, d.gates)).toBe(gate);
          if (kind !== 'normal') expect(gate).toBeNull();
          for (const urgent of ['collapse', 'fog', 'flood', 'gas'] as const) expect(chooseGate(seed, floor, urgent, d.gates)).toBeNull();
          total++;
          if (gate) gated++;
        }
      }
      expect(gated / total).toBeGreaterThan(0.1);
      expect(gated / total).toBeLessThan(0.5);
    }
    // Fixed rooms (arenas, echoes) never get one.
    const { world } = startRun(3, {}, 3);
    expect(world.gate).toBeUndefined();
  });

  it('the wave room gate is the Sima\'s only; the regular dungeons seal or lock', () => {
    for (const d of DUNGEONS) {
      const kinds = new Set<string>();
      for (let seed = 1; seed <= 400; seed++) for (const floor of floorsOf(d)) kinds.add(String(chooseGate(seed, floor, 'normal', d.gates)));
      if (d.endless) expect(kinds.has('waves')).toBe(true);
      else expect(kinds.has('waves')).toBe(false);
      expect(kinds.has('seal')).toBe(true);
      expect(kinds.has('key')).toBe(true);
    }
  });
});

describe('gates: Sello de la escalera', () => {
  it('keeps the stairs shut until the marked enemy falls, then pays it the gate bonus', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'seal');
    const target = world.enemies.find((e) => e.id === world.gate!.target)!;
    expect(target).toBeDefined();
    // The target is the floor's leader when it has one, otherwise its highest threat.
    if (world.enemies.some((e) => e.leader)) expect(target.leader).toBeDefined();
    expect(gateShut(world)).toBe(true);
    expect(progressRun(run, onStairs(world)).entered).toBe(false);
    const events: GameEvent[] = [];
    const opened = updateGate(kill(world, target.id), FIXED_DT_MS, events);
    expect(opened.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(events).toContainEqual({ type: 'gateOpened', kind: 'seal', outcome: 'opened' });
    expect(progressRun(run, onStairs(opened)).entered).toBe(true);
    expect(gateBonus(opened, target)).toBe(GATE.xp);
    expect(creditDefeats(opened, []).player.xp).toBeCloseTo(enemyXp(target, run.floor) * GATE.xp);
  });

  it('opens through a real step when the target is felled (host)', () => {
    const { world } = findGate(DUNGEONS[0]!, 'seal');
    const after = step(kill(world, world.gate!.target!), IDLE, FIXED_DT_MS);
    expect(after.gate?.done).toBe(true);
  });
});

describe('gates: the locked door and its key', () => {
  it('locks the stairs room, gives the key to an enemy the player can reach, drops it where it falls, opens on touch', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'key');
    const gate = world.gate!;
    const grid = world.arena.tiles!;
    const floor = grid as Floor;
    expect(gate.doors!.length).toBeGreaterThan(0);
    for (const i of gate.doors!) expect(grid.tiles[i]).toBe(0);
    // The stairs cannot be walked to from the start while it is locked.
    const dist = tileDistances(grid, floor.start);
    expect(dist[floor.stairs.y * grid.cols + floor.stairs.x]).toBe(-1);
    const bearer = world.enemies.find((e) => e.id === gate.target)!;
    const at = tileOf(bearer.pos);
    expect(dist[at.y * grid.cols + at.x]).toBeGreaterThanOrEqual(0);
    // Felled: the key lies where it fell, the door still shut.
    const events: GameEvent[] = [];
    const dropped = updateGate(kill(world, bearer.id), FIXED_DT_MS, events);
    expect(dropped.gate).toMatchObject({ done: false, key: bearer.pos });
    expect(events).toContainEqual({ type: 'keyDropped', pos: bearer.pos });
    expect(progressRun(run, onStairs(dropped)).entered).toBe(false);
    // Walked over: the doorways are floor again and the stairs open.
    const taken = updateGate({ ...dropped, player: { ...dropped.player, pos: bearer.pos } }, FIXED_DT_MS, []);
    expect(taken.gate).toMatchObject({ done: true, outcome: 'opened' });
    for (const i of gate.doors!) expect(taken.arena.tiles!.tiles[i]).toBe(1);
    expect(progressRun(run, onStairs(taken)).entered).toBe(true);
  });
});

describe('gates: the Sima\'s wave room', () => {
  it('a wave gate is the floor\'s wave room: the stairs open once it is cleared', () => {
    const { run, world } = findGate(ECLIPSE, 'waves');
    expect(world.simaEvent?.kind).toBe('waves');
    expect(progressRun(run, onStairs(updateGate(world, FIXED_DT_MS, []))).entered).toBe(false);
    const cleared = { ...world, simaEvent: { ...world.simaEvent!, done: true, outcome: 'cleared' as const } };
    const opened = updateGate(cleared, FIXED_DT_MS, []);
    expect(opened.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(progressRun(run, onStairs(opened)).entered).toBe(true);
  });

  it('never gates a hunter floor (the pursuer already pushes)', () => {
    let hunters = 0;
    for (let seed = 1; seed <= 600; seed++)
      for (const floor of [8, 12, 16]) {
        const { world } = startRun(seed, {}, floor, ECLIPSE.id);
        if (world.simaEvent?.kind !== 'hunter') continue;
        hunters++;
        expect(world.gate).toBeUndefined();
      }
    expect(hunters).toBeGreaterThan(5);
  });
});

describe('gates: the out-of-bounds safety', () => {
  it('breaks the gate without reward when its enemy stays out of every player\'s reach for 60 s; reachable again resets the count', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'seal');
    const id = world.gate!.target!;
    // A step builds the players' flow field; then the target slips out of the map.
    const flowing = step(world, IDLE, FIXED_DT_MS);
    const lost: WorldState = { ...flowing, enemies: flowing.enemies.map((e) => (e.id === id ? { ...e, pos: vec(-200, -200) } : e)) };
    expect(reachable(lost, vec(-200, -200))).toBe(false);
    let w: WorldState = lost;
    for (let s = 0; s < 59; s++) w = updateGate(w, 1000, []);
    expect(w.gate).toMatchObject({ done: false, stuckMs: 59_000 });
    // Back within reach for a moment: the count starts again.
    const back = updateGate({ ...w, enemies: flowing.enemies }, 1000, []);
    expect(back.gate!.stuckMs).toBe(0);
    w = { ...back, enemies: lost.enemies };
    const events: GameEvent[] = [];
    for (let s = 0; s < 60; s++) w = updateGate(w, 1000, events);
    expect(w.gate).toMatchObject({ done: true, outcome: 'broken' });
    expect(events).toContainEqual({ type: 'gateOpened', kind: 'seal', outcome: 'broken' });
    expect(progressRun(run, onStairs(w)).entered).toBe(true);
    // No reward: the marked enemy pays only its own experience once the gate broke.
    expect(gateBonus(w, { id })).toBe(1);
  });

  it('counts an enemy inside a wall tile next to the floor as reachable (a body pressed against a wall)', () => {
    const { world } = findGate(DUNGEONS[0]!, 'seal');
    const flowing = step(world, IDLE, FIXED_DT_MS);
    const grid = flowing.arena.tiles!;
    const start = (grid as Floor).start;
    let wall = start;
    while (!isWall(grid, wall.x, wall.y)) wall = { x: wall.x, y: wall.y - 1 };
    expect(reachable(flowing, tileCenter(wall))).toBe(true);
  });
});

describe('gates: shared runs', () => {
  it('every peer places the same gate; the guest follows the host\'s resolution over the wire, doors included', () => {
    const { run, world: host } = findGate(DUNGEONS[0]!, 'key');
    const guest0 = startRun(run.seed, { role: 'guest', localId: 'p2' }, run.floor).world;
    expect(guest0.gate).toEqual(host.gate);
    expect(guest0.arena.tiles!.tiles).toEqual(host.arena.tiles!.tiles);
    const bearer = host.enemies.find((e) => e.id === host.gate!.target)!;
    const dropped = updateGate(kill(host, bearer.id), FIXED_DT_MS, []);
    const wire = (w: WorldState) => decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: run.floor, s: hostSnapshot(w) } as NetMessage));
    const snap1 = wire(dropped);
    expect(snap1?.t).toBe('snap');
    let guest = applyHostSnapshot(guest0, (snap1 as Extract<NetMessage, { t: 'snap' }>).s);
    expect(guest.gate).toMatchObject({ done: false, key: { x: Math.round(bearer.pos.x * 10) / 10, y: Math.round(bearer.pos.y * 10) / 10 } });
    const opened = updateGate({ ...dropped, player: { ...dropped.player, pos: bearer.pos } }, FIXED_DT_MS, []);
    guest = applyHostSnapshot(guest, (wire(opened) as Extract<NetMessage, { t: 'snap' }>).s);
    expect(guest.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(guest.arena.tiles!.tiles).toEqual(opened.arena.tiles!.tiles);
    // An older host (no gate field) changes nothing on the guest.
    const { gate: _g, ...older } = hostSnapshot(opened);
    expect(applyHostSnapshot(guest0, older).gate).toEqual(guest0.gate);
  });

  it('only the host resolves: a guest\'s own step leaves its gate as the host last said', () => {
    const { run, world: host } = findGate(DUNGEONS[0]!, 'seal');
    const guest = startRun(run.seed, { role: 'guest', localId: 'p2' }, run.floor).world;
    const after = step(kill(guest, host.gate!.target!), IDLE, FIXED_DT_MS);
    expect(after.gate?.done).toBe(false);
  });
});
