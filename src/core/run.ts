import { RUN, RUN_PLAN, URGENT, type FloorKind } from '../data/dungeon';
import type { ItemId } from '../data/items';
import { placeBerries } from './berries';
import { generateFloor } from './dungeon';
import { addItem, offerItems, playerStats } from './items';
import { loadFloor, onStairs } from './floor';
import { partyDefeated } from './party';
import { deriveSeed, nextRandom } from './rng';
import { atExit, loadRoom, roomCleared } from './rooms';
import type { WorldState } from './state';
import { vec } from './vec';
import { createWorld, type WorldOptions } from './world';

/**
 * A run (docs/gdd.md §3): the floors of `RUN_PLAN` in order, generated ones
 * from seeds derived from the run seed, so a run seed replays the same
 * dungeon. HP carries over between floors with a small heal on each new one;
 * Disguise resets per floor. Generated floors may be urgent (a collapse),
 * chosen by depth weights from the run seed too.
 */
export interface RunState {
  seed: number;
  /** Current floor, 1-based. */
  floor: number;
  /** Kind of the current floor (fixed rooms are always normal). */
  kind: FloorKind;
  /** Set on entering the floor right after a collapse floor: how long the escape took, for its title card. */
  escape: { floor: number; ms: number } | null;
  /**
   * Held items offered to the local player on entering this floor (every
   * floor after the first), until it picks one (`chooseItem`). Entering the
   * next floor first replaces an unpicked offer.
   */
  offer: readonly ItemId[] | null;
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

export const floorPlanOf = (run: Pick<RunState, 'floor'>) => RUN_PLAN[run.floor - 1]!;

/** Salt that keeps the urgent-floor draw independent of the floor generator's seed. */
const URGENT_SALT = 0x51ab;

/** Kind of a floor of a run: generated floors draw against the depth weights (never floor 1); fixed rooms are normal. */
export function floorKind(runSeed: number, floor: number): FloorKind {
  if (RUN_PLAN[floor - 1]?.kind !== 'generated') return 'normal';
  const table = URGENT.collapseChance;
  const chance = table[Math.min(floor, table.length) - 1] ?? 0;
  return nextRandom(deriveSeed(runSeed, floor + URGENT_SALT)).value < chance ? 'collapse' : 'normal';
}

export const isBossFloor = (run: RunState): boolean => {
  const plan = floorPlanOf(run);
  return plan.kind === 'room' && plan.room === 'boss';
};

/** Loads the run's current floor into the world (the heal is the caller's: none on floor 1). */
function enterFloor(world: WorldState, run: RunState): WorldState {
  const plan = floorPlanOf(run);
  const deeper = { ...world, depth: run.floor };
  if (plan.kind === 'room') return loadRoom(deeper, plan.room);
  const seed = floorSeed(run.seed, run.floor);
  const floor = generateFloor(seed, run.floor);
  return { ...loadFloor(deeper, floor, run.kind), berries: placeBerries(floor, seed, run.floor) };
}

/** The offer of a floor for the world's local player: none on floor 1. */
const offerFor = (run: Pick<RunState, 'seed' | 'floor'>, world: WorldState): readonly ItemId[] | null =>
  run.floor > 1 ? offerItems(run.seed, run.floor, world.localId, world.player.items) : null;

/** Starts a run on floor 1 (or `floor`, for development: the same floor that seed would reach, with its item offer). */
export function startRun(seed: number, options: Omit<WorldOptions, 'seed' | 'arena' | 'playerPos'>, floor = 1): { run: RunState; world: WorldState } {
  const start = Math.min(Math.max(1, Math.floor(floor)), RUN_PLAN.length);
  const base = createWorld({ ...options, seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const run: RunState = { seed, floor: start, kind: floorKind(seed, start), escape: null, offer: offerFor({ seed, floor: start }, base) };
  return { run, world: enterFloor(base, run) };
}

/** The local player takes item `index` of the current offer; anything else (no offer, bad index) changes nothing. */
export function chooseItem(run: RunState, world: WorldState, index: number): { run: RunState; world: WorldState } {
  const item = run.offer?.[index];
  if (item === undefined) return { run, world };
  return { run: { ...run, offer: null }, world: { ...world, player: addItem(world.player, item) } };
}

function heal(world: WorldState): WorldState {
  const { hp, maxHp } = world.player;
  const share = RUN.floorHeal + playerStats(world.player).floorHeal;
  return { ...world, player: { ...world.player, hp: Math.min(maxHp, hp + share * maxHp) } };
}

/** Moves the run to `floor` (the next one): records a collapse escape, heals, and loads it. */
function goDown(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  const escape = world.collapse ? { floor: run.floor, ms: world.collapse.elapsedMs } : null;
  const next: RunState = { ...run, floor, kind: floorKind(run.seed, floor), escape, offer: offerItems(run.seed, floor, world.localId, world.player.items) };
  return { run: next, world: enterFloor(heal(world), next) };
}

/**
 * After a step: defeat (every player down), victory (last floor cleared),
 * stairs (or a fixed room's exit) to the next floor, or nothing. In a shared
 * run only the host takes the stairs, when any player stands on them; guests
 * follow its floor change (`followToFloor`).
 */
export function progressRun(run: RunState, world: WorldState): RunProgress {
  if (partyDefeated(world)) return { run, world, entered: false, outcome: 'defeat' };
  const last = run.floor >= RUN_PLAN.length;
  if (last && floorPlanOf(run).kind === 'room' && roomCleared(world)) return { run, world, entered: false, outcome: 'victory' };
  if (world.role === 'guest') return { run, world, entered: false, outcome: null };
  const plan = floorPlanOf(run);
  const leaving = plan.kind === 'generated' ? onStairs(world) : atExit(world, plan.room);
  if (last || !leaving) return { run, world, entered: false, outcome: null };
  return { ...goDown(run, world, run.floor + 1), entered: true, outcome: null };
}

/** Guest: the host went down to `floor`; every peer generates it from the shared run seed. */
export function followToFloor(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  if (floor <= run.floor || floor > RUN_PLAN.length) return { run, world };
  return goDown(run, world, floor);
}
