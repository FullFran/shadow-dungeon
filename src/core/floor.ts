import type { FloorKind } from '../data/dungeon';
import { startCollapse } from './collapse';
import { drawElite, tierEliteRule, worldDifficulty } from './difficulty';
import type { EliteRule } from '../data/difficulty';
import { startFog } from './fog';
import { startFlood } from './flood';
import { startGas } from './gas';
import { roomRect, type Floor } from './dungeon';
import { insideRect } from './geometry';
import type { Arena, WorldState } from './state';
import { TILE, tileCenter } from './tiles';
import { vec, type Vec2 } from './vec';
import { joinBands } from './leaders';
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
export function loadFloor(state: WorldState, floor: Floor, kind: FloorKind = 'normal', elites?: EliteRule): WorldState {
  const entered = enterRoom(state);
  let next: WorldState = {
    ...entered,
    arena: floorArena(floor),
    player: { ...entered.player, pos: tileCenter(floor.start), roll: null, facing: vec(0, 1) },
    ...(kind === 'collapse' ? { collapse: startCollapse(floor) } : {}),
    ...(kind === 'fog' ? { fog: startFog() } : {}),
    ...(kind === 'flood' ? { flood: startFlood() } : {}),
    ...(kind === 'gas' ? { gas: startGas(floor) } : {}),
  };
  // Elites: some floor enemies are elites, drawn from the floor seed (the same on every peer), by the tier's rule or the dungeon's (the Sima's).
  const rule = elites ?? tierEliteRule(worldDifficulty(state));
  floor.spawns.forEach((spawn, index) => {
    const elite = drawElite(floor.seed, index, rule, spawn.species);
    const drawn = elite ? { elite: elite.trait, eliteHp: rule.hpScale, ...(elite.pierceRoll ? { pierceRoll: true as const } : {}) } : {};
    next = spawnEnemy(next, spawn.species, tileCenter(spawn.tile), { sleepIn: roomRect(floor.rooms[spawn.room]!), ...drawn, ...(spawn.leader ? { leader: true as const } : {}) });
  });
  // A crowned group's followers take their leader's id (core/leaders.ts).
  return joinBands(next, floor.spawns);
}

/** True when `pos` (the local player's by default) is on the floor's stairs (no clear requirement, Mystery Dungeon style). */
export function onStairs(state: WorldState, pos: Vec2 = state.player.pos): boolean {
  const stairs = state.arena.stairs;
  return stairs !== undefined && insideRect(pos, stairs);
}
