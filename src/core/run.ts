import { RUN, type FloorKind, type FloorPlan } from '../data/dungeon';
import { chanceAt, CRYPT, dungeonById, floorsOf, planAt, type DungeonDef, type DungeonId } from '../data/dungeons';
import { ROOMS, type RoomRect } from '../data/rooms';
import { addTime, depthScale, descendBonusMs, endlessSpawns, tickClock } from './endless';
import { rollElites, simaSquads } from './sima';
import { chooseSimaEvent, descendPact, eventBonusMs, placeSimaEvent } from './sima-events';
import { worldDifficulty } from './difficulty';
import { insideRect } from './geometry';
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
  /** Endless dungeon only: the run clock, ms left (the host's in a shared run). Absent elsewhere. */
  clockMs?: number;
  /** Endless dungeon only: this floor's echo already paid its time bonus. */
  echoPaid?: boolean;
  /** Sima: this floor's event already paid its time (the crystal, a cleared wave room). */
  eventPaid?: boolean;
}

/** `eclipse`: the endless dungeon's clock ran out (a score end, not a defeat). */
export type RunOutcome = 'defeat' | 'victory' | 'eclipse';

export interface RunProgress {
  run: RunState;
  world: WorldState;
  /** True when this call moved to a new floor. */
  entered: boolean;
  outcome: RunOutcome | null;
  /** Time this call added to the run clock (an echo felled, a floor entered), for the HUD; 0 or absent otherwise. */
  bonusMs?: number;
}

/** Seed of one generated floor of a run. */
export const floorSeed = (runSeed: number, floor: number): number => deriveSeed(runSeed, floor);

export const dungeonOf = (run: Pick<RunState, 'dungeon'>): DungeonDef => dungeonById(run.dungeon);

export const floorPlanOf = (run: Pick<RunState, 'floor' | 'dungeon'>): FloorPlan => planAt(dungeonOf(run), run.floor)!;

/** Number of floors of the run's dungeon (the last is its guardian); infinite for the endless dungeon. */
export const floorCount = (run: Pick<RunState, 'dungeon'>): number => floorsOf(dungeonOf(run));

/** The way on of a fixed room: its own exit, or for a guardian echo the top centre of its arena. */
export function roomExit(plan: FloorPlan, dungeon: DungeonDef): RoomRect | null {
  if (plan.kind !== 'room') return null;
  const room = ROOMS[plan.room];
  if (plan.role !== 'echo' || !dungeon.endless) return room.exit;
  const { width, height } = dungeon.endless.echoExit;
  return { x: Math.round(room.width / 2 - width / 2), y: 0, width, height };
}

/** Salt that keeps the urgent-floor draw independent of the floor generator's seed. */
const URGENT_SALT = 0x51ab;

/**
 * Kind of a floor of a run: generated floors make one draw against the
 * dungeon's urgent weights for that depth, taken in order (never floor 1 so
 * far); fixed rooms are normal.
 */
export function floorKind(runSeed: number, floor: number, dungeon: DungeonDef = CRYPT): FloorKind {
  if (planAt(dungeon, floor)?.kind !== 'generated') return 'normal';
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
  return plan.kind === 'room' && plan.role === undefined;
};

