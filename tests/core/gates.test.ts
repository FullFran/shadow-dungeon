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
import { spawnEnemy } from '../../src/core/world';
import { floatsOf } from '../../src/data/enemies';
import { applySimaSync } from '../../src/core/sima-events';
import { insideRect } from '../../src/core/geometry';

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
  it('locks the stairs room, gives the key to an enemy the player can reach; its fall hands the key over and opens the door at once', () => {
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
    expect(progressRun(run, onStairs(world)).entered).toBe(false);
    // Felled, wherever the player stands: no key to fetch, the doorways are floor again and the stairs open.
    const events: GameEvent[] = [];
    const taken = updateGate(kill(world, bearer.id), FIXED_DT_MS, events);
    expect(taken.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(taken.gate!.key).toBeUndefined();
    expect(events).toEqual([{ type: 'gateOpened', kind: 'key', outcome: 'opened' }]);
    for (const i of gate.doors!) expect(taken.arena.tiles!.tiles[i]).toBe(1);
    expect(progressRun(run, onStairs(taken)).entered).toBe(true);
    // The marked kill still pays its bonus.
    expect(gateBonus(taken, bearer)).toBe(GATE.xp);
  });

  it('a bearer that falls where no body can stand (a floater over a wall) still opens the door: the dropped-key soft-lock', () => {
    const { world } = findGate(DUNGEONS[0]!, 'key');
    const flowing = step(world, IDLE, FIXED_DT_MS);
    const grid = flowing.arena.tiles!;
    const start = (grid as Floor).start;
    let wall = start;
    while (!isWall(grid, wall.x, wall.y)) wall = { x: wall.x, y: wall.y - 1 };
    const id = flowing.gate!.target!;
    // Its body over the wall tile, the player pressed right below it on the floor.
    const enemies = flowing.enemies.map((e) => (e.id === id ? { ...e, pos: tileCenter(wall), alive: false, hp: 0 } : e));
    let w: WorldState = { ...flowing, enemies, player: { ...flowing.player, pos: tileCenter({ x: wall.x, y: wall.y + 1 }) } };
    for (let s = 0; s < 10; s++) w = updateGate(w, FIXED_DT_MS, []);
    expect(w.gate).toMatchObject({ done: true, outcome: 'opened' });
  });

  it('a bearer gone from the world (fell through a collapse, blew itself up) opens the door too', () => {
    const { world } = findGate(DUNGEONS[0]!, 'key');
    const gone = { ...world, enemies: world.enemies.filter((e) => e.id !== world.gate!.target) };
    expect(updateGate(gone, FIXED_DT_MS, []).gate).toMatchObject({ done: true, outcome: 'opened' });
  });

  it('a living bearer out of every player\'s reach for 60 s still breaks the gate, without reward, doors open', () => {
    const { world } = findGate(DUNGEONS[0]!, 'key');
    const id = world.gate!.target!;
    const flowing = step(world, IDLE, FIXED_DT_MS);
    let w: WorldState = { ...flowing, enemies: flowing.enemies.map((e) => (e.id === id ? { ...e, pos: vec(-200, -200) } : e)) };
    for (let s = 0; s < 59; s++) w = updateGate(w, 1000, []);
    expect(w.gate).toMatchObject({ done: false });
    w = updateGate(w, 1000, []);
    expect(w.gate).toMatchObject({ done: true, outcome: 'broken' });
    for (const i of w.gate!.doors!) expect(w.arena.tiles!.tiles[i]).toBe(1);
    expect(gateBonus(w, { id })).toBe(1);
  });

  it('an older state with a key lying on the ground resolves as opened', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'key');
    const legacy: WorldState = { ...kill(world, world.gate!.target!), gate: { ...world.gate!, key: vec(-500, -500) } };
    const after = updateGate(legacy, FIXED_DT_MS, []);
    expect(after.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(after.gate!.key).toBeUndefined();
    expect(progressRun(run, onStairs(after)).entered).toBe(true);
  });
});

