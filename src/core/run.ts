import { echoAt, isHeraldFloor, type EndlessDef } from '../data/endless';
import { echoShare, echoStageAt, fightOf, type EchoStage } from './cards';
import { ECHO_CARDS } from '../data/cards';
import { behaviourFor } from './tricks';
import { heraldSeed, withHerald } from './herald/floor';
import { RUN, type FloorKind, type FloorPlan } from '../data/dungeon';
import { chanceAt, CRYPT, dungeonById, floorsOf, planAt, roadFor, type DungeonDef, type DungeonId } from '../data/dungeons';
import { ROOMS, type RoomRect } from '../data/rooms';
import { addTime, depthScale, descendBonusMs, endlessSpawns, tickClock } from './endless';
import { eliteRuleAt } from './sima';
import { chooseSimaEvent, descendPact, eventBonusMs, placeSimaEvent } from './sima-events';
import { insideRect } from './geometry';
import type { ItemId } from '../data/items';
import { placeBerries } from './berries';
import { shallowWater } from './water';
import { placePools } from './toxic';
import type { Floor } from './dungeon';
import { chooseGate, gateShut, placeGate } from './gates';
import type { SimaEventKind } from '../data/sima';
import { worldDifficulty } from './difficulty';
import { expectedLevel } from './fairness';
import { generatedFloor } from './floor-spawns';
import { addItem, offerItems, playerStats } from './items';
import { loadFloor, onStairs } from './floor';
import { wispCache } from './wisp';
import { partyDefeated, partyField, partySizeOf, presentPartySize } from './party';
import { deriveSeed, nextRandom } from './rng';
import { loadRoom, roomCleared } from './rooms';
import { atFogWall, closeFogWall, crossFogWall } from './fog-wall';
import type { WorldState } from './state';
import { vec, type Vec2 } from './vec';
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
  /** Endless: breathing room left on this floor before the clock runs again (ms). */
  graceMs?: number;
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
  /** True when this call took the party through a boss room's fog (core/fog-wall.ts). */
  crossed?: boolean;
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

/**
 * Whether the floor opens behind a fog wall (core/fog-wall.ts): every mid-boss
 * and guardian room of the main and challenge dungeons; never the Sima (its
 * echoes and heralds) nor the shrine (its trials load their arenas apart).
 */
export function fogWallFloor(run: Pick<RunState, 'floor' | 'dungeon'>): boolean {
  const plan = floorPlanOf(run);
  return plan.kind === 'room' && plan.role !== 'echo' && !dungeonOf(run).endless;
}

/** The floor as the party meets it: a boss room behind its fog when it has one (the game; the harnesses skip the wall). */
export const withFogWall = (run: RunState, world: WorldState): WorldState => (fogWallFloor(run) && !world.fogWall ? closeFogWall(world) : world);

/** Which meeting with this floor's guardian echo it is in the run (1 on its first floor; the echoes come round in turn). */
function guardianEncounter(endless: EndlessDef, floor: number): number {
  const room = echoAt(endless, floor).room;
  let n = 0;
  for (let f = endless.echoEvery; f <= floor; f += endless.echoEvery) if (echoAt(endless, f).room === room) n++;
  return Math.max(1, n);
}

/**
 * A card guardian's echo holds only the HP of the cards it plays (core/cards.ts
 * `echoShare`), at `ECHO_CARDS.hpScale` of the guardian's HP whatever the
 * depth (`depthHp` is the depth scale it spawned with, taken back out).
 */
function echoHp(world: WorldState, stage: EchoStage, depthHp: number): WorldState {
  const tier = worldDifficulty(world);
  const enemies = world.enemies.map((e) => {
    const fight = e.boss ? fightOf(behaviourFor(e.species, tier)) : undefined;
    if (!fight) return e;
    const maxHp = Math.max(1, Math.round((e.maxHp / depthHp) * ECHO_CARDS.hpScale * echoShare(fight, stage)));
    return { ...e, maxHp, hp: maxHp };
  });
  return { ...world, enemies };
}

/**
 * Loads the run's current floor into the world (the heal is the caller's: none on floor 1).
 * `party`: the players present at the floor entry (core/party.ts), frozen for the floor.
 */
