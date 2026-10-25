import type { Difficulty } from '../data/difficulty';
import { DIFFICULTIES } from '../data/difficulty';
import { DUNGEONS, type DungeonId } from '../data/dungeons';
import { BOT_KINDS, type BotKind } from './bots';
import { PARTY_SIZES } from './party';
import { arenaFloors, runDungeon, runFloor, type FloorResult, type RunOptions, type RunResult, type Scenario } from './runner';

/** What a sweep covers (docs/gdd.md §9 "Arnés de balance"). */
export interface SweepConfig {
  dungeons: readonly DungeonId[];
  tiers: readonly Difficulty[];
  bots: readonly BotKind[];
  parties: readonly number[];
  seeds: readonly number[];
  /** Floors per run at most (the endless Sima has no last floor). */
  maxFloors: number;
  /** Bots that also play every fixed arena (guardian, mid-boss, echo) in isolation; their parties and seeds are the sweep's. */
  arenaBots: readonly BotKind[];
  options?: RunOptions;
}

export interface ArenaResult {
  scenario: Scenario;
  result: FloorResult;
}

export interface SweepResults {
  config: SweepConfig;
  runs: RunResult[];
  arenas: ArenaResult[];
}

const ALL_DUNGEONS = DUNGEONS.map((d) => d.id);

/** The full sweep of `npm run balance`: every dungeon, tier, bot and party size, three seeds, ten floors of the Sima. */
export const FULL_SWEEP: SweepConfig = {
  dungeons: ALL_DUNGEONS,
  tiers: DIFFICULTIES,
  bots: BOT_KINDS,
  parties: PARTY_SIZES,
  seeds: [1, 2, 3],
  maxFloors: 10,
  arenaBots: BOT_KINDS,
};

/** The CI subset (tests/sim/balance-ci.test.ts): easy and nightmare, three bots, solo, two seeds, the Sima to floor 5. */
export const CI_SWEEP: SweepConfig = {
  dungeons: ALL_DUNGEONS,
  tiers: ['easy', 'nightmare'],
  bots: ['perfect', 'average', 'masher'],
  parties: [1],
  seeds: [1, 2],
  maxFloors: 5,
  arenaBots: ['perfect', 'average'],
};

export function runSweep(config: SweepConfig): SweepResults {
  const runs: RunResult[] = [];
  const arenas: ArenaResult[] = [];
  const options = { maxFloors: config.maxFloors, ...config.options };
  for (const dungeon of config.dungeons)
    for (const tier of config.tiers)
      for (const party of config.parties)
        for (const seed of config.seeds) {
          for (const bot of config.bots) runs.push(runDungeon({ dungeon, tier, bot, party, seed }, options));
          for (const bot of config.arenaBots)
            for (const floor of arenaFloors(dungeon, config.maxFloors)) {
              const scenario = { dungeon, tier, bot, party, seed };
              arenas.push({ scenario, result: runFloor(scenario, floor, options) });
            }
        }
  return { config, runs, arenas };
}
