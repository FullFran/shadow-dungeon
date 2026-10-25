import { RUN, type FloorKind, type FloorPlan } from '../data/dungeon';
import { chanceAt, CRYPT, dungeonById, type DungeonDef, type DungeonId } from '../data/dungeons';
import type { ItemId } from '../data/items';
import { placeBerries } from './berries';
import { generateFloor } from './dungeon';
import { addItem, offerItems } from './items';
import { loadFloor, onStairs } from './floor';
import { partyDefeated } from './party';
import { deriveSeed, nextRandom } from './rng';
import { atExit, loadRoom, roomCleared } from './rooms';
import type { WorldState } from './state';
import { vec } from './vec';
import { createWorld, type WorldOptions } from './world';

/**
 * A run (docs/gdd.md §3): the floors of its dungeon's plan in order, generated ones
 * from seeds derived from the run seed, so a run seed replays the same
 * dungeon. HP carries over between floors with a small heal on each new one;
 * Disguise resets per floor. Generated floors may be urgent (a collapse),
 * chosen by depth weights from the run seed too.
 */
export interface RunState {
  seed: number;
  /** The dungeon being run (data/dungeons.ts); every peer of a shared run plays the host's. */
  dungeon: DungeonId;
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

export const dungeonOf = (run: Pick<RunState, 'dungeon'>): DungeonDef => dungeonById(run.dungeon);

export const floorPlanOf = (run: Pick<RunState, 'floor' | 'dungeon'>): FloorPlan => dungeonOf(run).plan[run.floor - 1]!;

/** Number of floors of the run's dungeon (the last is its guardian). */
export const floorCount = (run: Pick<RunState, 'dungeon'>): number => dungeonOf(run).plan.length;

/** Salt that keeps the urgent-floor draw independent of the floor generator's seed. */
const URGENT_SALT = 0x51ab;

/**
 * Kind of a floor of a run: generated floors make one draw against the
 * dungeon's urgent weights for that depth, taken in order (never floor 1 so
 * far); fixed rooms are normal.
 */
export function floorKind(runSeed: number, floor: number, dungeon: DungeonDef = CRYPT): FloorKind {
  if (dungeon.plan[floor - 1]?.kind !== 'generated') return 'normal';
  const roll = nextRandom(deriveSeed(runSeed, floor + URGENT_SALT)).value;
  let threshold = 0;
  for (const urgent of dungeon.urgent) {
    threshold += chanceAt(urgent.chance, floor);
    if (roll < threshold) return urgent.kind;
  }
  return 'normal';
}

/** The guardian's floor (a fixed arena that is not a mid-boss). */
export const isBossFloor = (run: Pick<RunState, 'floor' | 'dungeon'>): boolean => {
  const plan = floorPlanOf(run);
  return plan.kind === 'room' && plan.role !== 'midboss';
};

/** Loads the run's current floor into the world (the heal is the caller's: none on floor 1). */
function enterFloor(world: WorldState, run: RunState): WorldState {
  const plan = floorPlanOf(run);
  const deeper = { ...world, depth: run.floor };
  if (plan.kind === 'room') return loadRoom(deeper, plan.room);
  const seed = floorSeed(run.seed, run.floor);
  const floor = generateFloor(seed, run.floor, dungeonOf(run).spawns);
  return { ...loadFloor(deeper, floor, run.kind), berries: placeBerries(floor, seed, run.floor) };
}

/** The offer of a floor for the world's local player: none on floor 1. */
const offerFor = (run: Pick<RunState, 'seed' | 'floor'>, world: WorldState): readonly ItemId[] | null =>
  run.floor > 1 ? offerItems(run.seed, run.floor, world.localId, world.player.items) : null;

/**
 * Starts a run of `dungeon` (the Crypt by default) on floor 1, or on `floor`
 * for development: the same floor that seed would reach, with its item offer.
 */
export function startRun(
  seed: number,
  options: Omit<WorldOptions, 'seed' | 'arena' | 'playerPos'>,
  floor = 1,
  dungeon: DungeonId = CRYPT.id,
): { run: RunState; world: WorldState } {
  const def = dungeonById(dungeon);
  const start = Math.min(Math.max(1, Math.floor(floor)), def.plan.length);
  const base = createWorld({ ...options, seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const run: RunState = { seed, dungeon: def.id, floor: start, kind: floorKind(seed, start, def), escape: null, offer: offerFor({ seed, floor: start }, base) };
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
  return { ...world, player: { ...world.player, hp: Math.min(maxHp, hp + RUN.floorHeal * maxHp) } };
}

/** Moves the run to `floor` (the next one): records a collapse escape, heals, and loads it. */
function goDown(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  const escape = world.collapse ? { floor: run.floor, ms: world.collapse.elapsedMs } : null;
  const next: RunState = { ...run, floor, kind: floorKind(run.seed, floor, dungeonOf(run)), escape, offer: offerItems(run.seed, floor, world.localId, world.player.items) };
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
  const last = run.floor >= floorCount(run);
  if (last && floorPlanOf(run).kind === 'room' && roomCleared(world)) return { run, world, entered: false, outcome: 'victory' };
  if (world.role === 'guest') return { run, world, entered: false, outcome: null };
  const plan = floorPlanOf(run);
  const leaving = plan.kind === 'generated' ? onStairs(world) : atExit(world, plan.room);
  if (last || !leaving) return { run, world, entered: false, outcome: null };
  return { ...goDown(run, world, run.floor + 1), entered: true, outcome: null };
}

/** Guest: the host went down to `floor`; every peer generates it from the shared run seed. */
export function followToFloor(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  if (floor <= run.floor || floor > floorCount(run)) return { run, world };
  return goDown(run, world, floor);
}