describe('gates: the seal never soft-locks', () => {
  it('the marked enemy falling anywhere (in a hazard, out of view, off the map, gone) unseals the stairs at once', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'seal');
    const id = world.gate!.target!;
    const fellAt = (pos: { x: number; y: number }): WorldState => ({ ...world, enemies: world.enemies.map((e) => (e.id === id ? { ...e, pos, alive: false, hp: 0 } : e)) });
    const cases: WorldState[] = [fellAt(vec(-300, -300)), fellAt(vec(1e6, 1e6)), { ...world, enemies: world.enemies.filter((e) => e.id !== id) }];
    for (const c of cases) {
      const events: GameEvent[] = [];
      const after = updateGate(c, FIXED_DT_MS, events);
      expect(after.gate).toMatchObject({ done: true, outcome: 'opened' });
      expect(events).toEqual([{ type: 'gateOpened', kind: 'seal', outcome: 'opened' }]);
      expect(progressRun(run, onStairs(after)).entered).toBe(true);
    }
  });

  it('a marked enemy finished off by the world (a hazard after the gate check) unseals the stairs on the host\'s next steps', () => {
    const { run, world } = findGate(DUNGEONS[0]!, 'seal');
    const id = world.gate!.target!;
    // Stand-in for any hazard: the enemy is dead before the step's gate check runs.
    const dying = { ...world, enemies: world.enemies.map((e) => (e.id === id ? { ...e, hp: 0, alive: false } : e)) };
    const after = step(step(dying, IDLE, FIXED_DT_MS), IDLE, FIXED_DT_MS);
    expect(after.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(progressRun(run, onStairs(after)).entered).toBe(true);
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
    const wire = (w: WorldState) => decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: run.floor, s: hostSnapshot(w) } as NetMessage));
    // Still locked on the wire while the bearer lives.
    let guest = applyHostSnapshot(guest0, (wire(host) as Extract<NetMessage, { t: 'snap' }>).s);
    expect(guest.gate).toMatchObject({ done: false });
    // The bearer falls on the host: the next snapshot opens the guest's doors, no key in between.
    const opened = updateGate(kill(host, bearer.id), FIXED_DT_MS, []);
    const snap = wire(opened);
    expect(snap?.t).toBe('snap');
    expect((snap as Extract<NetMessage, { t: 'snap' }>).s.gate?.key).toBeUndefined();
    guest = applyHostSnapshot(guest, (snap as Extract<NetMessage, { t: 'snap' }>).s);
    expect(guest.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(guest.arena.tiles!.tiles).toEqual(opened.arena.tiles!.tiles);
    // An older host still waiting on a dropped key: the guest takes it as opened.
    const fromOld = applyHostSnapshot(guest0, { ...hostSnapshot(host), gate: { done: false, key: bearer.pos } });
    expect(fromOld.gate).toMatchObject({ done: true, outcome: 'opened' });
    expect(fromOld.arena.tiles!.tiles).toEqual(opened.arena.tiles!.tiles);
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

/**
 * One coherent out-of-bounds set (odd/tasks/integrate-encounters.md): the
 * safety net (core/bounds.ts) snaps walkers back every step, so a gate's own
 * 60 s rule only ever fires for what it cannot snap (a floater, a dropped
 * key); a key gate's locked stairs room is not "out of reach" for the net;
 * and the Sima's wave gate opens when the wave room's 60 s failsafe ends it.
 */
describe('gates with the out-of-bounds safety net', () => {
  const play = (w: WorldState, ms: number): WorldState => {
    let s = w;
    for (let t = 0; t < ms; t += FIXED_DT_MS) s = step(s, IDLE, FIXED_DT_MS);
    return s;
  };

  it('a walker in a key gate\'s locked stairs room waits there: the net does not pull it out of the room', () => {
    const { world } = findGate(DUNGEONS[0]!, 'key');
    const floor = world.arena.tiles as Floor;
    const room = floor.rooms[floor.stairsRoom]!;
    const inRoom = (e: { pos: { x: number; y: number } }) => {
      const t = tileOf(e.pos);
      return t.x >= room.x && t.y >= room.y && t.x < room.x + room.width && t.y < room.y + room.height;
    };
    const centre = tileCenter({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });
    const placed = spawnEnemy(world, 'spinarak', centre, { dormant: true });
    const waiting = placed.enemies.at(-1)!;
    const after = play(placed, 1000);
    expect(after.gate).toMatchObject({ kind: 'key', done: false });
    expect(inRoom(after.enemies.find((e) => e.id === waiting.id)!)).toBe(true);
  });

  it('a walking gate target thrown off the map is snapped back by the net before the gate\'s own clock counts', () => {
    const { world } = findGate(DUNGEONS[0]!, 'seal');
    const id = world.gate!.target!;
    const target = world.enemies.find((e) => e.id === id)!;
    expect(floatsOf(target.species)).toBe(false);
    const flowing = step(world, IDLE, FIXED_DT_MS);
    const lost: WorldState = { ...flowing, enemies: flowing.enemies.map((e) => (e.id === id ? { ...e, pos: vec(-200, -200) } : e)) };
    const after = play(lost, 2000);
    expect(after.gate).toMatchObject({ done: false, stuckMs: 0 });
    expect(reachable(after, after.enemies.find((e) => e.id === id)!.pos)).toBe(true);
  });

  it('the Sima\'s wave gate opens through the wave room\'s 60 s failsafe when its enemies are stuck out of reach', () => {
    const { run, world } = findGate(ECLIPSE, 'waves');
    const floor = world.arena.tiles as Floor;
    const room = floor.rooms[world.simaEvent!.room]!;
    const tough = { ...world, player: { ...world.player, pos: tileCenter({ x: room.x, y: room.y }), hp: 1e9, maxHp: 1e9 } };
    let w = play(tough, 50);
    expect(w.simaEvent).toMatchObject({ sealed: true, done: false });
    // The first wave (it spawns away from the player, hence the corner).
    for (let t = 0; t < 5000 && (w.simaEvent!.ids ?? []).length === 0; t += FIXED_DT_MS) w = step(w, IDLE, FIXED_DT_MS);
    expect(w.simaEvent!.ids!.length).toBeGreaterThan(0);
    // A stand-in for wave enemies nobody can reach: they hold still and lose no HP.
    w = { ...w, enemies: w.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'dormant' as const } })) };
    const stalled = play(w, 55_000);
    expect(stalled.gate).toMatchObject({ kind: 'waves', done: false });
    expect(progressRun(run, onStairs(stalled)).entered).toBe(false);
    const ended = play(stalled, 6_000);
    expect(ended.simaEvent).toMatchObject({ done: true });
    expect(ended.gate).toMatchObject({ kind: 'waves', done: true, outcome: 'opened' });
    expect(progressRun(run, onStairs(ended)).entered).toBe(true);
  });
});

