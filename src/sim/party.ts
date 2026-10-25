import { partyScaling as gamePartyScaling, type PartyScaling } from '../data/party-scaling';
import { isBossClass, partyField, partySizeOf } from '../core/party';
import type { WorldState } from '../core/state';

/**
 * Party size in the balance harness: the ONE place the harness touches co-op
 * scaling (the game's: `data/party-scaling.ts`, `core/party.ts`).
 *
 * Model: a party of `size` is the bot plus `size - 1` teammates that deal the
 * same damage. Each floor is played at the game's party size (`world.party`:
 * enemy HP at spawn, boss damage and stagger, boss aggro and 3+-player cards),
 * and every enemy's HP is then divided by `size` for the teammates' share of
 * the damage. The enemies still go for the bot alone (no teammate draws
 * aggro): a pessimistic stand-in until the harness simulates several peers.
 * Enemies that join later (wave rooms, Sima events) spawn with the game's
 * party HP but without the teammate split.
 */
export const PARTY_SIZES = [1, 2, 3, 4] as const;

export type { PartyScaling };

/** The game's party scaling row for `size` players (clamped to 1–4). */
export const partyScaling = (size: number): PartyScaling => gamePartyScaling(size);

/**
 * A party of `size` on a freshly loaded floor. The game freezes a floor's
 * party from the players present on entry, and the harness has no remote
 * peers, so a floor after the first comes in solo: its enemies are rescaled
 * to the party's spawn HP and `world.party` is set. Solo is unchanged.
 */
export function applyParty(world: WorldState, size: number): WorldState {
  const n = partyScaling(size).players;
  const have = partySizeOf(world);
  if (n === 1 && have === 1) return world;
  const from = partyScaling(have);
  const to = partyScaling(n);
  const enemies = world.enemies.map((e) => {
    const boss = isBossClass(e.species);
    const rescale = (boss ? to.bossHp / from.bossHp : to.enemyHp / from.enemyHp) / n;
    return { ...e, hp: e.hp * rescale, maxHp: e.maxHp * rescale };
  });
  const { party: _old, ...rest } = world;
  return { ...rest, ...partyField(n), enemies };
}
