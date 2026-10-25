import { TIERS, type Difficulty, type EliteRule } from '../data/difficulty';
import { dungeonById, type TilePalette } from '../data/dungeons';
import { SQUAD_CHANCE, type SimaBand, type SimaElites, type SimaSquad } from '../data/sima';
import type { Floor, FloorSpawn } from './dungeon';
import { deriveSeed, nextRandom } from './rng';

/**
 * Rules of the Sima del Eclipse remaster (docs/gdd.md §3), pure: its depth
 * bands, its elites and mixed squads (tougher, not more); floor events,
 * pacts and the Eclipse Echo's volleys live beside them.
 */

/** Index of the band a floor belongs to: the last one whose `fromFloor` is reached. */
export function simaBandIndex(bands: readonly SimaBand[], floor: number): number {
  let index = 0;
  bands.forEach((band, i) => {
    if (floor >= band.fromFloor) index = i;
  });
  return index;
}

export const simaBandAt = (bands: readonly SimaBand[], floor: number): SimaBand => bands[simaBandIndex(bands, floor)]!;

/** True on the first floor of a new band (floor 1 opens with the dungeon's own title instead). */
export const bandStartsAt = (bands: readonly SimaBand[], floor: number): boolean => floor > 1 && simaBandIndex(bands, floor) !== simaBandIndex(bands, floor - 1);

/** The floor card's lore line: the band's lines in turn from its first floor. */
export function bandLoreKey(bands: readonly SimaBand[], floor: number): string | undefined {
  const band = simaBandAt(bands, floor);
  if (band.loreKeys.length === 0) return undefined;
  return band.loreKeys[Math.max(0, floor - band.fromFloor) % band.loreKeys.length];
}

/** The colours of a band: a dungeon's palette, or its own. */
export const simaPalette = (band: SimaBand): TilePalette => (typeof band.palette === 'string' ? dungeonById(band.palette).palette : band.palette);

/** A seeded stream of draws in [0, 1). */
export function draws(seed: number): () => number {
  let state = seed;
  return () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
}

/** `start` from `fromFloor`, + `perFloor` per deeper floor, at most `max`; 0 before. */
export const rising = (rule: { fromFloor: number; start: number; perFloor: number; max: number }, floor: number): number =>
  floor < rule.fromFloor ? 0 : Math.min(rule.max, rule.start + rule.perFloor * (floor - rule.fromFloor));

// Tougher, not more: elites and mixed squads (data/sima.ts).

const SQUAD_SALT = 0x5c0ad;

/** The Sima's depth ramp: chance that an enemy of this floor is an elite (before the tier's own chance). */
export const eliteChance = (elites: SimaElites, floor: number): number => rising(elites, floor);

/**
 * The elite rule of a Sima floor (the one elite system, core/difficulty.ts
 * `drawElite`): the chance is the larger of the run tier's and the depth
 * ramp's (decision at integration: the tier is a floor under the ramp, so
 * Nightmare's 30 % holds from floor 1 and depth still climbs to 40 %; adding
 * them would put most deep enemies in elite colours). Every Sima elite draws
 * from the Sima's six traits and gets its HP bonus; from the abyss some
 * strike positionally.
 */
export function eliteRuleAt(elites: SimaElites, floor: number, d: Difficulty): EliteRule {
  return {
    chance: Math.max(TIERS[d].eliteChance, eliteChance(elites, floor)),
    traits: elites.traits,
    hpScale: elites.hpScale,
    pierceRollChance: floor >= elites.pierceRoll.fromFloor ? elites.pierceRoll.chance : 0,
  };
}

/** Rooms of a generated floor that hold a mixed squad instead of their draw (never more enemies than they had). */
export function simaSquads(floor: Floor, seed: number, depth: number, squads: readonly SimaSquad[]): Floor {
  const chance = rising(SQUAD_CHANCE, depth);
  const open = squads.filter((s) => s.minDepth <= depth);
  if (chance <= 0 || open.length === 0) return floor;
  const draw = draws(deriveSeed(seed, depth + SQUAD_SALT));
  const rooms = [...new Set(floor.spawns.map((s) => s.room))].sort((a, b) => a - b);
  let spawns: FloorSpawn[] = [...floor.spawns];
  for (const room of rooms) {
    const here = spawns.filter((s) => s.room === room);
    const roll = draw();
    const pick = draw();
    if (here.length < 2 || roll >= chance) continue;
    const fitting = open.filter((s) => s.members.length <= here.length);
    if (fitting.length === 0) continue;
    const squad = fitting[Math.min(fitting.length - 1, Math.floor(pick * fitting.length))]!;
    const placed = squad.members.map((species, i) => ({ ...here[i]!, species }));
    spawns = [...spawns.filter((s) => s.room !== room), ...placed];
  }
  return { ...floor, spawns };
}
