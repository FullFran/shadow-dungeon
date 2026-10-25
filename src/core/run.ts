import { RUN, RUN_PLAN } from '../data/dungeon';
import { generateFloor } from './dungeon';
import { loadFloor, onStairs } from './floor';
import { deriveSeed } from './rng';
import { atExit, loadRoom, roomCleared } from './rooms';
import type { WorldState } from './state';
import { vec } from './vec';
import { createWorld, type WorldOptions } from './world';

/**
 * A run (docs/gdd.md §3): the floors of `RUN_PLAN` in order, generated ones
 * from seeds derived from the run seed, so a run seed replays the same
 * dungeon. HP carries over between floors with a small heal on each new one;
 * Disguise resets per floor.
 */
export interface RunState {
  seed: number;
  /** Current floor, 1-based. */
  floor: number;
}

export type RunOutcome = 'defeat' | 'victory';

export interface RunProgress {
  run: RunState;
  world: WorldState;
  /** True when this call moved to a new floor. */
  entered: boolean;
  outcome: RunOutcome | null;
}

/** Seed of one generated floor of a run. */
export const floorSeed = (runSeed: number, floor: number): number => deriveSeed(runSeed, floor);

export const floorPlanOf = (run: RunState) => RUN_PLAN[run.floor - 1]!;

export const isBossFloor = (run: RunState): boolean => {
  const plan = floorPlanOf(run);
  return plan.kind === 'room' && plan.room === 'boss';
};

/** Loads the run's current floor into the world (the heal is the caller's: none on floor 1). */
function enterFloor(world: WorldState, run: RunState): WorldState {
  const plan = floorPlanOf(run);
  return plan.kind === 'generated' ? loadFloor(world, generateFloor(floorSeed(run.seed, run.floor), run.floor)) : loadRoom(world, plan.room);
}

export function startRun(seed: number, options: Omit<WorldOptions, 'seed' | 'arena' | 'playerPos'>): { run: RunState; world: WorldState } {
  const run = { seed, floor: 1 };
  const base = createWorld({ ...options, seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  return { run, world: enterFloor(base, run) };
}

function heal(world: WorldState): WorldState {
  const { hp, maxHp } = world.player;
  return { ...world, player: { ...world.player, hp: Math.min(maxHp, hp + RUN.floorHeal * maxHp) } };
}

/** After a step: defeat, victory (last floor cleared), stairs (or a fixed room's exit) to the next floor, or nothing. */
export function progressRun(run: RunState, world: WorldState): RunProgress {
  if (world.player.hp <= 0) return { run, world, entered: false, outcome: 'defeat' };
  const last = run.floor >= RUN_PLAN.length;
  if (last && floorPlanOf(run).kind === 'room' && roomCleared(world)) return { run, world, entered: false, outcome: 'victory' };
  const plan = floorPlanOf(run);
  const leaving = plan.kind === 'generated' ? onStairs(world) : atExit(world, plan.room);
  if (last || !leaving) return { run, world, entered: false, outcome: null };
  const next = { ...run, floor: run.floor + 1 };
  return { run: next, world: enterFloor(heal(world), next), entered: true, outcome: null };
}
