/**
 * Every moving enemy shot definition the game can fire (issue #67): every
 * enemy and card boss on every tier (solo and a full co-op party), every Senda
 * boss, Sima and Shrine heralds, and every Shrine stop. Shared by the tests
 * that walk them (tests/data/enemy-shot-moves.test.ts, tests/adapters/enemy-shot-look.test.ts).
 */
import { SPECIES, type SpeciesId } from '../../src/data/species';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { STORY_FIGHTS } from '../../src/data/story/bosses';
import { behaviourAt, behaviourFor } from '../../src/core/tricks';
import { heraldDef } from '../../src/core/herald/generate';
import { SHRINE_BOSSES, gauntletStops, heraldStop } from '../../src/core/shrine';
import { GAUNTLETS } from '../../src/data/shrine';

export interface FoundShot {
  source: string;
  shot: { type: string; move?: unknown; speed: number; radius: number };
}

/** Every moving shot definition (an object with a type, a speed above 0 and a radius) reachable from `root`. */
function shotsOf(root: unknown, source: string, out: FoundShot[], seen = new Set<unknown>()): FoundShot[] {
  if (!root || typeof root !== 'object' || seen.has(root)) return out;
  seen.add(root);
  const o = root as Record<string, unknown>;
  if (typeof o.speed === 'number' && o.speed > 0 && typeof o.radius === 'number' && typeof o.type === 'string') out.push({ source, shot: o as FoundShot['shot'] });
  for (const v of Object.values(o)) shotsOf(v, source, out, seen);
  return out;
}

/** The boss behind a source: a Senda boss is reached both as `story:<id>` and as the species `<id>`. */
export const bossOf = (source: string): string => source.replace(/^story:/, '');

export function everyShot(): FoundShot[] {
  const out: FoundShot[] = [];
  // Every enemy (regular, card bosses and their cards on every tier, Eclipse echo, evolved line enemies), solo and a full co-op party.
  for (const species of Object.keys(SPECIES) as SpeciesId[]) {
    for (const tier of DIFFICULTIES) {
      shotsOf(behaviourFor(species, tier), species, out);
      shotsOf(behaviourAt(species, tier, 4), species, out);
    }
  }
  // Every Senda boss on every tier.
  for (const [id, tiers] of Object.entries(STORY_FIGHTS)) shotsOf(tiers, `story:${id}`, out);
  // The Sima's heralds (generator output over seeds, depths and tiers) and the Shrine's (its own seeds).
  for (let seed = 1; seed <= 24; seed++) for (const tier of DIFFICULTIES) shotsOf(heraldDef(seed, 10 + seed * 4, tier), 'herald', out);
  for (const seed of [1, 7, 42, 9001]) for (const tier of DIFFICULTIES) shotsOf(heraldDef(heraldStop(seed).heraldSeed!, heraldStop(seed).floor, tier), 'shrine-herald', out);
  // The Shrine's reflections and gauntlets: every stop's boss.
  const stops = [...SHRINE_BOSSES, ...GAUNTLETS.flatMap((g) => gauntletStops(g.id))];
  for (const stop of stops) for (const tier of DIFFICULTIES) shotsOf(behaviourFor(stop.boss, tier), `shrine:${stop.boss}`, out);
  return out;
}