function enterFloor(entering: WorldState, run: RunState, party = presentPartySize(entering)): WorldState {
  // A floor's revive uses (core/revive.ts) end with it.
  const { party: _before, revive: _revive, ...rest } = entering;
  const world: WorldState = { ...rest, ...partyField(party) };
  const plan = floorPlanOf(run);
  const endless = dungeonOf(run).endless;
  // The endless dungeon scales its enemies with depth (core/endless.ts); elsewhere they are as the data says.
  const echo = plan.kind === 'room' && plan.role === 'echo';
  // A card guardian's echo plays its tier's cards by depth (core/cards.ts `echoStageAt`): the stage rides on the floor's enemy scale.
  const stage = endless && echo ? echoStageAt(run.floor, guardianEncounter(endless, run.floor)) : undefined;
  const scaled = endless ? depthScale(endless.scaling, run.floor, echo) : undefined;
  const enemyScale = scaled && stage ? { ...scaled, echoStage: stage } : scaled;
  // A Sima event and a gate belong to their floor (the pact outlasts it).
  // The one-hit cap's yardstick (core/fairness.ts): the level expected on this floor, the same on every peer.
  const referenceLevel = expectedLevel(run.dungeon, run.floor, worldDifficulty(world));
  const deeper: WorldState = { ...world, depth: run.floor, enemyScale, referenceLevel, simaEvent: undefined, gate: undefined };
  if (plan.kind === 'room') {
    const room = stage && scaled ? echoHp(loadRoom(deeper, plan.room), stage, scaled.hp) : loadRoom(deeper, plan.room);
    // A herald floor: the generated boss of this run and floor (every peer makes the same one from the run seed). Room floors never draw a gate.
    return endless && isHeraldFloor(endless, run.floor) ? withHerald(room, heraldSeed(run.seed, run.floor), run.floor) : room;
  }
  const seed = floorSeed(run.seed, run.floor);
  // Harder tiers: more enemies per room (core/difficulty.ts); every peer generates the same floor from the host's tier.
  const tier = worldDifficulty(world);
  // The generator's rooms, the Sima's squads and the leaders (core/floor-spawns.ts, shared with core/fairness.ts).
  const floor = generatedFloor(dungeonOf(run), run.floor, seed, tier);
  const berries = placeBerries(floor, seed, run.floor);
  // The Forest's spirit light and its berry cache (none elsewhere).
  const wisp = wispCache(floor, seed, run.floor, dungeonOf(run), berries);
  // Elites: one system; the Sima's rule joins its depth ramp to the tier's chance (core/sima.ts `eliteRuleAt`), elsewhere the tier's.
  const loaded = loadFloor(deeper, floor, run.kind, endless?.elites ? eliteRuleAt(endless.elites, run.floor, tier) : undefined);
  // The caves lay shallow pools over their floors (seeded by the floor, the same on every peer).
  const water = dungeonOf(run).water;
  const arena = water ? { ...loaded.arena, water: shallowWater(floor, water) } : loaded.arena;
  const placed = wisp ? { ...loaded, arena, berries: [...berries, ...wisp.berries], wisp: { cache: wisp.cache } } : { ...loaded, arena, berries };
  // The Toxic Swamp's pools come from the floor seed too, so every peer places the same ones.
  const pooled = dungeonOf(run).toxicPools ? { ...placed, pools: placePools(floor, seed) } : placed;
  // The floor's gate, if any (core/gates.ts): at most one, never on floor 1 or an urgent floor.
  const drawnGate = chooseGate(run.seed, run.floor, run.kind, dungeonOf(run).gates);
  // The Sima's floor event, if this floor has one (sima-events.ts); a wave gate is its wave room.
  const rolled = endless?.events ? chooseSimaEvent(seed, run.floor, floor, run.kind, endless.events, tier) : null;
  const event = drawnGate === 'waves' && endless?.events ? waveRoomOf(floor, rolled) : rolled;
  const evented = event && endless?.events ? placeSimaEvent(pooled, event, floor, seed, run.floor, endless.events, endlessSpawns(endless, run.floor).pool, tier) : pooled;
  // The hunter already pushes (no gate then); a key gate beside a wave room becomes a seal (their doors must not mix).
  const gate = event?.kind === 'hunter' ? null : drawnGate === 'key' && event?.kind === 'waves' ? 'seal' : drawnGate;
  return gate ? placeGate(evented, gate, floor) : evented;
}

/** Loads `run`'s current floor into `world` with no heal (the boss shrine's arenas, core/shrine.ts). */
export const enterRunFloor = (world: WorldState, run: RunState): WorldState => enterFloor(world, run);

