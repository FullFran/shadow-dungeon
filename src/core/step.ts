import { wakeEnemies } from './activation';
import { updateCollapse } from './collapse';
import { updateCombat } from './combat';
import { updateEnemies } from './enemies';
import { updateFlow } from './flow';
import { updateFog } from './fog';
import { updateFlood } from './flood';
import { wadeFactor } from './water';
import { updateGas } from './gas';
import { updateToxic } from './toxic';
import { wormholePull } from './swamp-bosses';
import { NIHILEGO } from '../data/swamp-enemies';
import { landHitOnPlayer } from './hits';
import { pickUpBerries } from './berries';
import { applyRecoil, onTick } from './items';
import { updateLock } from './lockon';
import { updatePlayer } from './player';
import { creditDefeats } from './progression';
import type { GameEvent, IncomingHit, PlayerInput, WorldState } from './state';
import { settleStolen } from './stolen';
import { guestEnemyContacts } from './victim';
import { updateSimaEvent } from './sima-events';
import { endlessSpawns } from './endless';
import { ENDLESS } from '../data/endless';
import { SIMA_EVENTS } from '../data/sima';

export { enemyTimeScale } from './time';

/**
 * Advances the world by one fixed step. Pure: returns a new state and never
 * mutates `state`, so identical (state, input) pairs always give identical
 * results. `dtMs` is real time; enemy-side systems use `enemyTimeScale`.
 * A host (and solo) runs the enemies against every present player; a guest
 * runs only its own player and lands the enemy attacks of the last host
 * snapshot on it (victim side, victim.ts). Held items then act (Rocky
 * Helmet recoil, regen, low-HP heals: items.ts), every peer credits its
 * own player with the enemies seen down (progression.ts) and settles an item
 * Sableye stole from it (stolen.ts).
 */
export function step(state: WorldState, input: PlayerInput, dtMs: number): WorldState {
  const events: GameEvent[] = [];
  // Shallow water and the flood slow a non-Water player's walk (water.ts, flood.ts).
  const wade = wadeFactor(state.player.types, state.arena, state.player.pos, state.flood);
  const walked = pickUpBerries({ ...state, player: updatePlayer(state.player, input, dtMs, state.arena, events, wade) }, events);
  const { player } = walked;
  const lockContext = { playerPos: player.pos, cursor: input.aim, view: input.view, enemies: state.enemies };
  const lock = updateLock(state.lock, { held: input.lock, click: input.click, wheel: input.wheel }, lockContext, events);
  const combat = updateCombat({ ...walked, lock }, input, dtMs, events);
  const enemies =
    state.role === 'guest' ? guestEnemyContacts(combat, events) : simaEventStep(updateEnemies(updateFlow(wakeEnemies(combat)), dtMs, events), dtMs);
  const pulled = wormholePull(enemies, dtMs, NIHILEGO);
  const fought = settleStolen(creditDefeats(onTick(applyRecoil(updateToxic(updateGas(updateFlood(updateFog(updateCollapse(pulled, dtMs, events), dtMs, events), dtMs, events), dtMs, events), dtMs, events), events), dtMs, events), events), dtMs, events);
  return {
    ...fought,
    tick: state.tick + 1,
    timeMs: state.timeMs + dtMs,
    slowMoMs: Math.max(0, fought.slowMoMs - dtMs),
    events,
  };
}

/** Host: the Sima's floor event (sima-events.ts), with the depth's pool for the enemies it brings. */
const simaEventStep = (state: WorldState, dtMs: number): WorldState =>
  state.simaEvent && !state.simaEvent.done ? updateSimaEvent(state, dtMs, SIMA_EVENTS, endlessSpawns(ENDLESS, state.depth).pool) : state;

/** Lands a hit on the player outside a step (enemy systems, tests). Appends to the state's events. */
export function hitPlayer(state: WorldState, hit: IncomingHit): WorldState {
  const events = [...state.events];
  const landed = landHitOnPlayer(state, hit, events);
  return { ...landed.state, events };
}
