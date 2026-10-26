import { PROGRESSION } from '../data/progression';
import { DUNGEONS, ECLIPSE, type DungeonId } from '../data/dungeons';
import { ROOMS } from '../data/rooms';
import { gauntletById, SHRINE, type GauntletId } from '../data/shrine';
import type { SpeciesId } from '../data/species';
import { worldDifficulty } from './difficulty';
import { expectedLevel } from './fairness';
import { devHeraldFloor, withHerald } from './herald/floor';
import { levelMaxHp, MAX_LEVEL } from './progression';
import { partyDefeated } from './party';
import { roomCleared } from './rooms';
import { enterRunFloor, startRun, type RunOutcome, type RunState } from './run';
import type { GameEvent, PlayerState, WorldState } from './state';
import type { WorldOptions } from './world';

/**
 * Santuario de los Juramentos (docs/gdd.md §3), pure: a trial is a list of
 * boss arenas fought in order. Each arena is its dungeon's own fixed room,
 * loaded by the run code on its own floor, so the boss, its tier's cards and
 * the one-hit cap's `referenceLevel` are those of the real fight; the
 * player stands at that floor's expected level (core/fairness.ts) with no
 * items and no shop upgrades. Between two arenas of a gauntlet HP carries
 * over (as a share of max HP) plus `SHRINE.heal`, after `SHRINE.pauseMs`.
 */
export interface BossStop {
  /** The boss: its arena's first spawn (`sima-herald` for a herald). */
  boss: SpeciesId;
  dungeon: DungeonId;
  /** Its arena's floor in the dungeon's plan (a herald: the Sima floor it is fought at). */
  floor: number;
  role: 'midboss' | 'guardian' | 'herald';
  /** A herald's seed (core/herald). */
  heraldSeed?: number;
}

/** Every mid-boss and guardian of the story dungeons, in dungeon order. */
export const SHRINE_BOSSES: readonly BossStop[] = DUNGEONS.filter((d) => !d.endless).flatMap((d) =>
  d.plan.flatMap((plan, i): BossStop[] => {
    if (plan.kind !== 'room' || plan.role === 'echo') return [];
    const boss = ROOMS[plan.room].spawns[0]?.species;
    return boss ? [{ boss, dungeon: d.id, floor: i + 1, role: plan.role === 'midboss' ? 'midboss' : 'guardian' }] : [];
  }),
);

export const bossStop = (boss: string): BossStop | undefined => SHRINE_BOSSES.find((b) => b.boss === boss);

/** Herald `seed` on its Sima floor. */
export const heraldStop = (seed: number): BossStop => ({ boss: 'sima-herald', dungeon: ECLIPSE.id, floor: devHeraldFloor(SHRINE.heraldFloor), role: 'herald', heraldSeed: seed >>> 0 });

export const gauntletStops = (id: GauntletId): BossStop[] => gauntletById(id).bosses.flatMap((boss) => bossStop(boss) ?? []);

export interface TrialState {
  stops: readonly BossStop[];
  /** The arena being fought. */
  index: number;
  /** After an arena falls (not the last): play time left before the next loads; null while fighting. */
  pauseMs: number | null;
}

export interface TrialProgress {
  trial: TrialState;
  run: RunState;
  world: WorldState;
  /** True when this call loaded the next arena. */
  entered: boolean;
  outcome: Exclude<RunOutcome, 'eclipse'> | null;
}

/** `player` at `level` (from its own level): max HP by the level curve, full HP, the level's experience. */
export function atLevel(player: PlayerState, level: number): PlayerState {
  const target = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  if (target === player.level) return player;
  const maxHp = player.maxHp + levelMaxHp(target) - levelMaxHp(player.level);
  return { ...player, level: target, xp: PROGRESSION.levelXp[target - 1] ?? player.xp, maxHp, hp: maxHp };
}

/** The run of one arena: its floor, never urgent, no item offer and no clock. */
const stopRun = (seed: number, stop: BossStop): RunState => ({ seed, dungeon: stop.dungeon, floor: stop.floor, kind: 'normal', escape: null, offer: null });

const levelOf = (stop: BossStop, world: WorldState): number => expectedLevel(stop.dungeon, stop.floor, worldDifficulty(world));

const withStopHerald = (world: WorldState, stop: BossStop): WorldState => (stop.heraldSeed !== undefined ? withHerald(world, stop.heraldSeed, stop.floor) : world);

/** Starts a trial on its first arena. `options` are the run's (the upgrades are dropped: a trial is pure). */
export function startTrial(
  seed: number,
  options: Omit<WorldOptions, 'seed' | 'arena' | 'playerPos'>,
  stops: readonly BossStop[],
): { run: RunState; world: WorldState; trial: TrialState } {
  const first = stops[0];
  if (!first) throw new Error('a trial needs at least one boss');
  const { upgrades: _upgrades, ...pure } = options;
  const started = startRun(seed, pure, first.floor, first.dungeon);
  const run = stopRun(seed, first);
  const world = withStopHerald({ ...started.world, player: atLevel(started.world.player, levelOf(first, started.world)) }, first);
  return { run, world, trial: { stops, index: 0, pauseMs: null } };
}

/** Into the next arena: the HP share carried over at the new level, plus the heal. */
function nextArena(trial: TrialState, run: RunState, world: WorldState): TrialProgress {
  const index = trial.index + 1;
  const stop = trial.stops[index]!;
  const share = world.player.maxHp > 0 ? world.player.hp / world.player.maxHp : 1;
  const raised = atLevel(world.player, levelOf(stop, world));
  const hp = Math.min(raised.maxHp, Math.round((share + SHRINE.heal) * raised.maxHp));
  const nextRun = stopRun(run.seed, stop);
  const loaded = withStopHerald(enterRunFloor({ ...world, player: { ...raised, hp } }, nextRun), stop);
  return { trial: { ...trial, index, pauseMs: null }, run: nextRun, world: loaded, entered: true, outcome: null };
}

/** After a step: defeat, victory (the last arena cleared), the pause, the next arena, or nothing. */
export function progressTrial(trial: TrialState, run: RunState, world: WorldState, dtMs: number): TrialProgress {
  const none = { trial, run, world, entered: false, outcome: null };
  if (partyDefeated(world)) return { ...none, outcome: 'defeat' };
  if (!roomCleared(world)) return none;
  if (trial.index >= trial.stops.length - 1) return { ...none, outcome: 'victory' };
  const left = (trial.pauseMs ?? SHRINE.pauseMs) - dtMs;
  if (left > 0) return { ...none, trial: { ...trial, pauseMs: left } };
  return nextArena(trial, run, world);
}

/** «Sin rasguños»: any hit taken (a hurt, or Mimikyu's disguise broken) spoils it. */
export const trialHurt = (events: readonly GameEvent[]): boolean => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