/** A wave gate's room: the rolled event's if it already is a wave room, else the first room that is neither the start nor the stairs. */
function waveRoomOf(floor: Floor, rolled: { kind: SimaEventKind; room: number } | null): { kind: SimaEventKind; room: number } | null {
  if (rolled?.kind === 'waves') return rolled;
  const room = floor.rooms.findIndex((_, i) => i !== floor.startRoom && i !== floor.stairsRoom);
  return room >= 0 ? { kind: 'waves', room } : rolled;
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
  // A Senda's challenge on Hard or Nightmare walks that chapter's own road (data/dungeons.ts `roadFor`); every peer maps it the same way.
  const def = roadFor(dungeonById(dungeon), options.difficulty);
  const start = Math.min(Math.max(1, Math.floor(floor)), floorsOf(def));
  const base = createWorld({ ...options, seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) });
  const run: RunState = {
    seed,
    dungeon: def.id,
    floor: start,
    kind: floorKind(seed, start, def),
    escape: null,
    offer: offerFor({ seed, floor: start }, base),
    ...(def.endless ? { clockMs: def.endless.clock.startMs, echoPaid: false, ...(def.endless.clock.graceMs ? { graceMs: def.endless.clock.graceMs } : {}) } : {}),
  };
  return { run, world: enterFloor(base, run, partySizeOf(base)) };
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
  const grace = endless?.clock.graceMs ? { graceMs: endless.clock.graceMs } : {};
  const clock = run.clockMs !== undefined ? { clockMs: addTime(run.clockMs, bonusMs), echoPaid: false, eventPaid: false, ...grace } : {};
  const next: RunState = { ...run, floor, kind: floorKind(run.seed, floor, dungeonOf(run)), escape, offer: offerItems(run.seed, floor, world.localId, world.player.items), ...clock };
  return { run: next, world: enterFloor(descendPact(heal(world)), next), bonusMs };
}

/** The run clock after `dtMs` more of play (the endless dungeon only; other runs have none). */
export function tickRunClock(run: RunState, dtMs: number): RunState {
  if (run.clockMs === undefined) return run;
  // A new floor's breathing room goes first.
  const grace = run.graceMs ?? 0;
  if (grace <= 0) return { ...run, clockMs: tickClock(run.clockMs, dtMs) };
  return { ...run, graceMs: Math.max(0, grace - dtMs), clockMs: tickClock(run.clockMs, Math.max(0, dtMs - grace)) };
}

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
 * Whether `pos` is where the current floor is left: the stairs of a generated
 * floor (unless a gate holds them shut), or the exit of a cleared room. Never
 * on the last floor (beating its room is the victory). In a boss room still
 * behind its fog (core/fog-wall.ts), the fog: agreeing there crosses it.
 */
export function atLeavingPoint(run: RunState, world: WorldState, pos: Vec2): boolean {
  // A boss room still behind its fog: touching the fog is the way on.
  if (world.fogWall) return atFogWall(world, pos);
  if (run.floor >= floorCount(run)) return false;
  const plan = floorPlanOf(run);
  if (plan.kind === 'generated') return onStairs(world, pos) && !gateShut(world);
  const exit = roomExit(plan, dungeonOf(run));
  return exit !== null && roomCleared(world) && insideRect(pos, exit);
}

/**
 * After a step: defeat (every player down), victory (last floor cleared),
 * the next floor, or nothing. `agreed` says the party chose to leave (the
 * stairs prompt and the gather rule, core/gather.ts); without it (the balance
 * and proof harnesses) the player standing on the leaving point leaves at
 * once. In a shared run only the host moves the party; guests follow its
 * floor change (`followToFloor`).
 */
export function progressRun(current: RunState, world: WorldState, agreed?: boolean): RunProgress {
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
  const leaving = agreed ?? atLeavingPoint(run, world, world.player.pos);
  if (world.fogWall) return { run, world: leaving ? crossFogWall(world) : world, entered: false, outcome: null, ...bonus, ...(leaving ? { crossed: true } : {}) };
  if (last || !leaving) return { run, world, entered: false, outcome: null, ...bonus };
  const down = goDown(run, world, run.floor + 1);
  const total = paid.bonusMs + down.bonusMs;
  return { run: down.run, world: down.world, entered: true, outcome: null, ...(total > 0 ? { bonusMs: total } : {}) };
}

/**
 * Back to an earlier `floor` of the run (a bonfire respawn for a player that
 * has no snapshot of it, core/bonfire.ts): no item offer, a fainted player
 * stands up with the floor heal; every peer generates it from the run seed.
 */
export function returnToFloor(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  const back: RunState = { ...run, floor, kind: floorKind(run.seed, floor, dungeonOf(run)), escape: null, offer: null };
  const { hp, maxHp } = world.player;
  const stood = hp > 0 ? world : { ...world, player: { ...world.player, hp: Math.max(1, Math.round(RUN.floorHeal * maxHp)) } };
  return { run: back, world: enterFloor(stood, back) };
}

/** Guest: the host went down to `floor`; every peer generates it from the shared run seed. */
export function followToFloor(run: RunState, world: WorldState, floor: number): { run: RunState; world: WorldState } {
  if (floor <= run.floor || floor > floorCount(run)) return { run, world };
  const down = goDown(run, world, floor);
  return { run: down.run, world: down.world };
}
