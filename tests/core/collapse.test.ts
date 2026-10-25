import { describe, expect, it } from 'vitest';
import { COLLAPSE, RUN_PLAN, URGENT } from '../../src/data/dungeon';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import {
  advanceCollapse,
  collapseFront,
  collapseProximity,
  isCollapsed,
  startCollapse,
  updateCollapse,
  type CollapseState,
} from '../../src/core/collapse';
import { generateFloor } from '../../src/core/dungeon';
import { loadFloor } from '../../src/core/floor';
import { floorKind, floorSeed, progressRun, startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { TILE, tileCenter, tileOf, type TilePoint } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input, run } from './helpers';

const floor = generateFloor(7, 2);
const fresh = (): WorldState => loadFloor(createWorld({ seed: 7, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), floor, 'collapse');
const distOf = (c: CollapseState, tile: TilePoint) => c.dist[tile.y * floor.cols + tile.x]!;

/** A tile at walking distance `d` from the start. */
function tileAtDistance(c: CollapseState, d: number): TilePoint {
  const index = c.dist.findIndex((v) => v === d);
  return { x: index % floor.cols, y: Math.floor(index / floor.cols) };
}

/** Advances only the collapse clock (no simulation) to `ms` after entry. */
const at = (state: WorldState, ms: number): WorldState => ({ ...state, collapse: { ...state.collapse!, elapsedMs: ms } });

describe('urgent floor choice', () => {
  it('never makes floor 1 urgent, and follows the depth weights on the Crypt floors 2, 4 and 5', () => {
    const counts = [0, 0, 0, 0, 0];
    const seeds = 4000;
    for (let seed = 0; seed < seeds; seed++) {
      for (const f of [1, 2, 4, 5]) if (floorKind(seed, f) === 'collapse') counts[f - 1]! += 1;
    }
    expect(counts[0]).toBe(0);
    for (const f of [2, 4, 5]) expect(counts[f - 1]! / seeds).toBeCloseTo(URGENT.collapseChance[f - 1]!, 1);
  });

  it('is a pure function of the run seed and floor, and never applies to fixed rooms', () => {
    for (let seed = 0; seed < 50; seed++) expect(floorKind(seed, 3)).toBe(floorKind(seed, 3));
    const bossFloor = RUN_PLAN.findIndex((p) => p.kind === 'room') + 1;
    for (let seed = 0; seed < 200; seed++) expect(floorKind(seed, bossFloor)).toBe('normal');
  });
});

describe('collapse front', () => {
  it('waits for the grace delay, then collapses tiles closer to the start than the front', () => {
    const state = fresh();
    const c = state.collapse!;
    expect(c.elapsedMs).toBe(0);
    expect(isCollapsed(at(state, COLLAPSE.graceMs - 1).collapse!, floor.cols, floor.start)).toBe(false);
    const later = at(state, COLLAPSE.graceMs + 4000).collapse!;
    const front = collapseFront(later);
    expect(front).toBeCloseTo(COLLAPSE.frontTilesPerSecond * 4, 5);
    expect(isCollapsed(later, floor.cols, floor.start)).toBe(true);
    expect(isCollapsed(later, floor.cols, tileAtDistance(c, Math.floor(front) - 1))).toBe(true);
    expect(isCollapsed(later, floor.cols, tileAtDistance(c, Math.ceil(front) + 1))).toBe(false);
    // Walls never "collapse".
    expect(isCollapsed(later, floor.cols, { x: 0, y: 0 })).toBe(false);
  });

  it('reaches the stairs no sooner than the safety factor times the walk to them, on every seed', () => {
    const walkMsPerTile = (TILE / TUNING.player.moveSpeed) * 1000;
    for (let seed = 0; seed < 300; seed++) {
      for (const depth of [2, 3]) {
        const generated = generateFloor(seed, depth);
        let c = startCollapse(generated);
        const stairsDist = c.dist[generated.stairs.y * generated.cols + generated.stairs.x]!;
        expect(stairsDist).toBeGreaterThan(0);
        let ticks = 0;
        while (!isCollapsed(c, generated.cols, generated.stairs)) {
          c = advanceCollapse(c, FIXED_DT_MS);
          ticks++;
        }
        const reachedMs = ticks * FIXED_DT_MS - COLLAPSE.graceMs;
        expect(reachedMs).toBeGreaterThanOrEqual(stairsDist * walkMsPerTile * COLLAPSE.safetyFactor);
      }
    }
  });

  it('reports how close the player stands to the front once it moves', () => {
    const state = fresh();
    expect(collapseProximity(state)).toBeNull();
    const moving = at(state, COLLAPSE.graceMs + 2000);
    const ahead = tileAtDistance(moving.collapse!, 10);
    const placed = { ...moving, player: { ...moving.player, pos: tileCenter(ahead) } };
    expect(collapseProximity(placed)).toBeCloseTo(10 - collapseFront(moving.collapse!), 5);
    expect(collapseProximity(createWorld({ seed: 1, arena: { width: 100, height: 100 }, playerPos: vec(5, 5) }))).toBeNull();
  });
});

describe('collapsed ground', () => {
  /** The player on the start tile once the front has passed it. */
  const buried = () => at(fresh(), COLLAPSE.graceMs + 3000);

  it('hurts on a fixed interval and pushes the player towards standing ground', () => {
    const state = buried();
    const events: GameEvent[] = [];
    const once = updateCollapse(state, FIXED_DT_MS, events);
    const damage = COLLAPSE.damageFraction * state.player.maxHp;
    expect(once.player.hp).toBeCloseTo(state.player.hp - damage, 5);
    expect(events).toContainEqual({ type: 'collapseHurt', damage });
    // No second tick before the interval is over.
    const soon = updateCollapse(once, FIXED_DT_MS, []);
    expect(soon.player.hp).toBe(once.player.hp);
    // Pushed: the walking distance under the player grows (towards the front edge).
    const pushed = run(state, input(), 60);
    expect(distOf(pushed.collapse!, tileOf(pushed.player.pos))).toBeGreaterThan(distOf(state.collapse!, tileOf(state.player.pos)));
    // Out onto standing ground within a couple of seconds (an idle player then rides the front edge).
    let out = state;
    let reached = false;
    for (let i = 0; i < 150 && !reached; i++) {
      out = run(out, input(), 1);
      reached = !isCollapsed(out.collapse!, floor.cols, tileOf(out.player.pos));
    }
    expect(reached).toBe(true);
  });

  it('skips the damage tick during roll i-frames, then hurts once they end', () => {
    const state = buried();
    const rolling = { ...state, player: { ...state.player, roll: { elapsedMs: TUNING.roll.iframesStartMs + 10, dir: vec(1, 0) } } };
    const events: GameEvent[] = [];
    const dodged = updateCollapse(rolling, FIXED_DT_MS, events);
    expect(dodged.player.hp).toBe(state.player.hp);
    expect(events.some((e) => e.type === 'collapseHurt')).toBe(false);
    const after = updateCollapse({ ...dodged, player: { ...dodged.player, roll: null } }, FIXED_DT_MS, []);
    expect(after.player.hp).toBeLessThan(state.player.hp);
  });

  it('bypasses Disguise: the ground is not an attack', () => {
    const state = buried();
    expect(state.player.disguiseBroken).toBe(false);
    const hurt = updateCollapse(state, FIXED_DT_MS, []);
    expect(hurt.player.disguiseBroken).toBe(false);
    expect(hurt.player.hp).toBeLessThan(state.player.hp);
  });

  it('drops walking enemies standing on it; ghosts float on', () => {
    let state = buried();
    const tile = state.collapse!.dist.findIndex((d, i) => d === 1 && i >= 0);
    const pos = tileCenter({ x: tile % floor.cols, y: Math.floor(tile / floor.cols) });
    state = spawnEnemy(spawnEnemy(state, 'poochyena', pos, { dormant: true }), 'gastly', pos, { dormant: true });
    const events: GameEvent[] = [];
    const after = updateCollapse(state, FIXED_DT_MS, events);
    const [walker, ghost] = after.enemies.slice(-2);
    expect(walker!.alive).toBe(false);
    expect(events).toContainEqual({ type: 'enemyDefeated', enemyId: walker!.id });
    expect(ghost!.alive).toBe(true);
  });

  it('does nothing on normal floors', () => {
    const normal = loadFloor(createWorld({ seed: 7, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), floor);
    expect(normal.collapse).toBeUndefined();
    expect(updateCollapse(normal, FIXED_DT_MS, [])).toBe(normal);
  });
});

describe('collapse floors in a run', () => {
  /** First seed whose floor 2 is a collapse floor. */
  const seed = [...Array(200).keys()].find((s) => floorKind(s, 2) === 'collapse')!;
  const toStairs = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, pos: tileCenter(tileOf(vec(world.arena.stairs!.x + 1, world.arena.stairs!.y + 1))) } });

  it('loads the collapse on its floor and records the escape time on the stairs', () => {
    const start = startRun(seed, {});
    expect(start.run.kind).toBe('normal');
    expect(start.world.collapse).toBeUndefined();
    const second = progressRun(start.run, toStairs(start.world));
    expect(second.run.floor).toBe(2);
    expect(second.run.kind).toBe('collapse');
    expect(second.world.collapse).toBeDefined();
    expect(second.world.arena.tiles).toEqual(generateFloor(floorSeed(seed, 2), 2));
    const escaped = progressRun(second.run, toStairs(at(second.world, 42_000)));
    expect(escaped.run.floor).toBe(3);
    expect(escaped.run.escape).toEqual({ floor: 2, ms: 42_000 });
    expect(escaped.world.collapse === undefined).toBe(escaped.run.kind === 'normal');
    // The escape line belongs to the card right after it only (floor 3 is Sableye's vault: out through its exit).
    const exit = ROOMS.vault.exit!;
    const beaten = { ...escaped.world, enemies: escaped.world.enemies.map((e) => ({ ...e, alive: false })), player: { ...escaped.world.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } };
    const fourth = progressRun(escaped.run, beaten);
    expect(fourth.run.floor).toBe(4);
    expect(fourth.run.escape).toBeNull();
  });

  it('clears the collapse on the fixed rooms (the mid-boss vault)', () => {
    let progress = { ...startRun(seed, {}), entered: false, outcome: null } as ReturnType<typeof progressRun>;
    for (let i = 0; i < 2; i++) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(3);
    expect(progress.world.collapse).toBeUndefined();
  });
});
