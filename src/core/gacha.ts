import { GACHA, GACHA_POOL, type GachaRarity } from '../data/gacha';
import type { SpeciesId } from '../data/species';
import type { Collection } from './collection';
import { lineOf } from './evolution';
import { nextRandom } from './rng';

/**
 * One gacha pull (data/gacha.ts), pure and seeded: the same collection and
 * RNG state give the same pull, so a server can replay or run it later.
 */
export interface PullResult {
  species: SpeciesId;
  rarity: GachaRarity;
  /** Its line was already owned: the Pokémonedas of `refund` came back instead. */
  duplicate: boolean;
  refund: number;
}

/** The pull, the collection after it and the next RNG state; null (nothing changes) without the Pokémonedas. */
export function pull(state: Collection, rng: number): { result: PullResult; state: Collection; rng: number } | null {
  if (state.coins < GACHA.cost) return null;
  const rarityRoll = nextRandom(rng);
  const pickRoll = nextRandom(rarityRoll.state);
  const pity = state.pity ?? 0;
  const rarity: GachaRarity = pity + 1 >= GACHA.hardPity || rarityRoll.value < GACHA.rareRate ? 'rare' : 'common';
  const pool = GACHA_POOL.filter((e) => e.rarity === rarity);
  const species = pool[Math.floor(pickRoll.value * pool.length)]!.species;
  const owned = state.owned ?? [];
  const duplicate = owned.some((id) => lineOf(id) === species);
  const refund = duplicate ? GACHA.duplicateRefund : 0;
  return {
    result: { species, rarity, duplicate, refund },
    state: {
      ...state,
      coins: state.coins - GACHA.cost + refund,
      owned: duplicate ? owned : [...owned, species],
      pity: rarity === 'rare' ? 0 : pity + 1,
    },
    rng: pickRoll.state,
  };
}
