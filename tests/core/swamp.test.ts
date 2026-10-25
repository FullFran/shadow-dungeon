import { describe, expect, it } from 'vitest';
import { GAS, TOXIC } from '../../src/data/swamp';
import { SWAMP, chanceAt, guardianOf } from '../../src/data/dungeons';
import { TUNING } from '../../src/data/tuning';
import { generateFloor } from '../../src/core/dungeon';
import { loadFloor } from '../../src/core/floor';
import { advanceGas, gasFront, gasProximity, isGassed, startGas, updateGas } from '../../src/core/gas';
import { floorKind, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { TILE, tileCenter, tileOf } from '../../src/core/tiles';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { inPool, placePools, updateToxic } from '../../src/core/toxic';
import { distance, vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { IDLE, input, ticksFor, openGate } from './helpers';

const swampFloor = (seed: number, depth = 3) => generateFloor(seed, depth, SWAMP.spawns);

/** A world on a generated swamp floor of kind `kind`, the enemies cleared so only the floor acts. */
function onFloor(seed: number, kind: 'normal' | 'gas' = 'normal'): WorldState {
  const floor = swampFloor(seed);
  const base = createWorld({ seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const loaded = loadFloor(base, floor, kind);
  return { ...loaded, enemies: [], player: { ...loaded.player, disguiseBroken: true } };
}

describe('the Toxic Swamp plan', () => {
  it('is ten floors: generated 1-4, the Salazzle den on 5 (a mid-boss with an exit), generated 6-9, Nihilego on 10', () => {
    expect(SWAMP.plan).toHaveLength(10);
    expect(SWAMP.plan[4]).toEqual({ kind: 'room', room: 'den', role: 'midboss' });
    expect(SWAMP.plan[9]).toEqual({ kind: 'room', room: 'rift' });
    for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) expect(SWAMP.plan[i]).toEqual({ kind: 'generated' });
    expect(guardianOf(SWAMP)).toBe('nihilego');
  });

  it('opens once the Flooded Caves are cleared', () => {
    expect(SWAMP.unlockedBy).toBe('flooded-caves');
  });

  it('rolls the gas on generated floors from floor 2 at the table rates, never on floor 1 or an arena', () => {
    const gas = SWAMP.urgent.find((u) => u.kind === 'gas')!;
    expect(chanceAt(gas.chance, 1)).toBe(0);
    for (const floor of [1, 5, 10]) for (let seed = 0; seed < 200; seed++) expect(floorKind(seed, floor, SWAMP)).toBe('normal');
    let gassed = 0;
    for (let seed = 0; seed < 1000; seed++) if (floorKind(seed, 4, SWAMP) === 'gas') gassed++;
    expect(gassed / 1000).toBeGreaterThan(chanceAt(gas.chance, 4) - 0.06);
    expect(gassed / 1000).toBeLessThan(chanceAt(gas.chance, 4) + 0.06);
  });

  it('draws the roster poison species and the new swamp species, Venipede in packs of three', () => {
    const species = SWAMP.spawns.pool.map((e) => e.species);
    for (const s of ['grimer', 'koffing', 'ekans', 'croagunk', 'stunky', 'tentacool', 'venipede', 'salandit', 'skrelp']) expect(species).toContain(s);
    expect(SWAMP.spawns.pool.find((e) => e.species === 'venipede')?.pack).toBe(3);
    // Floor 1 is gentle: no Croagunk, Grimer or Koffing yet.
    const floor1 = SWAMP.spawns.pool.filter((e) => e.weights[0]! > 0).map((e) => e.species);
    for (const s of ['croagunk', 'grimer', 'koffing']) expect(floor1).not.toContain(s);
  });

  it('plays through: stairs, the den exit once Salazzle falls, stairs, then victory on Nihilego', () => {
    let progress: RunProgress = { ...startRun(5, {}, 1, SWAMP.id), entered: false, outcome: null };
    const toStairs = (w: WorldState): WorldState => ({ ...openGate(w), player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    const clear = (w: WorldState): WorldState => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
    for (let floor = 2; floor <= 5; floor++) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(5);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['salazzle']);
    const exit = { x: 360, y: 20 };
    const atExit = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(exit.x + 40, exit.y) } });
    progress = progressRun(progress.run, atExit(clear(progress.world)));
    expect(progress.run.floor).toBe(6);
    for (let floor = 7; floor <= 10; floor++) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(10);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['nihilego']);
    expect(progressRun(progress.run, clear(progress.world)).outcome).toBe('victory');
  });
});