/** Loads the run's current floor into the world (the heal is the caller's: none on floor 1). */
function enterFloor(world: WorldState, run: RunState): WorldState {
  const plan = floorPlanOf(run);
  const endless = dungeonOf(run).endless;
  // The endless dungeon scales its enemies with depth (core/endless.ts); elsewhere they are as the data says.
  const enemyScale = endless ? depthScale(endless.scaling, run.floor, plan.kind === 'room' && plan.role === 'echo') : undefined;
  // A Sima event belongs to its floor (the pact outlasts it).
  const deeper: WorldState = { ...world, depth: run.floor, enemyScale, simaEvent: undefined };
  if (plan.kind === 'room') return loadRoom(deeper, plan.room);
  const seed = floorSeed(run.seed, run.floor);
  const drawn = generateFloor(seed, run.floor, endless ? endlessSpawns(endless, run.floor) : dungeonOf(run).spawns);
  // The Sima: some rooms hold mixed squads, and some enemies are elites (tougher, not more).
  const floor = endless?.squads ? simaSquads(drawn, seed, run.floor, endless.squads) : drawn;
  const loaded: WorldState = { ...loadFloor(deeper, floor, run.kind), berries: placeBerries(floor, seed, run.floor) };
  const tough = endless?.elites ? rollElites(loaded, seed, run.floor, endless.elites) : loaded;
  // The Sima's floor event, if this floor has one (sima-events.ts).
  const event = endless?.events ? chooseSimaEvent(seed, run.floor, floor, run.kind, endless.events) : null;
  return event && endless?.events ? placeSimaEvent(tough, event, floor, seed, run.floor, endless.events, endlessSpawns(endless, run.floor).pool, worldDifficulty(tough)) : tough;
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
  const start = Math.min(Math.max(1, Math.floor(floor)), floorsOf(def));
  const base = createWorld({ ...options, seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const run: RunState = {
    seed,
    dungeon: def.id,
    floor: start,
    kind: floorKind(seed, start, def),
    escape: null,
    offer: offerFor({ seed, floor: start }, base),
    ...(def.endless ? { clockMs: def.endless.clock.startMs, echoPaid: false } : {}),
  };
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
function goDown(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState; bonusMs: number } {
  const escape = world.collapse ? { floor: run.floor, ms: world.collapse.elapsedMs } : null;
  const endless = dungeonOf(run).endless;
  const bonusMs = endless && run.clockMs !== undefined && run.clockMs > 0 ? descendBonusMs(endless.clock, floor) : 0;
  const clock = run.clockMs !== undefined ? { clockMs: addTime(run.clockMs, bonusMs), echoPaid: false, eventPaid: false } : {};
  const next: RunState = { ...run, floor, kind: floorKind(run.seed, floor, dungeonOf(run)), escape, offer: offerItems(run.seed, floor, world.localId, world.player.items), ...clock };
  return { run: next, world: enterFloor(descendPact(heal(world)), next), bonusMs };
}

/** The run clock after `dtMs` more of play (the endless dungeon only; other runs have none). */
export const tickRunClock = (run: RunState, dtMs: number): RunState => (run.clockMs === undefined ? run : { ...run, clockMs: tickClock(run.clockMs, dtMs) });

/** Guest: the host's clock as received (never below 0). */
export const setClock = (run: RunState, ms: number): RunState => ({ ...run, clockMs: Math.max(0, ms) });

/** Endless: a felled guardian echo pays its time bonus once (the host's clock; a guest's follows it). */
function payEcho(run: RunState, world: WorldState): { run: RunState; bonusMs: number } {
  const endless = dungeonOf(run).endless;
  const plan = floorPlanOf(run);
  if (!endless || run.echoPaid || run.clockMs === undefined || plan.kind !== 'room' || plan.role !== 'echo' || !roomCleared(world)) return { run, bonusMs: 0 };
  const clockMs = addTime(run.clockMs, endless.clock.echoMs);
  return { run: { ...run, clockMs, echoPaid: true }, bonusMs: clockMs - run.clockMs };
}

/** Sima: a floor event that pays time (the crystal touched, a wave room cleared) pays it once (the host's clock). */
function payEvent(run: RunState, world: WorldState): { run: RunState; bonusMs: number } {
  const events = dungeonOf(run).endless?.events;
  const due = events ? eventBonusMs(world.simaEvent, events) : 0;
  if (due <= 0 || run.eventPaid || run.clockMs === undefined) return { run, bonusMs: 0 };
  const clockMs = addTime(run.clockMs, due);
  return { run: { ...run, clockMs, eventPaid: true }, bonusMs: clockMs - run.clockMs };
}

/**
 * After a step: defeat (every player down), victory (last floor cleared),
 * stairs (or a fixed room's exit) to the next floor, or nothing. In a shared
 * run only the host takes the stairs, when any player stands on them; guests
 * follow its floor change (`followToFloor`).
 */
export function progressRun(current: RunState, world: WorldState): RunProgress {
  if (partyDefeated(world)) return { run: current, world, entered: false, outcome: 'defeat' };
  // Endless: the eclipse swallows the floor when the host's clock runs out (a guest ends on the host's word).
  if (current.clockMs !== undefined && current.clockMs <= 0 && world.role !== 'guest') return { run: current, world, entered: false, outcome: 'eclipse' };
  const echoPaid = payEcho(current, world);
  const eventPaid = payEvent(echoPaid.run, world);
  const paid = { run: eventPaid.run, bonusMs: echoPaid.bonusMs + eventPaid.bonusMs };
  const run = paid.run;
  const last = run.floor >= floorCount(run);
  if (last && floorPlanOf(run).kind === 'room' && roomCleared(world)) return { run, world, entered: false, outcome: 'victory' };
  const bonus = paid.bonusMs > 0 ? { bonusMs: paid.bonusMs } : {};
  if (world.role === 'guest') return { run, world, entered: false, outcome: null, ...bonus };
  const plan = floorPlanOf(run);
  const exit = roomExit(plan, dungeonOf(run));
  const leaving =
    plan.kind === 'generated' ? onStairs(world) : plan.role === 'echo' ? exit !== null && roomCleared(world) && insideRect(world.player.pos, exit) : atExit(world, plan.room);
  if (last || !leaving) return { run, world, entered: false, outcome: null, ...bonus };
  const down = goDown(run, world, run.floor + 1);
  const total = paid.bonusMs + down.bonusMs;
  return { run: down.run, world: down.world, entered: true, outcome: null, ...(total > 0 ? { bonusMs: total } : {}) };
}

/** Guest: the host went down to `floor`; every peer generates it from the shared run seed. */
export function followToFloor(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  if (floor <= run.floor || floor > floorCount(run)) return { run, world };
  const down = goDown(run, world, floor);
  return { run: down.run, world: down.world };
}
