import { GAS } from '../data/swamp';
import { tileDistances, type Floor } from './dungeon';
import type { GameEvent, WorldState } from './state';
import { tileOf, type TilePoint } from './tiles';

/**
 * Gas tóxico, the Toxic Swamp's urgent floor (docs/gdd.md §3 "Plantas con
 * prisa"): after a grace delay a cloud of gas spreads from the entrance
 * along the walking distance field at a constant speed (slower than the
 * collapse), so it always reaches the stairs last. Breathing it drains HP on
 * an interval: rolling does not help (it is in the air), Disguise does not
 * absorb it (it is not an attack), and it never takes the last HP. Each peer
 * runs its own clock and only drains its own player; enemies of the swamp
 * are at home in it.
 */
export interface GasState {
  /** Walking distance in tiles from the start tile, -1 on walls and unreachable tiles. */
  dist: readonly number[];
  /** Time since the floor was entered. */
  elapsedMs: number;
  /** Time left before the next drain while in the gas. */
  drainMs: number;
}

export const startGas = (floor: Floor): GasState => ({ dist: tileDistances(floor, floor.start), elapsedMs: 0, drainMs: GAS.drainIntervalMs });

/** Distance of the gas front from the start, in tiles (0 during the grace delay). */
export const gasFront = (g: GasState): number => Math.max(0, ((g.elapsedMs - GAS.graceMs) / 1000) * GAS.frontTilesPerSecond);

const distAt = (g: GasState, cols: number, tile: TilePoint): number => {
  if (tile.x < 0 || tile.y < 0 || tile.x >= cols) return -1;
  return g.dist[tile.y * cols + tile.x] ?? -1;
};

export function isGassed(g: GasState, cols: number, tile: TilePoint): boolean {
  const d = distAt(g, cols, tile);
  return d >= 0 && d < gasFront(g);
}

/** Tiles behind the front at `tile` (0 at the front, up to `GAS.edgeTiles` for full thickness); 0 outside the gas. */
export function gasDepth(g: GasState, cols: number, tile: TilePoint): number {
  const d = distAt(g, cols, tile);
  return d < 0 ? 0 : Math.max(0, Math.min(GAS.edgeTiles, gasFront(g) - d));
}

export const advanceGas = (g: GasState, dtMs: number): GasState => ({ ...g, elapsedMs: g.elapsedMs + dtMs });

/** Tiles between the player and the front once it moves (negative inside the gas); null when there is no moving front. */
export function gasProximity(state: WorldState): number | null {
  const g = state.gas;
  const grid = state.arena.tiles;
  if (!g || !grid || g.elapsedMs < GAS.graceMs) return null;
  const d = distAt(g, grid.cols, tileOf(state.player.pos));
  return d < 0 ? null : d - gasFront(g);
}

/** One step: advance the cloud; inside it, drain the local player on the interval (never below 1 HP). */
export function updateGas(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const grid = state.arena.tiles;
  if (!state.gas || !grid) return state;
  let g = advanceGas(state.gas, dtMs);
  let player = state.player;
  if (isGassed(g, grid.cols, tileOf(player.pos))) {
    const drainMs = g.drainMs - dtMs;
    if (drainMs <= 0) {
      const damage = Math.min(Math.max(0, player.hp - 1), GAS.drainFraction * player.maxHp);
      if (damage > 0) {
        events.push({ type: 'collapseHurt', damage });
        player = { ...player, hp: player.hp - damage };
      }
      g = { ...g, drainMs: drainMs + GAS.drainIntervalMs };
    } else g = { ...g, drainMs };
  } else if (g.drainMs !== GAS.drainIntervalMs) {
    // Out of the gas the next breath of it waits a full interval again.
    g = { ...g, drainMs: GAS.drainIntervalMs };
  }
  return { ...state, player, gas: g };
}
