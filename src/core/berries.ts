import { ORAN_BERRY } from '../data/items';
import type { Floor } from './dungeon';
import { deriveSeed, nextRandom } from './rng';
import type { Berry, GameEvent, WorldState } from './state';
import { isWall, tileCenter, type TilePoint } from './tiles';
import { distance } from './vec';

/**
 * Oran Berries on generated floors (docs/gdd.md §3): each room but the start
 * one holds one with `ORAN_BERRY.roomChance`, on a free floor tile, all drawn
 * from the floor seed (the floor generator itself is untouched). Walking over
 * one heals. In a shared run the host is authoritative: a guest that walks
 * over a berry hides it and claims it (`berryClaim` event); the host applies
 * the claims once each (`applyBerryClaims`, the first claimer gets it), tells
 * the claimer (`berryGranted` on its side) and its snapshots carry the
 * berries left.
 */

/** Salt that keeps berry placement independent of the floor generator's own draws. */
const BERRY_SALT = 0xbe44;

export function placeBerries(floor: Floor, seed: number, depth: number): Berry[] {
  const taken = new Set([floor.start, floor.stairs, ...floor.spawns.map((s) => s.tile)].map((t) => `${t.x},${t.y}`));
  const berries: Berry[] = [];
  floor.rooms.forEach((room, index) => {
    if (index === floor.startRoom) return;
    const chance = nextRandom(deriveSeed(seed, BERRY_SALT + index));
    if (chance.value >= ORAN_BERRY.roomChance) return;
    const free: TilePoint[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) if (!isWall(floor, x, y) && !taken.has(`${x},${y}`)) free.push({ x, y });
    }
    if (free.length === 0) return;
    const tile = free[Math.floor(nextRandom(chance.state).value * free.length)]!;
    berries.push({ id: `f${depth}b${index}`, pos: tileCenter(tile) });
  });
  return berries;
}

const heal = (state: WorldState, berryId: string, events: GameEvent[]): WorldState => {
  events.push({ type: 'berryEaten', berryId, heal: ORAN_BERRY.heal });
  const { player } = state;
  return { ...state, player: { ...player, hp: Math.min(player.maxHp, player.hp + ORAN_BERRY.heal) } };
};

/** The local player walks over berries: the host (and solo) eats them; a guest hides them and claims them. */
export function pickUpBerries(state: WorldState, events: GameEvent[]): WorldState {
  if (state.berries.length === 0 || state.player.hp <= 0) return state;
  const touched = state.berries.filter((b) => distance(b.pos, state.player.pos) <= ORAN_BERRY.pickupRadius);
  if (touched.length === 0) return state;
  let current: WorldState = { ...state, berries: state.berries.filter((b) => !touched.includes(b)) };
  for (const berry of touched) {
    if (state.role === 'guest') events.push({ type: 'berryClaim', berryId: berry.id });
    else current = heal(current, berry.id, events);
  }
  return current;
}

export interface BerryClaim {
  berryId: string;
  playerId: string;
}

/** Host: guests' berry claims, in arrival order; a berry already gone is refused. Returns the granted ones. */
export function applyBerryClaims(state: WorldState, claims: readonly BerryClaim[]): { state: WorldState; granted: BerryClaim[] } {
  let berries = state.berries;
  const granted: BerryClaim[] = [];
  for (const claim of claims) {
    if (!berries.some((b) => b.id === claim.berryId)) continue;
    berries = berries.filter((b) => b.id !== claim.berryId);
    granted.push(claim);
  }
  return { state: granted.length > 0 ? { ...state, berries } : state, granted };
}

/** Guest: the host granted this player's claim; it heals now (once per grant message). */
export function berryGranted(state: WorldState, berryId: string, events: GameEvent[]): WorldState {
  if (state.player.hp <= 0) return state;
  return heal({ ...state, berries: state.berries.filter((b) => b.id !== berryId) }, berryId, events);
}
