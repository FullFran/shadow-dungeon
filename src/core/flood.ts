import { FLOOD } from '../data/dungeon';
import type { PokemonType } from '../data/types';
import type { GameEvent, WorldState } from './state';

/**
 * Inundación, the Flooded Caves' urgent floor (docs/gdd.md §3 "Plantas con
 * prisa"): from the moment you arrive the water rises over the whole floor.
 * After a short grace its level climbs from 0 to 1 over `FLOOD.riseMs`; a
 * player who is not a Water type walks slower and slower (down to
 * `1 - FLOOD.maxSlow` of the normal speed), and once the water is fully up
 * the cold bites a little at a time (never below 1 HP: it presses, it does
 * not kill). Water types wade through it untouched: the type of your Pokémon
 * decides who leads. Taking the stairs ends it. Each peer runs its own clock
 * and only slows or hurts its own player.
 */
export interface FloodState {
  /** Time since the floor was entered. */
  elapsedMs: number;
  /** Time left before the next chill once the water is fully up. */
  chillMs: number;
}

export const startFlood = (): FloodState => ({ elapsedMs: 0, chillMs: FLOOD.chillIntervalMs });

const smoothstep = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Water level, 0 (just arrived) to 1 (fully risen); it never goes down. */
export const floodLevel = (flood: FloodState): number => smoothstep((flood.elapsedMs - FLOOD.graceMs) / FLOOD.riseMs);

/** True once the water is fully up (it starts to chill). */
export const floodRisen = (flood: FloodState): boolean => flood.elapsedMs >= FLOOD.graceMs + FLOOD.riseMs;

const isWaterType = (types: readonly PokemonType[]): boolean => types.includes('water');

/** Walking speed factor the flood leaves a player of these types: 1 for Water types, less as the water rises for everyone else. */
export const floodFactor = (flood: FloodState, types: readonly PokemonType[]): number => (isWaterType(types) ? 1 : 1 - FLOOD.maxSlow * floodLevel(flood));

/** One step: the clock, and once risen a chill on a non-Water local player every interval (a floor hazard: no dodge, no Disguise). */
export function updateFlood(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  if (!state.flood) return state;
  let flood: FloodState = { ...state.flood, elapsedMs: state.flood.elapsedMs + dtMs };
  let player = state.player;
  if (floodRisen(flood) && !isWaterType(player.types) && player.hp > 1) {
    const chillMs = flood.chillMs - dtMs;
    if (chillMs <= 0) {
      const damage = Math.min(player.hp - 1, FLOOD.chillFraction * player.maxHp);
      events.push({ type: 'collapseHurt', damage });
      player = { ...player, hp: player.hp - damage };
      flood = { ...flood, chillMs: chillMs + FLOOD.chillIntervalMs };
    } else flood = { ...flood, chillMs };
  }
  return { ...state, player, flood };
}
