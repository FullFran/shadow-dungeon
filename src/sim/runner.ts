import type { FloorKind } from '../data/dungeon';
import type { Difficulty } from '../data/difficulty';
import { dungeonById, floorsOf, planAt, type DungeonId } from '../data/dungeons';
import { ROOMS } from '../data/rooms';
import type { SpeciesId } from '../data/species';
import { chooseItem, floorPlanOf, progressRun, roomExit, startRun, tickRunClock, type RunState } from '../core/run';
import type { Rect, WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { createBot, type BotKind } from './bots';
import { FloorRecorder, type FloorMetrics } from './metrics';
import { observe } from './observe';
import { applyParty } from './party';

/** One cell of a sweep: who plays what. */
export interface Scenario {
  dungeon: DungeonId;
  tier: Difficulty;
  bot: BotKind;
  /** 1 to 4 (src/sim/party.ts). */
  party: number;
  seed: number;
}

export type FloorOutcome = 'cleared' | 'died' | 'timeout';

export interface FloorResult extends FloorMetrics {
  floor: number;
  kind: FloorKind | 'room';
  /** The fixed arena's first enemy (its guardian, mid-boss or echo); null on generated floors. */
  boss: SpeciesId | null;
  outcome: FloorOutcome;
}

export interface RunResult {
  scenario: Scenario;
  floors: FloorResult[];
  /** `victory` the last floor cleared; `depth` stopped at `maxFloors` (the endless dungeon); `eclipse` its clock ran out. */
  outcome: 'victory' | 'defeat' | 'timeout' | 'depth' | 'eclipse';
}

export interface RunOptions {
  /** Floors of the endless Sima to play at most (it has no last one; other dungeons play to their guardian). Default 10. */
  maxFloors?: number;
  /** A floor or arena still going after this long is a timeout. Default 5 min. */
  floorTimeoutMs?: number;
  /**
   * Test hook: changes the world before each step (the planted unwinnable
   * pattern, tests/sim/bands.test.ts). Never used by the real sweep.
   */
  inject?: (world: WorldState) => WorldState;
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** A bot seed of its own per scenario (the run seed drives the floors). */
const botSeed = (s: Scenario): number => (s.seed * 31 + s.party * 7 + s.bot.length * 131) | 0;

/** Where the bot's way on is: the stairs, or a fixed room's exit (null for a guardian's last room). */
function exitOf(run: RunState, world: WorldState): Rect | null {
  const plan = floorPlanOf(run);
  if (plan.kind === 'generated') return world.arena.stairs ?? null;
  return roomExit(plan, dungeonById(run.dungeon));
}

function floorMeta(run: RunState): Pick<FloorResult, 'floor' | 'kind' | 'boss'> {
  const plan = floorPlanOf(run);
  if (plan.kind === 'generated') return { floor: run.floor, kind: run.kind, boss: null };
  return { floor: run.floor, kind: 'room', boss: ROOMS[plan.room].spawns[0]?.species ?? null };
}

/** The floor numbers of a dungeon's fixed arenas (guardian, mid-bosses; the Sima's echoes up to `maxFloors`). */
export function arenaFloors(dungeon: DungeonId, maxFloors = 10): number[] {
  const def = dungeonById(dungeon);
  const last = def.endless ? maxFloors : floorsOf(def);
  const out: number[] = [];
  for (let f = 1; f <= last; f++) if (planAt(def, f)?.kind === 'room') out.push(f);
  return out;
}

/**
 * Plays from `startFloor` floor by floor: HP, level and items carry over as in
 * a real run (the bot takes the first item offered). Stops at the first death,
 * a timeout, victory, or (the endless Sima) `maxFloors` floors played. With `single`, plays only
 * the first floor (an arena in isolation).
 */
function play(s: Scenario, startFloor: number, options: RunOptions, single: boolean): RunResult {
  const maxFloors = options.maxFloors ?? 10;
  const endless = dungeonById(s.dungeon).endless !== undefined;
  const timeout = options.floorTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const bot = createBot(s.bot, botSeed(s));
  // Floor 1 starts at the party size like a co-op room (`WorldOptions.party`); later floors go through `applyParty`.
  const started = startRun(s.seed, { difficulty: s.tier, ...(s.party > 1 ? { party: s.party } : {}) }, startFloor, s.dungeon);
  let run = started.run;
  let world = applyParty(started.world, s.party);
  const floors: FloorResult[] = [];
  let meta = floorMeta(run);
  let recorder = new FloorRecorder(world);
  let floorStart = world.timeMs;
  const close = (outcome: FloorOutcome) => floors.push({ ...meta, ...recorder.finish(), outcome });
  for (;;) {
    const before = options.inject ? options.inject(world) : world;
    const input = bot.decide(observe(before), { exit: exitOf(run, before), urgent: run.kind !== 'normal' });
    const after = step(before, input, FIXED_DT_MS);
    recorder.record(before, after);
    const progress = progressRun(tickRunClock(run, FIXED_DT_MS), after);
    if (progress.outcome) {
      close(progress.outcome === 'victory' ? 'cleared' : progress.outcome === 'defeat' ? 'died' : 'timeout');
      return { scenario: s, floors, outcome: progress.outcome };
    }
    if (progress.entered) {
      close('cleared');
      if (single || (endless && floors.length >= maxFloors)) return { scenario: s, floors, outcome: 'depth' };
      const picked = chooseItem(progress.run, progress.world, 0);
      run = picked.run;
      world = applyParty(picked.world, s.party);
      meta = floorMeta(run);
      recorder = new FloorRecorder(world);
      floorStart = world.timeMs;
      continue;
    }
    run = progress.run;
    world = progress.world;
    // A fixed arena in isolation is over once its enemies are down (a mid-boss room then waits for its exit).
    if (single && meta.kind === 'room' && world.enemies.every((e) => !e.alive)) {
      close('cleared');
      return { scenario: s, floors, outcome: 'depth' };
    }
    if (world.timeMs - floorStart > timeout) {
      close('timeout');
      return { scenario: s, floors, outcome: 'timeout' };
    }
  }
}

/** A whole run of the scenario's dungeon from floor 1 (at most `maxFloors`). */
export const runDungeon = (s: Scenario, options: RunOptions = {}): RunResult => play(s, 1, options, false);

/** One floor in isolation, entered fresh (level 1, no items: `startRun` on that floor). */
export function runFloor(s: Scenario, floor: number, options: RunOptions = {}): FloorResult {
  return play(s, floor, options, true).floors[0]!;
}