describe('a wave room in a shared run (ticket SD-OKCVHT)', () => {
  const setup = () => {
    const { run, world } = findGate(ECLIPSE, 'waves');
    const rect = world.simaEvent!.rect;
    const inside = vec(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { run, world, rect, inside };
  };
  const away = (w: WorldState, rect: { x: number; y: number; width: number; height: number }) => {
    const tiles = w.arena.tiles!;
    for (let y = 0; y < tiles.rows; y++) {
      for (let x = 0; x < tiles.cols; x++) {
        const pos = vec(x * 32 + 16, y * 32 + 16);
        if (!isWall(tiles, x, y) && !insideRect(pos, rect) && Math.hypot(pos.x - rect.x, pos.y - rect.y) > 200) return pos;
      }
    }
    throw new Error('no floor outside the room');
  };

  it('the door closes with nobody left outside: a teammate entering brings the host in', () => {
    const { world, rect, inside } = setup();
    const outside = away(world, rect);
    const mate = { id: 'p2', player: { ...world.player, pos: inside }, projectiles: [] };
    const hosted = { ...world, role: 'host' as const, player: { ...world.player, pos: outside }, remotes: [mate] };
    const next = step(hosted, IDLE, FIXED_DT_MS);
    expect(next.simaEvent?.sealed).toBe(true);
    expect(insideRect(next.player.pos, rect)).toBe(true);
  });

  it('a guest outside when the host says the doors closed is brought in, on floor, once', () => {
    const { world, rect } = setup();
    const outside = { ...world, role: 'guest' as const, player: { ...world.player, pos: away(world, rect) } };
    const closed = applySimaSync(outside, { e: { done: false, sealed: true, wave: 1 } });
    expect(closed.simaEvent?.sealed).toBe(true);
    expect(insideRect(closed.player.pos, rect)).toBe(true);
    const tile = { x: Math.floor(closed.player.pos.x / 32), y: Math.floor(closed.player.pos.y / 32) };
    expect(isWall(closed.arena.tiles!, tile.x, tile.y)).toBe(false);
    // Walking back to the wall later is the player's own business: the same flag again moves nobody.
    const moved = { ...closed, player: { ...closed.player, pos: away(world, rect) } };
    expect(applySimaSync(moved, { e: { done: false, sealed: true, wave: 1 } }).player.pos).toEqual(moved.player.pos);
  });

  it('a player already inside stays exactly where it is, alone or with a group', () => {
    const { world, rect, inside } = setup();
    const solo = step({ ...world, player: { ...world.player, pos: inside } }, IDLE, FIXED_DT_MS);
    expect(solo.simaEvent?.sealed).toBe(true);
    expect(insideRect(solo.player.pos, rect)).toBe(true);
    expect(solo.player.pos).toEqual(inside);
    const guest = { ...world, role: 'guest' as const, player: { ...world.player, pos: inside } };
    expect(applySimaSync(guest, { e: { done: false, sealed: true, wave: 1 } }).player.pos).toEqual(inside);
  });

  it('the doors opening moves nobody', () => {
    const { world, rect } = setup();
    const outside = away(world, rect);
    const closed = { ...world, role: 'guest' as const, player: { ...world.player, pos: outside }, simaEvent: { ...world.simaEvent!, sealed: true } };
    expect(applySimaSync(closed, { e: { done: true, sealed: false } }).player.pos).toEqual(outside);
  });
});

