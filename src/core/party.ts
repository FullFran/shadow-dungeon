import type { EnemyState, WorldState } from './state';
import type { Vec2 } from './vec';

/**
 * The players sharing a world (docs/gdd.md §7): the local one (`state.player`,
 * simulated here) and the remote ones (`state.remotes`, as their peers report
 * them). Solo is just the local player, so every rule below reduces to the
 * single-player one.
 */
export interface PresentPlayer {
  id: string;
  pos: Vec2;
}

/** Players still standing (hp > 0), local first, then remotes by id: enemy targets, wakers and flow origins. */
export function presentPlayers(state: WorldState): PresentPlayer[] {
  const out: PresentPlayer[] = [];
  if (state.player.hp > 0) out.push({ id: state.localId, pos: state.player.pos });
  const remotes = [...state.remotes].filter((r) => r.player.hp > 0).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const remote of remotes) out.push({ id: remote.id, pos: remote.player.pos });
  return out;
}

/**
 * The player an enemy goes for: the nearest present one, ties broken by the
 * lower id so every peer and replay picks the same. With nobody standing it
 * keeps facing the local player (the run is ending anyway).
 */
export function targetOf(state: WorldState, enemy: EnemyState): PresentPlayer {
  let best: PresentPlayer | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of presentPlayers(state)) {
    const dx = candidate.pos.x - enemy.pos.x;
    const dy = candidate.pos.y - enemy.pos.y;
    const d = dx * dx + dy * dy;
    if (d < bestDist || (d === bestDist && best !== null && candidate.id < best.id)) {
      best = candidate;
      bestDist = d;
    }
  }
  return best ?? { id: state.localId, pos: state.player.pos };
}

/** Everyone is down: the shared run is lost (solo: the player fainted). */
export const partyDefeated = (state: WorldState): boolean => state.player.hp <= 0 && state.remotes.every((r) => r.player.hp <= 0);
