import { PLEA_STAGE, SIMA_PLEA, type PleaActor } from '../data/sima-plea';
import type { Vec2 } from '../core/vec';

/**
 * The villagers' pleas as a little scripted scene (data/sima-plea.ts), pure:
 * one villager at a time walks up the path to the player, speaks (the town's
 * dialog box, with its portrait), and steps aside to its place in the crowd;
 * then the next. The town scene draws it and opens the dialogs; this file
 * only moves the actors.
 */
export type PleaPhase = 'walk' | 'talk' | 'aside' | 'done';

export interface PleaState {
  /** The actor now coming, talking or stepping aside. */
  index: number;
  phase: PleaPhase;
  /** Where the current actor stands (world px). */
  pos: Vec2;
}

/** Walking pace of the villagers (px per second). */
export const PLEA_SPEED = 70;

export const startPlea = (tile: number): PleaState => ({ index: 0, phase: 'walk', pos: { x: PLEA_STAGE.enter.x * tile, y: PLEA_STAGE.enter.y * tile } });

/** Where the current actor is heading in its phase. */
export function pleaTarget(state: PleaState, tile: number): Vec2 {
  const spot = state.phase === 'aside' ? PLEA_STAGE.crowd[state.index % PLEA_STAGE.crowd.length]! : PLEA_STAGE.speak;
  return { x: spot.x * tile, y: spot.y * tile };
}

/** The actor of the scene now (null once done). */
export const pleaActor = (state: PleaState, actors: readonly PleaActor[] = SIMA_PLEA): PleaActor | null => (state.phase === 'done' ? null : (actors[state.index] ?? null));

/** `dtMs` more of the scene: the actor walks; arriving at the speaking spot it talks (the caller opens the dialog); arriving at its place, the next one comes. */
export function stepPlea(state: PleaState, dtMs: number, tile: number, actors: readonly PleaActor[] = SIMA_PLEA): PleaState {
  if (state.phase === 'talk' || state.phase === 'done') return state;
  const target = pleaTarget(state, tile);
  const dx = target.x - state.pos.x;
  const dy = target.y - state.pos.y;
  const dist = Math.hypot(dx, dy);
  const stride = (PLEA_SPEED * dtMs) / 1000;
  if (dist > stride) return { ...state, pos: { x: state.pos.x + (dx / dist) * stride, y: state.pos.y + (dy / dist) * stride } };
  if (state.phase === 'walk') return { ...state, phase: 'talk', pos: target };
  const next = state.index + 1;
  return next >= actors.length ? { index: next, phase: 'done', pos: target } : { index: next, phase: 'walk', pos: { x: PLEA_STAGE.enter.x * tile, y: PLEA_STAGE.enter.y * tile } };
}

/** The actor finished speaking: it steps aside. */
export const pleaSpoken = (state: PleaState): PleaState => (state.phase === 'talk' ? { ...state, phase: 'aside' } : state);

/** The villagers already standing in the crowd (each at its place). */
export function pleaCrowd(state: PleaState, tile: number, actors: readonly PleaActor[] = SIMA_PLEA): { actor: PleaActor; pos: Vec2 }[] {
  return actors.slice(0, Math.min(state.index, actors.length)).map((actor, i) => {
    const spot = PLEA_STAGE.crowd[i % PLEA_STAGE.crowd.length]!;
    return { actor, pos: { x: spot.x * tile, y: spot.y * tile } };
  });
}

/**
 * Whether the town plays the pleas the moment it opens (owner, 2026-10-27:
 * every player who has not seen them must, or they miss them): alone, while
 * they are due, and not under a development start window. Heading for the
 * Sima still checks them too (a room plays none: they wait for a solo visit).
 */
export const pleaOnArrival = (o: { inRoom: boolean; startWindow: boolean; due: boolean }): boolean => !o.inRoom && !o.startWindow && o.due;
