import { FOG } from '../data/dungeon';
import type { GameEvent, WorldState } from './state';

/**
 * Niebla, the Misty Forest's urgent floor (docs/gdd.md §3 "Plantas con
 * prisa"): the fog closes in from the moment you arrive. The vision radius
 * shrinks from `FOG.startTiles` to `FOG.minTiles` over `FOG.closeMs` (after a
 * short grace), the minimap only remembers what was inside it, and once it
 * has fully closed the cold of the fog bites a little at a time (never
 * below 1 HP: it presses, it does not kill). Taking the stairs ends it.
 * Each peer runs its own clock and only hurts its own player.
 */
export interface FogState {
  /** Time since the floor was entered. */
  elapsedMs: number;
  /** Time left before the next chill once the fog has closed. */
  chillMs: number;
}

export const startFog = (): FogState => ({ elapsedMs: 0, chillMs: FOG.chillIntervalMs });

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** How far the fog has closed, 0 (just arrived) to 1 (fully closed). */
export const fogClosure = (fog: FogState): number => smoothstep((fog.elapsedMs - FOG.graceMs) / FOG.closeMs);

/** Vision radius in tiles: shrinks from the start radius to the minimum and never grows back. */
export const fogRadiusTiles = (fog: FogState): number => FOG.startTiles - (FOG.startTiles - FOG.minTiles) * fogClosure(fog);

/** True once the fog has fully closed (it starts to chill). */
export const fogClosed = (fog: FogState): boolean => fog.elapsedMs >= FOG.graceMs + FOG.closeMs;

/** One step: the clock, and once closed a chill on the local player every interval (a floor hazard: no dodge, no Disguise). */
export function updateFog(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  if (!state.fog) return state;
  let fog: FogState = { ...state.fog, elapsedMs: state.fog.elapsedMs + dtMs };
  let player = state.player;
  if (fogClosed(fog) && player.hp > 1) {
    const chillMs = fog.chillMs - dtMs;
    if (chillMs <= 0) {
      const damage = Math.min(player.hp - 1, FOG.chillFraction * player.maxHp);
      events.push({ type: 'collapseHurt', damage });
      player = { ...player, hp: player.hp - damage };
      fog = { ...fog, chillMs: chillMs + FOG.chillIntervalMs };
    } else fog = { ...fog, chillMs };
  }
  return { ...state, player, fog };
}
