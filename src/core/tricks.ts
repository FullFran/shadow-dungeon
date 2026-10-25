import { atLeast, type Difficulty } from '../data/difficulty';
import type { DifficultyTrick, EnemyDef } from '../data/enemies';

/**
 * Difficulty tricks (docs/gdd.md §9): an enemy definition may list changes
 * that only apply from a tier on (`minDifficulty`, read with `atLeast`): an
 * extra cut, a longer burst, a splash, an extra spell card. Easy is the
 * definition as written; every trick whose tier is reached is laid over it in
 * order. The same definition object comes back when nothing applies, and the
 * merged one is cached per tier, so the brains can call this every step.
 */
const cache = new WeakMap<object, Map<Difficulty, object>>();

export function withTricks<D extends { tricks?: readonly DifficultyTrick<D>[] }>(def: D, difficulty: Difficulty): D {
  const tricks = def.tricks;
  if (!tricks || tricks.length === 0) return def;
  const active = tricks.filter((trick) => atLeast(difficulty, trick.minDifficulty));
  if (active.length === 0) return def;
  let byTier = cache.get(def);
  if (!byTier) {
    byTier = new Map();
    cache.set(def, byTier);
  }
  const cached = byTier.get(difficulty);
  if (cached) return cached as D;
  const merged = active.reduce<D>((acc, trick) => ({ ...acc, ...trick.set }), def);
  byTier.set(difficulty, merged);
  return merged;
}

/** Any enemy definition with the tricks of `difficulty` laid over it (the brains' entry point). */
export const trickedDef = (def: EnemyDef, difficulty: Difficulty): EnemyDef =>
  'tricks' in def && def.tricks ? (withTricks(def as { tricks?: readonly DifficultyTrick<never>[] }, difficulty) as EnemyDef) : def;
