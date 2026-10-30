import type { Difficulty } from '../data/difficulty';
import { dungeonById, ECLIPSE, type DungeonDef } from '../data/dungeons';
import type { SimaEvents } from '../data/sima';
import { tieredSpawns } from './difficulty';
import { generateFloor, weightAt, type Floor } from './dungeon';
import { endlessSpawns } from './endless';
import { assignLeaders } from './leaders';
import { simaSquads } from './sima';
import type { SimaEventState } from './sima-events';
import type { SpeciesId } from '../data/species';

/**
 * The enemies of a generated floor, before it is loaded: the generator's
 * threat-budget rooms at the tier (core/difficulty.ts), the Sima's mixed
 * squads, and the crowned leaders (core/leaders.ts). One pipeline shared by
 * the run (core/run.ts `enterFloor`) and the one-hit cap's expected level
 * (core/fairness.ts), so the cap's yardstick always follows the real
 * spawn counts, roles and leaders. `seed` is the floor's seed.
 */
export function generatedFloor(def: DungeonDef, floor: number, seed: number, tier: Difficulty): Floor {
  const endless = def.endless;
  const drawn = generateFloor(seed, floor, tieredSpawns(endless ? endlessSpawns(endless, floor) : def.spawns, tier));
  // The Sima: some rooms hold mixed squads (tougher, not more).
  const squads = endless?.squads ? simaSquads(drawn, seed, floor, endless.squads) : drawn;
  // Some groups follow a leader, more of them deeper.
  return assignLeaders(squads, seed, floor, (endless ? endless.spawns : def.spawns).budget?.leaders);
}

/** A dungeon's floor events, if it has them: the Sima's, or its own data. */
export const floorEventRules = (def: DungeonDef): SimaEvents | undefined => def.events ?? def.endless?.events;

/** The rules of an event on the floor: its dungeon's; one that names none is the Sima's. */
export const eventRulesOf = (event: Pick<SimaEventState, 'dungeon'>): SimaEvents => floorEventRules(event.dungeon ? dungeonById(event.dungeon) : ECLIPSE)!;

/** The species an event's own enemies are drawn from at this floor (`weights[0]`, core/sima-events.ts): the depth's pool, by the dungeon's weights there. */
export function floorEventPool(def: DungeonDef, floor: number): readonly { species: SpeciesId; weights: readonly number[] }[] {
  if (def.endless) return endlessSpawns(def.endless, floor).pool;
  return def.spawns.pool.filter((e) => weightAt(e, floor) > 0).map((e) => ({ species: e.species, weights: [weightAt(e, floor)] }));
}