describe('toxic pools', () => {
  it('are placed the same way for the same seed, inside rooms, clear of the start and the stairs', () => {
    let total = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const floor = swampFloor(seed);
      const pools = placePools(floor, seed);
      expect(placePools(floor, seed)).toEqual(pools);
      total += pools.length;
      for (const pool of pools) {
        const tile = tileOf(pool);
        expect(floor.tiles[tile.y * floor.cols + tile.x]).toBe(1);
        expect(floor.rooms.some((r) => tile.x >= r.x && tile.y >= r.y && tile.x < r.x + r.width && tile.y < r.y + r.height)).toBe(true);
        expect(distance(pool, tileCenter(floor.start))).toBeGreaterThan(TOXIC.clearTiles * TILE);
        expect(distance(pool, tileCenter(floor.stairs))).toBeGreaterThan(TOXIC.clearTiles * TILE);
        expect(pool.radius).toBeGreaterThanOrEqual(TOXIC.radiusTiles.min * TILE);
        expect(pool.radius).toBeLessThanOrEqual(TOXIC.radiusTiles.max * TILE);
      }
    }
    expect(total).toBeGreaterThan(120);
  });

  it('come with every generated swamp floor of a run, and with no other dungeon', () => {
    const swamp = startRun(3, {}, 1, SWAMP.id);
    expect(swamp.world.pools?.length ?? 0).toBeGreaterThan(0);
    expect(startRun(3, {}).world.pools).toBeUndefined();
  });

  it('poison the player who wades in, and the poison bites on its interval but never takes the last HP', () => {
    const world = onFloor(7);
    const pool = { x: world.player.pos.x + 200, y: world.player.pos.y, radius: 40 };
    const wading: WorldState = { ...world, pools: [pool], player: { ...world.player, pos: vec(pool.x, pool.y) } };
    const events: GameEvent[] = [];
    const poisoned = updateToxic(wading, FIXED_DT_MS, events);
    expect(poisoned.player.poison?.remainingMs).toBe(TOXIC.poison.durationMs);
    expect(events.some((e) => e.type === 'poisoned')).toBe(true);
    expect(poisoned.player.hp).toBe(world.player.hp);
    // Out of the pool: it keeps biting until it wears off.
    let current: WorldState = { ...poisoned, player: { ...poisoned.player, pos: vec(pool.x + 200, pool.y) } };
    const bites: number[] = [];
    for (let i = 0; i < ticksFor(TOXIC.poison.durationMs + 500); i++) {
      const tick: GameEvent[] = [];
      current = updateToxic(current, FIXED_DT_MS, tick);
      for (const e of tick) if (e.type === 'collapseHurt') bites.push(e.damage);
    }
    expect(bites.length).toBe(Math.floor(TOXIC.poison.durationMs / TOXIC.poison.tickMs));
    for (const b of bites) expect(b).toBeCloseTo(TOXIC.poison.tickFraction * world.player.maxHp, 5);
    expect(current.player.poison).toBeUndefined();
    // Never the last HP.
    let low: WorldState = { ...wading, player: { ...wading.player, hp: 2 } };
    for (let i = 0; i < ticksFor(20000); i++) low = updateToxic(low, FIXED_DT_MS, []);
    expect(low.player.hp).toBe(1);
  });

  it('do not poison a roll across them, nor the player brushing the rim', () => {
    const world = onFloor(7);
    const pool = { x: world.player.pos.x, y: world.player.pos.y, radius: 40 };
    const rolling: WorldState = { ...world, pools: [pool], player: { ...world.player, roll: { elapsedMs: 120, dir: vec(1, 0) } } };
    expect(updateToxic(rolling, FIXED_DT_MS, []).player.poison).toBeUndefined();
    const rim: WorldState = { ...world, pools: [pool], player: { ...world.player, pos: vec(pool.x + pool.radius - TOXIC.edgeMarginPx + 1, pool.y) } };
    expect(updateToxic(rim, FIXED_DT_MS, []).player.poison).toBeUndefined();
    expect(inPool([pool], vec(pool.x + pool.radius - TOXIC.edgeMarginPx - 1, pool.y))).toBe(true);
  });

  it('are part of the step: wading in for a while poisons and bites', () => {
    const world = onFloor(7);
    const pool = { x: world.player.pos.x, y: world.player.pos.y, radius: 40 };
    let current: WorldState = { ...world, pools: [pool] };
    let bitten = false;
    for (let i = 0; i < ticksFor(1500); i++) {
      current = step(current, IDLE, FIXED_DT_MS);
      bitten ||= current.events.some((e) => e.type === 'collapseHurt');
    }
    expect(current.player.poison).toBeDefined();
    expect(bitten).toBe(true);
  });
});

