import type { Difficulty } from '../data/difficulty';
import { dungeonById, ECLIPSE, type DungeonDef } from '../data/dungeons';
import { FLOOR_SHAPES, type FloorKind, type FloorShape } from '../data/dungeon';
import type { SimaEvents } from '../data/sima';
import { drawnAt, tieredSpawns } from './difficulty';
import { generateFloor, weightAt, type Floor } from './dungeon';
import { endlessSpawns } from './endless';
import { chooseGate } from './gates';
import { assignLeaders } from './leaders';
import { deriveSeed } from './rng';
import { simaSquads } from './sima';
import { simaEventKind, type SimaEventState } from './sima-events';
import type { SpeciesId } from '../data/species';

/**
 * The enemies of a generated floor, before it is loaded: the generator's
 * threat-budget rooms at the tier (core/difficulty.ts), the Sima's mixed
 * squads, and the crowned leaders (core/leaders.ts). One pipeline shared by
 * the run (core/run.ts `enterFloor`) and the one-hit cap's expected level
 * (core/fairness.ts), so the cap's yardstick always follows the real
 * spawn counts, roles and leaders. `seed` is the floor's seed. The floor
 * takes the tier's shape (data/dungeon.ts `FLOOR_SHAPES`) unless `shape`
 * says otherwise (the cap's estimate measures Easy's, the reference shape,
 * on every tier); `hall` gives it a wave room's hall (`holdsWaveRoom`; the
 * cap's estimate leaves it out: a hall only reshapes one room).
 */
export function generatedFloor(def: DungeonDef, floor: number, seed: number, tier: Difficulty, hall = false, shape: FloorShape = FLOOR_SHAPES[tier]): Floor {
  const endless = def.endless;
  const drawn = generateFloor(seed, floor, tieredSpawns(endless ? endlessSpawns(endless, floor) : def.spawns, tier), { shape, hall });
  // The Sima: some rooms hold mixed squads (tougher, not more).
  const squads = endless?.squads ? simaSquads(drawn, seed, floor, endless.squads) : drawn;
  // Some groups follow a leader, more of them deeper.
  return assignLeaders(squads, seed, floor, (endless ? endless.spawns : def.spawns).budget?.leaders);
}

/** A dungeon's floor events, if it has them: the Sima's, or its own data. */
export const floorEventRules = (def: DungeonDef): SimaEvents | undefined => def.events ?? def.endless?.events;

/**
 * Whether floor `floor` of a run will hold a wave room: its wave gate (with
 * event rules to run it) or its rolled event (core/run.ts `enterFloor`).
 * Known from the seeds alone, before the floor is generated, so the
 * generator can give it a hall (data/dungeon.ts `WAVE_ROOM`).
 */
export function holdsWaveRoom(def: DungeonDef, runSeed: number, floor: number, kind: FloorKind, tier: Difficulty): boolean {
  const rules = floorEventRules(def);
  if (!rules) return false;
  return chooseGate(runSeed, floor, kind, def.gates) === 'waves' || simaEventKind(deriveSeed(runSeed, floor), floor, kind, rules, tier) === 'waves';
}

/** The rules of an event on the floor: its dungeon's; one that names none is the Sima's. */
export const eventRulesOf = (event: Pick<SimaEventState, 'dungeon'>): SimaEvents => floorEventRules(event.dungeon ? dungeonById(event.dungeon) : ECLIPSE)!;

/** The species an event's own enemies are drawn from at this floor (`weights[0]`, core/sima-events.ts): the depth's pool at the tier, by the dungeon's weights there. */
export function floorEventPool(def: DungeonDef, floor: number, tier: Difficulty): readonly { species: SpeciesId; weights: readonly number[] }[] {
  if (def.endless) return endlessSpawns(def.endless, floor).pool.filter((e) => drawnAt(e, tier));
  return def.spawns.pool.filter((e) => weightAt(e, floor) > 0 && drawnAt(e, tier)).map((e) => ({ species: e.species, weights: [weightAt(e, floor)] }));
}

/**
 * The rare species standing on a freshly loaded floor (a pool entry with
 * `rare`, data/dungeon.ts), or null: the floor cues its arrival on entry
 * (`floor.rare.<species>`). A pure function of the seeded spawns, so every
 * peer of a shared run cues the same one.
 */
export function rareArrival(def: DungeonDef, floor: number, enemies: readonly { species: SpeciesId; alive: boolean }[]): SpeciesId | null {
  const pool = def.endless ? endlessSpawns(def.endless, floor).pool : def.spawns.pool;
  const rare = new Set(pool.filter((e) => e.rare).map((e) => e.species));
  if (rare.size === 0) return null;
  return enemies.find((e) => e.alive && rare.has(e.species))?.species ?? null;
}
