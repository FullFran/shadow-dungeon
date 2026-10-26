import { ROOMS, type RoomId } from '../data/rooms';
import { insideRect } from './geometry';
import type { WorldState } from './state';
import { vec } from './vec';
import { enterRoom, spawnEnemy } from './world';
import { fightOf } from './cards';
import { worldDifficulty } from './difficulty';
import { behaviourFor } from './tricks';

/** Enters a room: resets per-room state (Disguise), sets the arena and player start, spawns its enemies. */
export function loadRoom(state: WorldState, roomId: RoomId): WorldState {
  const room = ROOMS[roomId];
  const entered = enterRoom(state);
  let next: WorldState = {
    ...entered,
    arena: { width: room.width, height: room.height, obstacles: room.obstacles },
    ...(room.pools ? { pools: room.pools } : {}),
    player: { ...entered.player, pos: vec(room.playerStart.x, room.playerStart.y), roll: null, facing: vec(1, 0) },
  };
  for (const spawn of room.spawns) next = spawnEnemy(next, spawn.species, vec(spawn.x, spawn.y));
  return cardBossHp(next);
}

/** A boss that fights with spell cards at this tier has its fight's HP share (data/cards.ts `hpScale`). */
function cardBossHp(state: WorldState): WorldState {
  const tier = worldDifficulty(state);
  const enemies = state.enemies.map((e) => {
    const scale = e.boss ? fightOf(behaviourFor(e.species, tier))?.hpScale : undefined;
    if (scale === undefined || scale === 1) return e;
    const maxHp = Math.max(1, Math.round(e.maxHp * scale));
    return { ...e, maxHp, hp: maxHp };
  });
  return { ...state, enemies };
}

/** Every enemy of the room is down (never while the boss still waits behind its fog, core/fog-wall.ts). */
export function roomCleared(state: WorldState): boolean {
  return !state.fogWall && state.enemies.every((e) => !e.alive);
}

/** True when the room is cleared and the player stands on its exit. */
export function atExit(state: WorldState, roomId: RoomId): boolean {
  const exit = ROOMS[roomId].exit;
  return exit !== null && roomCleared(state) && insideRect(state.player.pos, exit);
}
