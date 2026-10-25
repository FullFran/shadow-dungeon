import { TUNING } from '../data/tuning';
import { classifyHit, updatePlayer } from './player';
import type { GameEvent, IncomingHit, PlayerInput, WorldState } from './state';

const PERFECT = TUNING.perfectDodge;

/**
 * Advances the world by one fixed step. Pure: returns a new state and never
 * mutates `state`, so identical (state, input) pairs always give identical
 * results. `dtMs` is real time; enemy-side systems use `enemyTimeScale`.
 */
export function step(state: WorldState, input: PlayerInput, dtMs: number): WorldState {
  const events: GameEvent[] = [];
  const player = updatePlayer(state.player, input, dtMs, state.arena, events);
  return {
    ...state,
    tick: state.tick + 1,
    timeMs: state.timeMs + dtMs,
    player,
    slowMoMs: Math.max(0, state.slowMoMs - dtMs),
    events,
  };
}

/**
 * Lands a hit on the player. I-frames turn it into a dodge; a dodge right
 * after the i-frames started is perfect and grants slow-mo plus a damage buff.
 */
export function hitPlayer(state: WorldState, hit: IncomingHit): WorldState {
  const outcome = classifyHit(state.player, hit);
  if (outcome === 'dodged') return { ...state, events: [...state.events, { type: 'hitDodged' }] };
  if (outcome === 'perfectDodge') {
    return {
      ...state,
      slowMoMs: PERFECT.slowMoDurationMs,
      player: {
        ...state.player,
        nextHitBuff: { multiplier: PERFECT.damageMultiplier, remainingMs: PERFECT.buffDurationMs },
      },
      events: [...state.events, { type: 'perfectDodge' }],
    };
  }
  const hp = Math.max(0, state.player.hp - hit.damage);
  return {
    ...state,
    player: { ...state.player, hp },
    events: [...state.events, { type: 'playerHurt', damage: hit.damage }],
  };
}

/** Time scale for enemies and their projectiles: slowed during perfect-dodge slow-mo. */
export function enemyTimeScale(state: WorldState): number {
  return state.slowMoMs > 0 ? PERFECT.slowMoScale : 1;
}
