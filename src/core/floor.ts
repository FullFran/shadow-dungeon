import type { FloorKind } from '../data/dungeon';
import { startCollapse } from './collapse';
import { roomRect, type Floor } from './dungeon';
import { insideRect } from './geometry';
import type { Arena, WorldState } from './state';
import { TILE, tileCenter } from './tiles';
import { vec } from './vec';
import { enterRoom, spawnEnemy } from './world';

/** The world arena of a generated floor: its tile grid and the stairs tile. */
export function floorArena(floor: Floor): Arena {
  return {
    width: floor.cols * TILE,
    height: floor.rows * TILE,
    tiles: floor,
    stairs: { x: floor.stairs.x * TILE, y: floor.stairs.y * TILE, width: TILE, height: TILE },
    rooms: floor.rooms,
  };
}

/**
 * Enters a generated floor: resets per-floor state (Disguise), puts the player on the start tile, spawns sleeping enemies,
 * and on a collapse floor starts the collapse clock.
 */
export function loadFloor(state: WorldState, floor: Floor, kind: FloorKind = 'normal'): WorldState {
  const entered = enterRoom(state);
  let next: WorldState = {
    ...entered,
    arena: floorArena(floor),
    player: { ...entered.player, pos: tileCenter(floor.start), roll: null, facing: vec(0, 1) },
    ...(kind === 'collapse' ? { collapse: startCollapse(floor) } : {}),
  };
  for (const spawn of floor.spawns) {
    next = spawnEnemy(next, spawn.species, tileCenter(spawn.tile), { sleepIn: roomRect(floor.rooms[spawn.room]!) });
  }
  return next;
}

/** True when a player (the local one, or a remote one still standing) is on the stairs (no clear requirement, Mystery Dungeon style). */
export function onStairs(state: WorldState): boolean {
  const stairs = state.arena.stairs;
  if (stairs === undefined) return false;
  return insideRect(state.player.pos, stairs) || state.remotes.some((r) => r.player.hp > 0 && insideRect(r.player.pos, stairs));
}