describe('Gas tóxico', () => {
  it('starts with the floor and waits out its grace, then spreads from the start at a constant speed', () => {
    const world = onFloor(9, 'gas');
    expect(world.gas).toBeDefined();
    const floor = world.arena.tiles!;
    let g = world.gas!;
    g = advanceGas(g, GAS.graceMs - 1);
    expect(gasFront(g)).toBe(0);
    expect(isGassed(g, floor.cols, tileOf(world.player.pos))).toBe(false);
    g = advanceGas(g, 4001);
    expect(gasFront(g)).toBeCloseTo(GAS.frontTilesPerSecond * 4, 5);
    expect(isGassed(g, floor.cols, tileOf(world.player.pos))).toBe(true);
    expect(isGassed(g, floor.cols, { x: 0, y: 0 })).toBe(false);
  });

  it('reaches the stairs no sooner than the safety factor times the walk to them, on every seed', () => {
    const walkMsPerTile = (TILE / TUNING.player.moveSpeed) * 1000;
    for (let seed = 0; seed < 200; seed++) {
      const floor = swampFloor(seed, 4);
      let g = startGas(floor);
      const stairsDist = g.dist[floor.stairs.y * floor.cols + floor.stairs.x]!;
      expect(stairsDist).toBeGreaterThan(0);
      let ticks = 0;
      while (!isGassed(g, floor.cols, floor.stairs)) {
        g = advanceGas(g, FIXED_DT_MS);
        ticks++;
      }
      expect(ticks * FIXED_DT_MS - GAS.graceMs).toBeGreaterThanOrEqual(stairsDist * walkMsPerTile * GAS.safetyFactor);
    }
  });

  it('drains the player inside it on its interval, a roll does not help, and it never takes the last HP', () => {
    const world = onFloor(9, 'gas');
    const inside: WorldState = { ...world, gas: advanceGas(world.gas!, GAS.graceMs + 3000) };
    const drained: number[] = [];
    let current = inside;
    for (let i = 0; i < ticksFor(GAS.drainIntervalMs * 3 + 10); i++) {
      const events: GameEvent[] = [];
      current = updateGas({ ...current, player: { ...current.player, roll: { elapsedMs: 100, dir: vec(1, 0) } } }, FIXED_DT_MS, events);
      for (const e of events) if (e.type === 'collapseHurt') drained.push(e.damage);
    }
    expect(drained.length).toBe(3);
    for (const d of drained) expect(d).toBeCloseTo(GAS.drainFraction * world.player.maxHp, 5);
    let low: WorldState = { ...inside, player: { ...inside.player, hp: 3 } };
    for (let i = 0; i < ticksFor(30000); i++) low = updateGas(low, FIXED_DT_MS, []);
    expect(low.player.hp).toBe(1);
  });

  it('leaves the player outside it alone, and reports how far ahead of it the player stands', () => {
    const world = onFloor(9, 'gas');
    expect(gasProximity(world)).toBeNull();
    const early: WorldState = { ...world, gas: advanceGas(world.gas!, GAS.graceMs + 1000) };
    const stairs = world.arena.stairs!;
    const far: WorldState = { ...early, player: { ...early.player, pos: vec(stairs.x + 16, stairs.y + 16) } };
    const next = updateGas(far, FIXED_DT_MS, []);
    expect(next.player.hp).toBe(far.player.hp);
    expect(gasProximity(far)!).toBeGreaterThan(0);
    expect(gasProximity({ ...early, gas: advanceGas(early.gas!, 5000) })!).toBeLessThan(0);
  });

  it('ends with the floor: the next floor has no gas', () => {
    let progress: RunProgress | null = null;
    for (let seed = 0; seed < 400 && !progress; seed++) if (floorKind(seed, 2, SWAMP) === 'gas') progress = { ...startRun(seed, {}, 2, SWAMP.id), entered: false, outcome: null };
    expect(progress).not.toBeNull();
    expect(progress!.world.gas).toBeDefined();
    const w = progress!.world;
    const next = progressRun(progress!.run, { ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    expect(next.run.floor).toBe(3);
    if (next.run.kind !== 'gas') expect(next.world.gas).toBeUndefined();
  });

  it('is part of the step', () => {
    const world = onFloor(9, 'gas');
    let current: WorldState = { ...world, gas: advanceGas(world.gas!, GAS.graceMs + 2000) };
    let drained = false;
    for (let i = 0; i < ticksFor(GAS.drainIntervalMs + 50); i++) {
      current = step(current, input(), FIXED_DT_MS);
      drained ||= current.events.some((e) => e.type === 'collapseHurt');
    }
    expect(drained).toBe(true);
  });
});
