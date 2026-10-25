import { step } from '../../src/core/step';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld } from '../../src/core/world';
import { vec, type Vec2 } from '../../src/core/vec';

export const IDLE: PlayerInput = { move: vec(0, 0), aim: vec(0, 0), roll: false, slots: [false, false] };

export const input = (overrides: Partial<PlayerInput> = {}): PlayerInput => ({ ...IDLE, ...overrides });

export function world(playerPos: Vec2 = vec(400, 300), seed = 1): WorldState {
  return createWorld({ seed, arena: { width: 800, height: 600 }, playerPos });
}

/** Runs `ticks` fixed steps with the same input (edges only on the first tick when `edgeOnce`). */
export function run(state: WorldState, playerInput: PlayerInput, ticks: number, edgeOnce = true): WorldState {
  let current = state;
  for (let i = 0; i < ticks; i++) {
    const tickInput = edgeOnce && i > 0 ? { ...playerInput, roll: false } : playerInput;
    current = step(current, tickInput, FIXED_DT_MS);
  }
  return current;
}

/** Number of ticks covering `ms` of simulated time. */
export const ticksFor = (ms: number): number => Math.round(ms / FIXED_DT_MS);
