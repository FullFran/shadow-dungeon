import { atLeast, type Difficulty } from '../data/difficulty';
import { ENEMY_BEHAVIOUR, type EnemyDef } from '../data/enemies';
import { FOREST_TRICKS } from '../data/forest-tricks';
import type { SpeciesId } from '../data/species';

/**
 * An enemy's behaviour at a difficulty tier: its data (data/enemies.ts) with
 * the patches of every trick whose `minDifficulty` the tier reaches
 * (data/forest-tricks.ts). Without a trick that applies it is the very same
 * object, so easy plays exactly as shipped. Cached per species and tier.
 */
const cache = new Map<string, EnemyDef | undefined>();

export function behaviourFor(species: SpeciesId, difficulty: Difficulty): EnemyDef | undefined {
  const key = `${species}:${difficulty}`;
  if (cache.has(key)) return cache.get(key);
  const base = ENEMY_BEHAVIOUR[species];
  const tricks = (FOREST_TRICKS[species] ?? []).filter((t) => atLeast(difficulty, t.minDifficulty));
  const def = base && tricks.length > 0 ? tricks.reduce<EnemyDef>((d, t) => ({ ...d, ...t.patch }) as EnemyDef, base) : base;
  cache.set(key, def);
  return def;
}
