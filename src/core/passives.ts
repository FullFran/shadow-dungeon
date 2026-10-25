import { MOVES, type MoveBonus } from '../data/moves';
import { SPECIES, type PassiveId } from '../data/species';
import { TUNING } from '../data/tuning';
import type { EnemyState, GameEvent, IncomingHit, PlayerState } from './state';
import { dot, length, normalize, sub } from './vec';

/**
 * Starter passives (docs/gdd.md §4, docs/species-candidates.md):
 * Illusion (Zorua) hides the player from sleeping enemies until it hits
 * something or is hurt, and its first hit is critical; Flash Fire (Litwick)
 * absorbs Fire hits and powers up the next heavy move; Battle Armor (Cubone)
 * halves frontal hits while a heavy move charges or winds up. Disguise
 * (Mimikyu) lives in hits.ts. Pure helpers, called from hits, combat and
 * activation.
 */
export const passiveOf = (player: Pick<PlayerState, 'species'>): PassiveId | undefined => SPECIES[player.species].passive;

/** Zorua still wears its Illusion this room. */
export const illusionActive = (player: Pick<PlayerState, 'species' | 'illusionBroken'>): boolean =>
  passiveOf(player) === 'illusion' && !player.illusionBroken;

/** The player's Illusion breaks (no-op without one), with its event. */
export function breakIllusion(player: PlayerState, events: GameEvent[]): PlayerState {
  if (!illusionActive(player)) return player;
  events.push({ type: 'passiveTriggered', passive: 'illusion' });
  return { ...player, illusionBroken: true };
}

/** Under Illusion, a sleeping enemy only notices the player by touch. */
export function touchesUnderIllusion(enemy: Pick<EnemyState, 'radius'>, distanceToPlayer: number): boolean {
  return distanceToPlayer <= enemy.radius + TUNING.player.radius + TUNING.passives.illusionTouchMargin;
}

/** Flash Fire takes this hit: a Fire attack on Litwick. */
export const absorbsFire = (player: PlayerState, hit: IncomingHit): boolean => passiveOf(player) === 'flash-fire' && hit.type === 'fire';

/**
 * Flash Fire also feeds on Litwick's own flames: every Fire hit it lands
 * counts, and the `flashFireKindle`-th powers up the next heavy move (the
 * Crypt has no Fire attacks to absorb). No-op while already powered up.
 */
export function stokeFlashFire(player: PlayerState, moveType: IncomingHit['type'], events: GameEvent[]): PlayerState {
  if (passiveOf(player) !== 'flash-fire' || moveType !== 'fire' || player.flashFire) return player;
  const kindling = (player.kindling ?? 0) + 1;
  if (kindling < TUNING.passives.flashFireKindle) return { ...player, kindling };
  events.push({ type: 'passiveTriggered', passive: 'flash-fire', kindled: true });
  return { ...player, kindling: 0, flashFire: true };
}

/** Battle Armor covers this hit: a heavy move is charging or winding up and the attack comes from the front half. */
export function armorCovers(player: PlayerState, hit: IncomingHit): boolean {
  const action = player.action;
  if (passiveOf(player) !== 'battle-armor' || !action || !hit.from) return false;
  if (MOVES[action.moveId].slot !== 'heavy' || (action.phase !== 'charging' && action.phase !== 'windup')) return false;
  const towards = sub(hit.from, player.pos);
  return length(towards) === 0 || dot(normalize(towards), action.aimDir) > 0;
}

/** Multiplier of a move bonus at the moment of the hit (1 when its condition does not hold). */
export function bonusMultiplier(bonus: MoveBonus | undefined, enemy: EnemyState, player: Pick<PlayerState, 'lastMoveMissed'>): number {
  if (!bonus) return 1;
  const holds =
    bonus.when === 'attacking'
      ? enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack'
      : bonus.when === 'staggered'
        ? enemy.hitstunMs > 0
        : player.lastMoveMissed;
  return holds ? bonus.multiplier : 1;
}
