import { ROOMS, type RoomId } from '../data/rooms';
import { insideRect } from './geometry';
import type { WorldState } from './state';
import { vec } from './vec';
import { enterRoom, spawnEnemy } from './world';

/** Enters a room: resets per-room state (Disguise), sets the arena and player start, spawns its enemies. */
export function loadRoom(state: WorldState, roomId: RoomId): WorldState {
  const room = ROOMS[roomId];
  const entered = enterRoom(state);
  let next: WorldState = {
    ...entered,
    arena: { width: room.width, height: room.height, obstacles: room.obstacles },
    player: { ...entered.player, pos: vec(room.playerStart.x, room.playerStart.y), roll: null, facing: vec(1, 0) },
  };
  for (const spawn of room.spawns) next = spawnEnemy(next, spawn.species, vec(spawn.x, spawn.y));
  return next;
}

export function roomCleared(state: WorldState): boolean {
  return state.enemies.every((e) => !e.alive);
}

/** True when the room is cleared and the player stands on its exit. */
export function atExit(state: WorldState, roomId: RoomId): boolean {
  const exit = ROOMS[roomId].exit;
  return exit !== null && roomCleared(state) && insideRect(state.player.pos, exit);
}
