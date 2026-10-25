import { updateCombat } from './combat';
import { landHitOnPlayer } from './hits';
import { updateLock } from './lockon';
import { updatePlayer } from './player';
import type { GameEvent, IncomingHit, PlayerInput, WorldState } from './state';

export { enemyTimeScale } from './time';

/**
 * Advances the world by one fixed step. Pure: returns a new state and never
 * mutates `state`, so identical (state, input) pairs always give identical
 * results. `dtMs` is real time; enemy-side systems use `enemyTimeScale`.
 */
export function step(state: WorldState, input: PlayerInput, dtMs: number): WorldState {
  const events: GameEvent[] = [];
  const player = updatePlayer(state.player, input, dtMs, state.arena, events);
  const lockContext = { playerPos: player.pos, cursor: input.aim, view: input.view, enemies: state.enemies };
  const lock = updateLock(state.lock, { held: input.lock, wheel: input.wheel }, lockContext, events);
  const fought = updateCombat({ ...state, player, lock }, input, dtMs, events);
  return {
    ...fought,
    tick: state.tick + 1,
    timeMs: state.timeMs + dtMs,
    slowMoMs: Math.max(0, fought.slowMoMs - dtMs),
    events,
  };
}

/** Lands a hit on the player outside a step (enemy systems, tests). Appends to the state's events. */
export function hitPlayer(state: WorldState, hit: IncomingHit): WorldState {
  const events = [...state.events];
  const landed = landHitOnPlayer(state, hit, events);
  return { ...landed.state, events };
}
