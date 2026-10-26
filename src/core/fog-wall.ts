import { TUNING } from '../data/tuning';
import type { EnemyState, WorldState } from './state';
import { vec, type Vec2 } from './vec';

/**
 * The fog wall before a boss (docs/gdd.md §3, Dark Souls style): a boss room
 * opens with the party in a short antechamber below the arena, the boss held
 * back (out of the world) behind a wall of fog. Touching the fog is the
 * floor's leaving point (core/gather.ts): once the party agrees, everyone
 * crosses, the fog seals behind and the room is exactly the one a fight
 * without the wall starts in (same arena, same start, same boss).
 */

/** Height of the antechamber below the arena (px). */
export const FOG_ANTE = 120;

/** How close to the fog a player stands to touch it (px past its own radius). */
const REACH = 6;

const RADIUS = TUNING.player.radius;

export interface FogWall {
  /** The fog's line: the room's bottom edge (the antechamber lies below it). */
  line: number;
  /** Where the room puts the player once crossed (its own start). */
  start: Vec2;
  /** The room's enemies, held back until the party crosses. */
  enemies: readonly EnemyState[];
}

/** Closes the fog on a freshly loaded boss room: the boss waits outside the world, the party in the antechamber. */
export function closeFogWall(world: WorldState): WorldState {
  const line = world.arena.height;
  const start = world.player.pos;
  return {
    ...world,
    arena: { ...world.arena, height: line + FOG_ANTE },
    enemies: [],
    player: { ...world.player, pos: vec(start.x, line + FOG_ANTE / 2) },
    fogWall: { line, start, enemies: world.enemies },
  };
}

/** The party crossed: the arena is the room again, the player on its start, the boss back. */
export function crossFogWall(world: WorldState): WorldState {
  const wall = world.fogWall;
  if (!wall) return world;
  const { fogWall: _wall, ...rest } = world;
  // A Sima stray floor's way past (stairs in the antechamber) is left behind with it.
  const { stairs: _stairs, ...arena } = world.arena;
  return { ...rest, arena: { ...arena, height: wall.line }, enemies: wall.enemies, player: { ...world.player, pos: wall.start } };
}

/** Whether `pos` touches the fog (from the antechamber). */
export const atFogWall = (world: WorldState, pos: Vec2): boolean => world.fogWall !== undefined && pos.y <= world.fogWall.line + RADIUS + REACH;

/** Each step while the fog is closed: nobody walks through it, and no shot of the party flies past it. */
export function holdAtFogWall(world: WorldState): WorldState {
  const wall = world.fogWall;
  if (!wall) return world;
  const floor = wall.line + RADIUS;
  const player = world.player.pos.y < floor ? { ...world.player, pos: vec(world.player.pos.x, floor) } : world.player;
  const projectiles = world.projectiles.filter((p) => p.pos.y >= wall.line);
  return projectiles.length === world.projectiles.length && player === world.player ? world : { ...world, player, projectiles };
}
