import { CHALLENGES, type DungeonDef } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { GACHA_POOL } from '../data/gacha';
import { lineRoot } from '../data/player-evolutions';
import { PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import type { Collection } from './collection';

/**
 * Shiny skins (odd/tasks/shiny-echo.md, docs/gacha-roster-plan.md §5.1),
 * pure: a skin belongs to a line (keyed by its first form), so every form of
 * the line wears it and evolving never loses it. It is cosmetic only: no
 * rule here or anywhere in the simulation reads it, only the sprite choice.
 * A gacha line's skin comes from a shiny pull (core/gacha.ts); a line outside
 * the gacha pool (a starter's) unlocks it by clearing its challenge on
 * Pesadilla. A new skin is worn at once; the player can take it off.
 */

/** Every line with a skin: the first forms of the playable species, in roster order. */
export const SHINY_LINES: readonly SpeciesId[] = PLAYABLE_SPECIES.filter((id) => lineRoot(id) === id);

/** The tier a challenge must be cleared on to unlock its line's skin. */
export const SHINY_CHALLENGE_TIER: Difficulty = 'nightmare';

/** The challenges that unlock a skin: those of the lines the gacha does not sell (the starters'). */
export const shinyChallenges = (challenges: readonly DungeonDef[] = CHALLENGES): DungeonDef[] =>
  challenges.filter((d) => d.challenge !== undefined && !GACHA_POOL.some((p) => lineRoot(p.species) === d.challenge!.line));

/** Whether `species`' line has its skin unlocked. */
export const hasShiny = (c: Pick<Collection, 'shinies'>, species: SpeciesId): boolean => (c.shinies ?? []).includes(lineRoot(species));

/** Whether `species` plays with its line's skin on (unlocked and worn). */
export const wearsShiny = (c: Pick<Collection, 'shinies' | 'shinyWorn'>, species: SpeciesId): boolean => hasShiny(c, species) && (c.shinyWorn ?? []).includes(lineRoot(species));

/** The collection with `species`' line skin unlocked and worn; the same object when it already was unlocked. */
export function unlockShiny<C extends Collection>(c: C, species: SpeciesId): C {
  const line = lineRoot(species);
  if (hasShiny(c, line)) return c;
  return { ...c, shinies: [...(c.shinies ?? []), line], shinyWorn: [...(c.shinyWorn ?? []), line] };
}

/** The collection with `species`' line skin put on or taken off; unchanged when it is not unlocked. */
export function wearShiny<C extends Collection>(c: C, species: SpeciesId, on: boolean): C {
  const line = lineRoot(species);
  if (!hasShiny(c, line) || wearsShiny(c, line) === on) return c;
  const others = (c.shinyWorn ?? []).filter((id) => id !== line);
  return { ...c, shinyWorn: on ? [...others, line] : others };
}

/** The collection after a run: a victory in a skin-giving challenge on Pesadilla unlocks its line's skin. */
export function challengeShiny<C extends Collection>(c: C, dungeon: DungeonDef, victory: boolean, difficulty: Difficulty): C {
  const line = dungeon.challenge?.line;
  if (!victory || line === undefined || difficulty !== SHINY_CHALLENGE_TIER || !shinyChallenges([dungeon]).length) return c;
  return unlockShiny(c, line);
}
