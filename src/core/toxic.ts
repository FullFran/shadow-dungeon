import { TOXIC } from '../data/swamp';
import type { Floor } from './dungeon';
import { isInvulnerable } from './player';
import { deriveSeed, nextRandom } from './rng';
import type { GameEvent, PlayerState, WorldState } from './state';
import { TILE, isWall, tileCenter } from './tiles';
import { distance, vec, type Vec2 } from './vec';

/**
 * The Toxic Swamp's toxic pools (docs/gdd.md §3, Pantano Tóxico): bubbling
 * sludge set into the floor of its rooms. Wading in poisons the player (a
 * roll's i-frames carry it across safely, and brushing the rim is safe); the
 * poison bites a fraction of max HP on an interval for a while after the last
 * contact and never takes the last HP. Enemies of the swamp ignore the pools.
 * A generated floor's pools come from its seed, so every peer of a shared
 * run places the same ones; each peer poisons only its own player.
 */
export interface ToxicPool {
  x: number;
  y: number;
  radius: number;
}

export interface PoisonState {
  /** Time left before the poison wears off (refreshed while wading). */
  remainingMs: number;
  /** Time left before the next bite. */
  tickMs: number;
}

/** Salt that keeps the pools independent of the floor generator's own draws. */
const POOL_SALT = 0x7051;

/** The pools of a generated floor: a fixed draw from its seed, in its rooms, clear of the start and the stairs. */
export function placePools(floor: Floor, seed: number): ToxicPool[] {
  let state = deriveSeed(seed, POOL_SALT);
  const next = (): number => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
  const start = tileCenter(floor.start);
  const stairs = tileCenter(floor.stairs);
  const clear = TOXIC.clearTiles * TILE;
  const pools: ToxicPool[] = [];
  floor.rooms.forEach((room, index) => {
    const roll = next();
    const count = TOXIC.perRoom.min + Math.floor(next() * (TOXIC.perRoom.max - TOXIC.perRoom.min + 1));
    if (index === floor.startRoom || roll >= TOXIC.roomChance) return;
    for (let i = 0; i < count; i++) {
      const tx = room.x + 1 + Math.floor(next() * Math.max(1, room.width - 2));
      const ty = room.y + 1 + Math.floor(next() * Math.max(1, room.height - 2));
      const radius = (TOXIC.radiusTiles.min + next() * (TOXIC.radiusTiles.max - TOXIC.radiusTiles.min)) * TILE;
      const centre = tileCenter({ x: tx, y: ty });
      if (isWall(floor, tx, ty) || distance(centre, start) <= clear || distance(centre, stairs) <= clear) continue;
      if (pools.some((p) => distance(p, centre) < p.radius + radius)) continue;
      pools.push({ x: centre.x, y: centre.y, radius });
    }
  });
  return pools;
}

/** True when `pos` is wading in a pool (deeper than the safe rim). */
export const inPool = (pools: readonly ToxicPool[], pos: Vec2): boolean => pools.some((p) => distance(vec(p.x, p.y), pos) < p.radius - TOXIC.edgeMarginPx);

const cured = (player: PlayerState): PlayerState => {
  const { poison: _gone, ...rest } = player;
  return rest;
};

/** One step: wading (not rolling) poisons or refreshes the poison; a poisoned player is bitten on the interval (never below 1 HP). */
export function updateToxic(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  let player = state.player;
  let poison = player.poison;
  if (state.pools && player.hp > 0 && !isInvulnerable(player) && inPool(state.pools, player.pos)) {
    if (!poison) events.push({ type: 'poisoned' });
    // Refreshed while wading: a full duration once this step is over.
    poison = { remainingMs: TOXIC.poison.durationMs + dtMs, tickMs: poison?.tickMs ?? TOXIC.poison.tickMs };
  }
  if (!poison) return state;
  let tickMs = poison.tickMs - dtMs;
  if (tickMs <= 0) {
    const damage = Math.min(Math.max(0, player.hp - 1), TOXIC.poison.tickFraction * player.maxHp);
    if (damage > 0) {
      events.push({ type: 'collapseHurt', damage });
      player = { ...player, hp: player.hp - damage };
    }
    tickMs += TOXIC.poison.tickMs;
  }
  const remainingMs = poison.remainingMs - dtMs;
  player = remainingMs <= 0 ? cured(player) : { ...player, poison: { remainingMs, tickMs } };
  return { ...state, player };
}
