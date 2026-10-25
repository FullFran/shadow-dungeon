import { atLeast, type Difficulty } from '../data/difficulty';
import { CAVES_TRICKS } from '../data/caves-tricks';
import { ENEMY_BEHAVIOUR, type EnemyDef } from '../data/enemies';
import { FOREST_TRICKS, type Trick } from '../data/forest-tricks';
import { SIMA_TRICKS } from '../data/sima-tricks';
import { SWAMP_TRICKS } from '../data/swamp-tricks';
import { PARTY_TRICKS } from '../data/party-tricks';
import type { SpeciesId } from '../data/species';

/** Every dungeon's trick table; a species' tricks are their concatenation, in this order. */
const TRICK_TABLES: readonly Partial<Record<SpeciesId, readonly Trick[]>>[] = [FOREST_TRICKS, CAVES_TRICKS, SWAMP_TRICKS, SIMA_TRICKS];

/**
 * An enemy's behaviour at a difficulty tier: its data (data/enemies.ts) with
 * the patches of every trick whose `minDifficulty` the tier reaches (one
 * table per dungeon: data/forest-tricks.ts, data/caves-tricks.ts,
 * data/swamp-tricks.ts, data/sima-tricks.ts). Without a trick that applies it is the very same
 * object, so easy plays exactly as shipped. Cached per species and tier.
 */
const cache = new Map<string, EnemyDef | undefined>();

export function behaviourFor(species: SpeciesId, difficulty: Difficulty): EnemyDef | undefined {
  const key = `${species}:${difficulty}`;
  if (cache.has(key)) return cache.get(key);
  const base = ENEMY_BEHAVIOUR[species];
  const tricks = TRICK_TABLES.flatMap((table) => table[species] ?? []).filter((t) => atLeast(difficulty, t.minDifficulty));
  const def = base && tricks.length > 0 ? tricks.reduce<EnemyDef>((d, t) => ({ ...d, ...t.patch }) as EnemyDef, base) : base;
  cache.set(key, def);
  return def;
}

const partyCache = new Map<string, EnemyDef | undefined>();

/**
 * An enemy's behaviour at a tier for a party of `party` players: the tier's
 * (`behaviourFor`) with the party tricks it reaches (data/party-tricks.ts).
 * Without one it is the very same object, so solo plays exactly as before.
 */
export function behaviourAt(species: SpeciesId, difficulty: Difficulty, party: number): EnemyDef | undefined {
  const base = behaviourFor(species, difficulty);
  const tricks = (PARTY_TRICKS[species] ?? []).filter((t) => party >= t.minParty);
  if (!base || tricks.length === 0) return base;
  const key = `${species}:${difficulty}:${tricks.length}`;
  if (partyCache.has(key)) return partyCache.get(key);
  const def = tricks.reduce<EnemyDef>((d, t) => ({ ...d, ...t.patch(d) }) as EnemyDef, base);
  partyCache.set(key, def);
  return def;
}
