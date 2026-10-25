import { SPECIES } from '../data/species';
import { TUNING } from '../data/tuning';
import { classifyHit } from './player';
import type { GameEvent, IncomingHit, WorldState } from './state';

const PERFECT = TUNING.perfectDodge;

export type LandedOutcome = 'hurt' | 'absorbed' | 'dodged' | 'perfectDodge';

/**
 * Lands a hit on the player, pushing events into `events`. I-frames turn it
 * into a dodge (perfect right after they start: slow-mo + next-hit buff);
 * otherwise Disguise absorbs the first damaging hit of the room.
 */
export function landHitOnPlayer(
  state: WorldState,
  hit: IncomingHit,
  events: GameEvent[],
): { state: WorldState; outcome: LandedOutcome } {
  const { player } = state;
  const outcome = classifyHit(player, hit);
  if (outcome === 'dodged') {
    events.push({ type: 'hitDodged' });
    return { state, outcome };
  }
  if (outcome === 'perfectDodge') {
    events.push({ type: 'perfectDodge' });
    return {
      outcome,
      state: {
        ...state,
        slowMoMs: PERFECT.slowMoDurationMs,
        player: { ...player, nextHitBuff: { multiplier: PERFECT.damageMultiplier, remainingMs: PERFECT.buffDurationMs } },
      },
    };
  }
  if (hit.damage > 0 && SPECIES[player.species].passive === 'disguise' && !player.disguiseBroken) {
    events.push({ type: 'disguiseBroken' });
    return { outcome: 'absorbed', state: { ...state, player: { ...player, disguiseBroken: true } } };
  }
  events.push({ type: 'playerHurt', damage: hit.damage });
  return { outcome: 'hurt', state: { ...state, player: { ...player, hp: Math.max(0, player.hp - hit.damage) } } };
}
