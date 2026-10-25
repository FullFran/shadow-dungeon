import type { WorldState } from '../core/state';

/**
 * Party size in the balance harness: the ONE place the harness touches co-op
 * scaling, so wiring the core's party helper in is a change to
 * `partyScaling` alone.
 *
 * Model: a party of `size` is the bot plus `size - 1` teammates that deal the
 * same damage, so every enemy's HP is divided by `size` on top of the game's
 * party HP scaling, and enemy damage takes the game's party damage factor.
 * The enemies still go for the bot alone (attention is not shared): a
 * pessimistic stand-in for real co-op until the harness simulates several
 * peers. Enemies that join later (wave rooms, Sima events) keep the game's own
 * scaling only.
 */
export const PARTY_SIZES = [1, 2, 3, 4] as const;

export interface PartyScaling {
  /** Enemy HP factor of an ordinary enemy for this party size (the game's, before the harness's teammate split). */
  enemyHp: number;
  /** Enemy HP factor of a boss or mid-boss. */
  bossHp: number;
  /** Enemy damage factor. */
  damage: number;
}

/**
 * The game's party scaling for `size` players. The game has none yet
 * (docs/souls-difficulty-research.md §0), so it is identity: replace this body
 * with a call to the core's party helper once it lands.
 */
export function partyScaling(size: number): PartyScaling {
  void size;
  return { enemyHp: 1, bossHp: 1, damage: 1 };
}

/** A party of `size` (1 to 4) on a freshly loaded floor: enemy HP and damage as the model above says. Solo is unchanged. */
export function applyParty(world: WorldState, size: number): WorldState {
  const n = Math.min(4, Math.max(1, Math.floor(size)));
  if (n === 1 && isIdentity(partyScaling(1))) return world;
  const s = partyScaling(n);
  const enemies = world.enemies.map((e) => {
    const share = (e.boss ? s.bossHp : s.enemyHp) / n;
    return { ...e, hp: e.hp * share, maxHp: e.maxHp * share };
  });
  const enemyScale = s.damage === 1 ? world.enemyScale : { hp: world.enemyScale?.hp ?? 1, ...world.enemyScale, damage: (world.enemyScale?.damage ?? 1) * s.damage };
  return { ...world, enemies, ...(enemyScale ? { enemyScale } : {}) };
}

const isIdentity = (s: PartyScaling): boolean => s.enemyHp === 1 && s.bossHp === 1 && s.damage === 1;
