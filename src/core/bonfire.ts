import { TIERS, type Difficulty } from '../data/difficulty';
import { RUN } from '../data/dungeon';
import { FOG_ANTE } from './fog-wall';
import { roomCleared } from './rooms';
import { dungeonOf, floorPlanOf, type RunState } from './run';
import type { WorldState } from './state';
import { vec, type Vec2 } from './vec';

/**
 * The bonfire (docs/gdd.md §3, Dark Souls style). In a main dungeon, felling
 * its mid-boss lights a bonfire in its room, and each peer keeps its own
 * state as it was then. Later in the run a full party wipe may go back there
 * instead of ending (the tier's allowance, `respawnsLeft`); the floors after
 * it come again from the run seed. Not in the shrine, nor a dungeon without
 * a mid-boss (a plain challenge; a Senda has two: docs/story-quests.md).
 *
 * In the Sima (odd/tasks/sima-fog-bonfires.md) every boss floor has one in
 * its antechamber, lit on arrival: a wipe in that fight may go back to the
 * fog with the same allowance. It covers only its own floor (the game puts
 * it out on the way down) and gives no time back (`bonfireReturn`).
 */

/** Whether this floor has a bonfire: a mid-boss room, or any Sima boss floor. */
export function bonfireFloor(run: Pick<RunState, 'floor' | 'dungeon'> & Partial<Pick<RunState, 'seed'>>): boolean {
  const plan = floorPlanOf(run);
  if (plan.kind !== 'room') return false;
  return dungeonOf(run).endless ? true : plan.role === 'midboss';
}

/** Bonfire respawns left this run after `used`; null = unlimited (easy). */
export function respawnsLeft(d: Difficulty, used: number): number | null {
  const per = TIERS[d].bonfireRespawns;
  return per === null ? null : Math.max(0, per - used);
}

/** The bonfire lights this step: the mid-boss just fell (a Sima boss floor: the party is at its fog) and it was not lit yet. */
export const bonfireLights = (run: RunState, world: WorldState, lit: boolean): boolean =>
  !lit && bonfireFloor(run) && (dungeonOf(run).endless ? world.fogWall !== undefined : roomCleared(world));

/** The state a respawn brings back (HP, items, level as they were); a fainted player stands up with the floor heal. */
export function bonfireSnapshot(world: WorldState): WorldState {
  const { hp, maxHp } = world.player;
  return hp > 0 ? world : { ...world, player: { ...world.player, hp: Math.max(1, Math.round(RUN.floorHeal * maxHp)) } };
}

/** Where the bonfire burns: the middle of its room. */
export const bonfirePos = (world: WorldState): Vec2 => vec(world.arena.width / 2, world.arena.height / 2);

/** Where this floor's bonfire burns now: a Sima one in its antechamber (to the right of the way in; none once the fog is crossed), else the middle of the room. */
export function bonfireSpot(run: Pick<RunState, 'dungeon'>, world: WorldState): Vec2 | null {
  if (!dungeonOf(run).endless) return bonfirePos(world);
  const wall = world.fogWall;
  return wall ? vec(world.arena.width / 2 + SIMA_SPOT_RIGHT, wall.line + FOG_ANTE / 2) : null;
}

/** How far right of the antechamber's middle a Sima bonfire burns (the stray's stairs are on the left). */
const SIMA_SPOT_RIGHT = 110;

/** The run a bonfire brings back: its snapshot, but a Sima run keeps the clock it has now (going back gives no time). */
export function bonfireReturn(snapshot: RunState, now: RunState): RunState {
  if (!dungeonOf(snapshot).endless || now.clockMs === undefined) return snapshot;
  return { ...snapshot, clockMs: now.clockMs, graceMs: now.graceMs ?? 0 };
}
