import { GACHA, GACHA_POOL, type GachaRarity } from '../data/gacha';
import type { SpeciesId } from '../data/species';
import type { Collection } from './collection';
import { lineOf } from './evolution';
import { nextRandom } from './rng';
import { unlockShiny } from './shiny';

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
  /** A shiny: its line's skin is unlocked (core/shiny.ts), a duplicate too. */
  shiny: boolean;
}

/** The pull, the collection after it and the next RNG state; null (nothing changes) without the Pokémonedas. */
export function pull(state: Collection, rng: number): { result: PullResult; state: Collection; rng: number } | null {
  if (state.coins < GACHA.cost) return null;
  const rarityRoll = nextRandom(rng);
  const pickRoll = nextRandom(rarityRoll.state);
  // The shiny roll comes after the other two, so the species a seed gives is the same as before shinies.
  const shinyRoll = nextRandom(pickRoll.state);
  const pity = state.pity ?? 0;
  const shinyPity = state.shinyPity ?? 0;
  const shiny = shinyPity + 1 >= GACHA.shinyPity || shinyRoll.value < GACHA.shinyRate;
  const rarity: GachaRarity = pity + 1 >= GACHA.hardPity || rarityRoll.value < GACHA.rareRate ? 'rare' : 'common';
  const pool = GACHA_POOL.filter((e) => e.rarity === rarity);
  const species = pool[Math.floor(pickRoll.value * pool.length)]!.species;
  const owned = state.owned ?? [];
  const duplicate = owned.some((id) => lineOf(id) === species);
  const refund = duplicate ? GACHA.duplicateRefund : 0;
  const next: Collection = {
    ...state,
    coins: state.coins - GACHA.cost + refund,
    owned: duplicate ? owned : [...owned, species],
    pity: rarity === 'rare' ? 0 : pity + 1,
    shinyPity: shiny ? 0 : shinyPity + 1,
  };
  return { result: { species, rarity, duplicate, refund, shiny }, state: shiny ? unlockShiny(next, species) : next, rng: shinyRoll.state };
}
