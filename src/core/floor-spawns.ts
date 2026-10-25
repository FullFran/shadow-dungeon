import type { Difficulty } from '../data/difficulty';
import type { DungeonDef } from '../data/dungeons';
import { tieredSpawns } from './difficulty';
import { generateFloor, type Floor } from './dungeon';
import { endlessSpawns } from './endless';
import { assignLeaders } from './leaders';
import { simaSquads } from './sima';

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
