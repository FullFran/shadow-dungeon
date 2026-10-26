import { CHALLENGES, type DungeonDef } from '../data/dungeons';
import type { Difficulty } from '../data/difficulty';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { POKEMON_TYPES, TYPE_CHART, type PokemonType } from '../data/types';
import { behaviourFor } from './tricks';
import { fightOf } from './cards';
import { rosterOf, type Collection } from './collection';
import { lineOf } from './evolution';

/**
 * Challenge dungeons (odd/tasks/gacha-evolutions.md T4,
 * odd/tasks/roster-parity.md), pure: one opens while the player has any form
 * of its line (a starter's always), only forms of that line may play it, and
 * a victory there pays the line's materials into the collection (keyed by the
 * line's first form), of the tier of the run's difficulty: Normal, Difícil or
 * Pesadilla (Fácil pays none; user decision 2026-10-26).
 * In co-op every peer runs this on its own save, so only the peers who have
 * the line are paid.
 */
export const challengeOpen = (dungeon: DungeonDef, owned: readonly SpeciesId[]): boolean =>
  dungeon.challenge !== undefined && rosterOf({ owned }).some((id) => lineOf(id) === dungeon.challenge!.line);

/** The challenges open to a player who owns `owned`, in list order. */
export const openChallenges = (owned: readonly SpeciesId[], challenges: readonly DungeonDef[] = CHALLENGES): DungeonDef[] =>
  challenges.filter((d) => challengeOpen(d, owned));

/**
 * Who cannot play `dungeon`: the positions in `party` (the species each
 * participant plays) of the species outside its line. Empty when all fit,
 * and always for a main dungeon (anyone plays those).
 */
export function challengeMisfits(dungeon: DungeonDef, party: readonly SpeciesId[]): number[] {
  const line = dungeon.challenge?.line;
  return line === undefined ? [] : party.flatMap((species, i) => (lineOf(species) === line ? [] : [i]));
}

/** The collection after a run in `dungeon` on `difficulty`: unchanged unless it is an owned line's challenge, won above Easy. */
export function challengeReward<C extends Collection>(collection: C, dungeon: DungeonDef, victory: boolean, difficulty: Difficulty): C {
  const reward = dungeon.challenge;
  if (!victory || !reward || difficulty === 'easy' || !challengeOpen(dungeon, collection.owned ?? [])) return collection;
  const have = collection.materials?.[reward.line] ?? {};
  return { ...collection, materials: { ...collection.materials, [reward.line]: { ...have, [difficulty]: (have[difficulty] ?? 0) + reward.materials } } };
}

/**
 * Whether what a challenge sends can hurt its line (owner playtest
 * 2026-10-26: Litwick's Flash Fire made fire-only enemies harmless). Every
 * attack of a species at a tier is found by reading its behaviour data for
 * anything with a `power` and a `type` (melee, shots, patterns, spell cards
 * alike), so a new enemy kind needs no list here.
 */
export function attackTypesOf(species: SpeciesId, difficulty: Difficulty): Set<PokemonType> {
  const out = new Set<PokemonType>();
  const seen = new Set<unknown>();
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    const record = node as Record<string, unknown>;
    if (typeof record.power === 'number' && record.power > 0 && typeof record.type === 'string' && (POKEMON_TYPES as readonly string[]).includes(record.type)) out.add(record.type as PokemonType);
    for (const value of Object.values(record)) visit(value);
  };
  // A fight of authored cards plays only them (its old kit is never used); a hosted fight plays the boss's own moves.
  const def = behaviourFor(species, difficulty);
  const fight = fightOf(def);
  visit(fight && fight.cards.every((c) => !c.moves?.length) ? fight : def);
  return out;
}

/** Whether a hit of `type` hurts `defender` at all (not immune by type, not absorbed by its passive: Flash Fire takes fire). */
export function typeHurts(type: PokemonType, defender: SpeciesId): boolean {
  const def = SPECIES[defender];
  if (def.passive === 'flash-fire' && type === 'fire') return false;
  return def.types.reduce((m, t) => m * (TYPE_CHART[type][t] ?? 1), 1) > 0;
}

/** Whether `species` at `difficulty` has an attack that hurts every form of `line`. */
export function canHurtLine(species: SpeciesId, line: SpeciesId, difficulty: Difficulty): boolean {
  const forms = PLAYABLE_SPECIES.filter((id) => lineOf(id) === line);
  const types = [...attackTypesOf(species, difficulty)];
  return forms.every((form) => types.some((type) => typeHurts(type, form)));
}
