import { TIERS, type Difficulty } from '../data/difficulty';
import { RUN } from '../data/dungeon';
import { roomCleared } from './rooms';
import { dungeonOf, floorPlanOf, type RunState } from './run';
import type { WorldState } from './state';
import { vec, type Vec2 } from './vec';

/**
 * The mid-boss bonfire (docs/gdd.md §3, Dark Souls style): felling a main
 * dungeon's mid-boss lights a bonfire in its room, and each peer keeps its
 * own state as it was then. Later in the run a full party wipe may go back
 * there instead of ending (the tier's allowance, `respawnsLeft`); the floors
 * after it come again from the run seed. Not in the Sima, the shrine, nor a
 * dungeon without a mid-boss (a plain challenge; a Senda has two:
 * docs/story-quests.md).
 */

/** Whether this floor's room lights a bonfire once cleared: a mid-boss room outside the Sima. */
export function bonfireFloor(run: Pick<RunState, 'floor' | 'dungeon'>): boolean {
  const plan = floorPlanOf(run);
  return plan.kind === 'room' && plan.role === 'midboss' && !dungeonOf(run).endless;
}

/** Bonfire respawns left this run after `used`; null = unlimited (easy). */
export function respawnsLeft(d: Difficulty, used: number): number | null {
  const per = TIERS[d].bonfireRespawns;
  return per === null ? null : Math.max(0, per - used);
}

/** The bonfire lights this step: the mid-boss just fell and it was not lit yet. */
export const bonfireLights = (run: RunState, world: WorldState, lit: boolean): boolean => !lit && bonfireFloor(run) && roomCleared(world);

/** The state a respawn brings back (HP, items, level as they were); a fainted player stands up with the floor heal. */
export function bonfireSnapshot(world: WorldState): WorldState {
  const { hp, maxHp } = world.player;
  return hp > 0 ? world : { ...world, player: { ...world.player, hp: Math.max(1, Math.round(RUN.floorHeal * maxHp)) } };
}

/** Where the bonfire burns: the middle of its room. */
export const bonfirePos = (world: WorldState): Vec2 => vec(world.arena.width / 2, world.arena.height / 2);
