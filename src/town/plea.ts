import { CRYPT } from '../data/dungeons';
import { PLEA_STAGE, SIMA_PLEA, type PleaActor } from '../data/sima-plea';
import type { Vec2 } from '../core/vec';

/**
 * The villagers' pleas as a little scripted scene (data/sima-plea.ts), pure:
 * the villagers are already gathered on the rim; one at a time steps forward
 * from its place in the crowd, speaks (the town's dialog box), and steps back;
 * then the next (odd/tasks/menu-redesign.md S6: no dead walks, one thread).
 * After the last one the player answers (`choose`), and the scene ends. The
 * town scene draws it and opens the dialogs; this file only moves the actors.
 */
export type PleaPhase = 'walk' | 'talk' | 'aside' | 'choose' | 'done';

export interface PleaState {
  /** The actor now coming, talking or stepping aside. */
  index: number;
  phase: PleaPhase;
  /** Where the current actor stands (world px). */
  pos: Vec2;
}

/** Walking pace of the villagers (px per second). */
export const PLEA_SPEED = 110;

/** Where actor `index` stands in the crowd (world px). */
const crowdSpot = (index: number, tile: number): Vec2 => {
  const spot = PLEA_STAGE.crowd[index % PLEA_STAGE.crowd.length]!;
  return { x: spot.x * tile, y: spot.y * tile };
};

export const startPlea = (tile: number): PleaState => ({ index: 0, phase: 'walk', pos: crowdSpot(0, tile) });

/** Where the current actor is heading in its phase. */
export function pleaTarget(state: PleaState, tile: number): Vec2 {
  if (state.phase === 'aside') return crowdSpot(state.index, tile);
  return { x: PLEA_STAGE.speak.x * tile, y: PLEA_STAGE.speak.y * tile };
}

/** The actor of the scene now (null once done). */
export const pleaActor = (state: PleaState, actors: readonly PleaActor[] = SIMA_PLEA): PleaActor | null => (state.phase === 'done' || state.phase === 'choose' ? null : (actors[state.index] ?? null));

/** `dtMs` more of the scene: the actor walks; arriving at the speaking spot it talks (the caller opens the dialog); arriving at its place, the next one comes. */
export function stepPlea(state: PleaState, dtMs: number, tile: number, actors: readonly PleaActor[] = SIMA_PLEA): PleaState {
  if (state.phase === 'talk' || state.phase === 'choose' || state.phase === 'done') return state;
  const target = pleaTarget(state, tile);
  const dx = target.x - state.pos.x;
  const dy = target.y - state.pos.y;
  const dist = Math.hypot(dx, dy);
  const stride = (PLEA_SPEED * dtMs) / 1000;
  if (dist > stride) return { ...state, pos: { x: state.pos.x + (dx / dist) * stride, y: state.pos.y + (dy / dist) * stride } };
  if (state.phase === 'walk') return { ...state, phase: 'talk', pos: target };
  const next = state.index + 1;
  // After the last villager the player answers; otherwise the next one steps forward from its own place.
  return next >= actors.length ? { index: next, phase: 'choose', pos: target } : { index: next, phase: 'walk', pos: crowdSpot(next, tile) };
}

/** The actor finished speaking: it steps aside. */
export const pleaSpoken = (state: PleaState): PleaState => (state.phase === 'talk' ? { ...state, phase: 'aside' } : state);

/** The player answered (data/sima-plea.ts `PLEA_ANSWERS`): the scene is over. */
export const pleaAnswered = (state: PleaState): PleaState => (state.phase === 'choose' ? { ...state, phase: 'done' } : state);

/** The villagers already standing in the crowd (each at its place). */
export function pleaCrowd(state: PleaState, tile: number, actors: readonly PleaActor[] = SIMA_PLEA): { actor: PleaActor; pos: Vec2 }[] {
  // Everyone stands in the crowd from the start; the one stepping forward is drawn on its own (`pleaActor`).
  const out = state.phase === 'choose' || state.phase === 'done' ? actors : actors.filter((_, i) => i !== state.index);
  return out.map((actor) => ({ actor, pos: crowdSpot(actors.indexOf(actor), tile) }));
}

/**
 * Whether the town plays the pleas the moment it opens (owner, 2026-10-27:
 * every player who has not seen them must, or they miss them): alone, while
 * they are due, once `ready`, and not under a development start window.
 * Heading for the Sima still checks them too (a room plays none: they wait
 * for a solo visit).
 */
export const pleaOnArrival = (o: { inRoom: boolean; startWindow: boolean; due: boolean; ready: boolean }): boolean => !o.inRoom && !o.startWindow && o.due && o.ready;

/**
 * Whether the pleas may play on arrival (owner, 2026-10-28): only once the
 * Crypt, the first dungeon, is cleared. Right after the prologue and the
 * quiz the player has not met the Sima Walkers nor its shadow, which the
 * villagers speak of. `cleared` is the records' cleared dungeons
 * (`clearedDungeons`, which counts an old victory without the flag).
 */
export const pleaReady = (cleared: ReadonlySet<string>): boolean => cleared.has(CRYPT.id);
