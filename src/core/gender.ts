import { lineRoot } from '../data/player-evolutions';
import type { SpeciesId } from '../data/species';
import type { Collection } from './collection';

/**
 * Gender (odd/tasks/pokemon-gender.md), pure: like a shiny skin (core/shiny.ts)
 * it belongs to a line (keyed by its first form), so evolving never loses it,
 * and it is cosmetic only: no rule here or anywhere in the simulation reads
 * it, only the sprite choice. A line is male until the player picks otherwise.
 */

/**
 * The species with female art, verified in SpriteCollab (2026-10-30). To add
 * one (Eevee, Combusken and Blaziken once playable, issue #33): an entry here
 * and in `FEMALE_ART` of tools/fetch-sprites.mjs, then its `--only=female`.
 * A form without an entry in a line that has one draws its only sheet.
 */
export const FEMALE_ART: readonly SpeciesId[] = ['shinx', 'luxio', 'luxray'];

/** The lines with a choice, by first form. */
export const FEMALE_LINES: readonly SpeciesId[] = [...new Set(FEMALE_ART.map(lineRoot))];

/** Whether `species` itself has female sheets (its row shows only then). */
export const hasFemaleArt = (species: SpeciesId): boolean => FEMALE_ART.includes(species);

/** Whether `species`' line was picked as female (absent: male). */
export const isFemale = (c: Pick<Collection, 'females'>, species: SpeciesId): boolean => (c.females ?? []).includes(lineRoot(species));

/** The collection with `species`' line picked as female or male; the same object when nothing changes or the line has no female art. */
export function setFemale<C extends Collection>(c: C, species: SpeciesId, female: boolean): C {
  const line = lineRoot(species);
  if (!FEMALE_LINES.includes(line) || isFemale(c, line) === female) return c;
  const others = (c.females ?? []).filter((id) => id !== line);
  return { ...c, females: female ? [...others, line] : others };
}
