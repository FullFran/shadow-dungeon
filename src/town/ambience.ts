import { TUNING } from '../data/tuning';
import type { Wanderer } from '../data/world';
import type { Arena } from '../core/state';
import { isWall, TILE, tileOf } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { hash01 } from '../ui/eclipse';
import { stepWalker, type Walker } from './interact';

/**
 * Pure ambience of the overworld: where the fog banks, the falling leaves
 * and the birds are at a time (view pixels, deterministic per index), and
 * the slow random walk of the harmless wandering Pokémon around their home
 * tile (same collision as the player, a fraction of its speed).
 */

/** A soft fog bank drifting sideways, with a little parallax against the camera. */
export function fogBank(i: number, ms: number, viewX: number, width: number, height: number): { x: number; y: number; r: number } {
  const span = width + 240;
  const speed = 4 + hash01(i * 5 + 1) * 8;
  const x = ((((hash01(i * 5 + 2) * span + (ms / 1000) * speed - viewX * 0.3) % span) + span) % span) - 120;
  const y = height * (0.3 + hash01(i * 5 + 3) * 0.7);
  return { x, y, r: 60 + hash01(i * 5 + 4) * 70 };
}

/** A leaf falling and swaying across the view, wrapping around. */
export function leafAt(i: number, ms: number, width: number, height: number): { x: number; y: number; flip: boolean } {
  const fall = 10 + hash01(i * 7 + 1) * 14;
  const drift = 6 + hash01(i * 7 + 2) * 10;
  const t = ms / 1000;
  const y = (hash01(i * 7 + 3) * height + t * fall) % height;
  const x = (((hash01(i * 7 + 4) * width + t * drift + Math.sin(t * 1.3 + i) * 8) % width) + width) % width;
  return { x, y, flip: Math.sin(t * 3 + i) > 0 };
}

/** A bird gliding across the sky band, wings up or down. */
export function birdAt(i: number, ms: number, width: number, band: number): { x: number; y: number; up: boolean } {
  const span = width + 60;
  const speed = 14 + hash01(i * 11 + 1) * 12;
  const x = ((hash01(i * 11 + 2) * span + (ms / 1000) * speed) % span) - 30;
  const y = 8 + hash01(i * 11 + 3) * (band * 0.45) + Math.sin(ms / 900 + i) * 2;
  return { x, y, up: Math.floor(ms / (180 + hash01(i) * 120)) % 2 === 0 };
}

export interface WanderState extends Walker {
  /** Where it is walking (px), or null while it rests. */
  target: Vec2 | null;
  waitMs: number;
  /** How many destinations it has picked (seeds the next one). */
  step: number;
}

/** Wanderers walk at this fraction of the player's speed. */
export const WANDER_SPEED = 0.35;

export const startWander = (w: Wanderer): WanderState => ({ pos: { x: (w.x + 0.5) * TILE, y: (w.y + 0.5) * TILE }, facing: { x: 0, y: 1 }, target: null, waitMs: 400 + hash01(w.x * 31 + w.y) * 1600, step: 0 });

/**
 * One tick of a wanderer: rest, else pick a floor tile within `radius` of
 * home (seeded by its id and step), else walk there; a blocked or reached
 * destination ends the walk with a rest of 0.8 to 3 s.
 */
export function stepWander(w: Wanderer, state: WanderState, dtMs: number, arena: Arena): WanderState {
  if (state.waitMs > 0) return { ...state, waitMs: state.waitMs - dtMs };
  const seed = [...w.id].reduce((n, ch) => n * 31 + ch.charCodeAt(0), 7) + state.step * 977;
  const rest = (step: number): WanderState => ({ ...state, target: null, waitMs: 800 + hash01(seed + 5) * 2200, step });
  if (!state.target) {
    const tx = w.x + Math.round((hash01(seed + 1) * 2 - 1) * w.radius);
    const ty = w.y + Math.round((hash01(seed + 2) * 2 - 1) * w.radius);
    if (!arena.tiles || isWall(arena.tiles, tx, ty)) return rest(state.step + 1);
    return { ...state, target: { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }, step: state.step + 1 };
  }
  const to = { x: state.target.x - state.pos.x, y: state.target.y - state.pos.y };
  if (Math.hypot(to.x, to.y) < 2) return rest(state.step);
  const moved = stepWalker(state, to, dtMs * WANDER_SPEED, arena);
  const progress = Math.hypot(moved.pos.x - state.pos.x, moved.pos.y - state.pos.y);
  // Snagged on a corner: give up and rest (the next pick goes elsewhere).
  if (progress < (TUNING.player.moveSpeed * WANDER_SPEED * dtMs) / 4000) return rest(state.step);
  return { ...state, pos: moved.pos, facing: moved.facing };
}

/** The tile a wanderer stands on. */
export const wanderTile = (state: WanderState): Vec2 => tileOf(state.pos);
