import { BOSS_AGGRO } from '../data/party-scaling';
import { isBossClass, partySizeOf, presentPlayers, targetOf, type PresentPlayer } from './party';
import type { EnemyState, GameEvent, WorldState } from './state';

/**
 * Boss aggro in a party (docs/gdd.md §8): with `BOSS_AGGRO.aggroFrom` players
 * or more a boss-class enemy keeps one target and changes it every
 * `switchMs` of its own time once it has attacked that target (to the next
 * standing player by id), or at once
 * towards a player who dealt it `pressureShare` of its max HP while it was
 * looking at someone else. A switch never lands mid wind-up or mid attack:
 * the player a telegraph was aimed at is the one it hits (fairness), and a
 * boss only ever winds up one attack at a time. Host only (it runs the enemy
 * AI); solo and smaller parties keep the nearest-player rule (`targetOf`).
 */

const busy = (enemy: EnemyState): boolean => enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack';

/** Whether `enemy` follows the party aggro rule in this world. */
export const followsAggro = (state: WorldState, enemy: EnemyState): boolean => isBossClass(enemy.species) && partySizeOf(state) >= BOSS_AGGRO.aggroFrom;

/** The standing player after `id` in id order (wrapping); the same one when it stands alone. */
function nextAfter(present: readonly PresentPlayer[], id: string): PresentPlayer {
  const sorted = [...present].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.find((p) => p.id > id) ?? sorted[0]!;
}

const fresh = (targetId: string): NonNullable<EnemyState['aggro']> => ({ targetId, heldMs: 0, pressure: 0 });

/**
 * The player `enemy` goes for this tick (`ms` of its own time), and the
 * enemy with its aggro advanced. Pushes `bossAggro` when the target changes.
 */
export function aggroTarget(state: WorldState, enemy: EnemyState, ms: number, events: GameEvent[]): { enemy: EnemyState; target: PresentPlayer } {
  if (!followsAggro(state, enemy)) return { enemy, target: targetOf(state, enemy) };
  const present = presentPlayers(state);
  if (present.length === 0) return { enemy, target: targetOf(state, enemy) };
  const aggro = enemy.aggro;
  const current = aggro ? present.find((p) => p.id === aggro.targetId) : undefined;
  const switchTo = (target: PresentPlayer) => {
    if (target.id !== aggro?.targetId) events.push({ type: 'bossAggro', enemyId: enemy.id, targetId: target.id });
    return { enemy: { ...enemy, aggro: fresh(target.id) }, target };
  };
  // First look, or its target fell or left: the nearest standing player.
  if (!aggro || !current) return switchTo(targetOf(state, enemy));
  // It has swung at its target once it attacks (a timed switch waits for that: everyone it turns to gets attacked).
  const held = { ...aggro, heldMs: aggro.heldMs + ms, ...(enemy.ai.mode === 'attack' ? { swung: true as const } : {}) };
  if (!busy(enemy)) {
    const pressed = held.by !== undefined && held.by !== held.targetId ? present.find((p) => p.id === held.by) : undefined;
    if (pressed && held.pressure >= BOSS_AGGRO.pressureShare * enemy.maxHp) return switchTo(pressed);
    if (held.heldMs >= BOSS_AGGRO.switchMs && held.swung) {
      const next = nextAfter(present, held.targetId);
      return next.id === held.targetId ? { enemy: { ...enemy, aggro: fresh(next.id) }, target: next } : switchTo(next);
    }
  }
  return { enemy: { ...enemy, aggro: held }, target: current };
}

/** `damage` from `playerId` landed on `enemy`: someone it is not looking at builds pressure towards a switch. */
export function noteAggroDamage(enemy: EnemyState, playerId: string, damage: number): EnemyState {
  const aggro = enemy.aggro;
  if (!aggro || damage <= 0 || playerId === aggro.targetId) return enemy;
  const pressure = aggro.by === playerId ? aggro.pressure + damage : damage;
  return { ...enemy, aggro: { ...aggro, pressure, by: playerId } };
}
