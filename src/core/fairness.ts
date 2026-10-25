import { MAX_HIT_SHARE, type Difficulty } from '../data/difficulty';
import { dungeonById, floorsOf, planAt, type DungeonId } from '../data/dungeons';
import { PROGRESSION } from '../data/progression';
import { ROOMS } from '../data/rooms';
import { SPECIES, type SpeciesId } from '../data/species';
import { tieredSpawns } from './difficulty';
import { generateFloor } from './dungeon';
import { endlessSpawns } from './endless';
import { levelForXp, MAX_LEVEL } from './progression';
import { deriveSeed } from './rng';

/**
 * The one-hit cap's yardstick (docs/souls-difficulty-research.md P5.6, user
 * design 2026-10-25): not the victim's own max HP (an under-levelled player
 * must be punishable, even one-shot), but the max HP a player of the
 * expected level would have on this floor. Pure functions of the data:
 * every peer computes the same numbers without sending anything.
 *
 * - The expected level on floor F is the level reached with the experience of
 *   every enemy of floors 1..F-1 (the player is assumed to clear each floor),
 *   without items or upgrades (no Insight).
 * - A generated floor's experience is the mean over `REFERENCE_SEEDS` seeds
 *   of its generated enemies; a fixed room's is its spawn list. Set-piece
 *   extras (Sima events, a boss's adds) are left out: the estimate errs low,
 *   so the cap errs protective.
 */
const REFERENCE_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const xpOf = (species: SpeciesId, floor: number): number => (PROGRESSION.xpBySpecies[species] ?? 0) * (1 + PROGRESSION.xpPerDepth * Math.max(0, floor - 1));

/** The experience of clearing floor `floor` of `dungeon` at tier `d` (mean over the reference seeds on generated floors). */
export function expectedFloorXp(dungeon: DungeonId, floor: number, d: Difficulty): number {
  const def = dungeonById(dungeon);
  const plan = planAt(def, floor);
  if (!plan) return 0;
  if (plan.kind === 'room') return ROOMS[plan.room].spawns.reduce((sum, s) => sum + xpOf(s.species, floor), 0);
  const tuning = tieredSpawns(def.endless ? endlessSpawns(def.endless, floor) : def.spawns, d);
  let total = 0;
  for (const seed of REFERENCE_SEEDS) total += generateFloor(deriveSeed(seed, floor), floor, tuning).spawns.reduce((sum, s) => sum + xpOf(s.species, floor), 0);
  return total / REFERENCE_SEEDS.length;
}

/** Memo per dungeon and tier: the expected level of each floor so far (index 0 is floor 1) and the experience up to the last one. */
const levels = new Map<string, { byFloor: number[]; xp: number }>();

/** The level a player who cleared every floor before `floor` would have on it (1 on floor 1; capped). */
export function expectedLevel(dungeon: DungeonId, floor: number, d: Difficulty): number {
  const key = `${dungeon}/${d}`;
  const memo = levels.get(key) ?? { byFloor: [1], xp: 0 };
  levels.set(key, memo);
  const def = dungeonById(dungeon);
  const last = def.endless ? Number.POSITIVE_INFINITY : floorsOf(def);
  const target = Math.max(1, Math.min(Math.floor(floor), last));
  while (memo.byFloor.length < target) {
    const reached = memo.byFloor[memo.byFloor.length - 1]!;
    if (reached < MAX_LEVEL) memo.xp += expectedFloorXp(dungeon, memo.byFloor.length, d);
    memo.byFloor.push(reached < MAX_LEVEL ? levelForXp(memo.xp) : MAX_LEVEL);
  }
  return memo.byFloor[target - 1]!;
}

/** Max HP of `species` at `level`: its base plus the level curve, no items or upgrades. */
export const speciesMaxHpAt = (species: SpeciesId, level: number): number => SPECIES[species].maxHp + PROGRESSION.hpPerLevel * (Math.max(1, level) - 1);

/** The reference max HP of the one-hit cap: `species` at the expected level of `floor` of `dungeon` at tier `d`. */
export const referenceMaxHp = (dungeon: DungeonId, floor: number, d: Difficulty, species: SpeciesId): number => speciesMaxHpAt(species, expectedLevel(dungeon, floor, d));

/** The most one enemy hit may deal against a reference max HP of `referenceHp` (never under 1). */
export const hitCap = (referenceHp: number): number => Math.max(1, Math.floor(referenceHp * MAX_HIT_SHARE));
