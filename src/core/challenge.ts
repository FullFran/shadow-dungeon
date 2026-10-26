import { CHALLENGES, type DungeonDef } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import type { SpeciesId } from '../data/species';
import type { Collection } from './collection';
import { lineOf } from './evolution';

/**
 * Challenge dungeons (odd/tasks/gacha-evolutions.md T4), pure: one opens
 * while the player owns any form of its line, and a victory there pays the
 * line's materials into the collection (keyed by the line's first form), of
 * the tier of the run's difficulty: Normal, Difícil or Pesadilla (Fácil pays
 * none; user decision 2026-10-26).
 * In co-op every peer runs this on its own save, so only the peers who own
 * the line are paid.
 */
export const challengeOpen = (dungeon: DungeonDef, owned: readonly SpeciesId[]): boolean =>
  dungeon.challenge !== undefined && owned.some((id) => lineOf(id) === dungeon.challenge!.line);

/** The challenges open to a player who owns `owned`, in list order. */
export const openChallenges = (owned: readonly SpeciesId[], challenges: readonly DungeonDef[] = CHALLENGES): DungeonDef[] =>
  challenges.filter((d) => challengeOpen(d, owned));

/** The collection after a run in `dungeon` on `difficulty`: unchanged unless it is an owned line's challenge, won above Easy. */
export function challengeReward<C extends Collection>(collection: C, dungeon: DungeonDef, victory: boolean, difficulty: Difficulty): C {
  const reward = dungeon.challenge;
  if (!victory || !reward || difficulty === 'easy' || !challengeOpen(dungeon, collection.owned ?? [])) return collection;
  const have = collection.materials?.[reward.line] ?? {};
  return { ...collection, materials: { ...collection.materials, [reward.line]: { ...have, [difficulty]: (have[difficulty] ?? 0) + reward.materials } } };
}
