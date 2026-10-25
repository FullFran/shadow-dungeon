import { COOP_REVIVE } from '../data/party-scaling';
import { tierOf } from './difficulty';
import type { GameEvent, RemotePlayer, WorldState } from './state';
import { distance } from './vec';

/**
 * Co-op revive (docs/gdd.md §6): a fainted player gets up when a standing
 * ally stays within `COOP_REVIVE.radius` of it for `holdMs` without being
 * hurt, with `hpShare` of its max HP, `perFloor` times per floor. Each peer
 * owns its player, so the fainted player's own peer runs it (victim side,
 * like damage) from the allies it sees; its progress travels in its player
 * snapshot for the others to draw. The run still ends only when everyone is
 * down (core/party.ts `partyDefeated`). Tiers may forbid it
 * (`TierDef.coopRevive`). Solo worlds never get a revive state.
 */

export interface ReviveState {
  /** Time the current helper has stood by. */
  ms: number;
  /** Who is helping (null: nobody in reach). */
  by: string | null;
  /** The helper's HP when last seen: a drop means it was hurt, and the count starts again. */
  byHp: number;
  /** Revives used on this floor. */
  used: number;
}

/** Whether the local player could still be revived on this floor (tier and per-floor uses). */
export const reviveAvailable = (state: WorldState): boolean => tierOf(state).coopRevive !== false && (state.revive?.used ?? 0) < COOP_REVIVE.perFloor;

/** The standing ally nearest to the local player within reach (ties: lower id), if any. */
function helperOf(state: WorldState): RemotePlayer | null {
  let best: RemotePlayer | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const remote of state.remotes) {
    if (remote.player.hp <= 0) continue;
    const d = distance(remote.player.pos, state.player.pos);
    if (d > COOP_REVIVE.radius) continue;
    if (d < bestDist || (d === bestDist && best !== null && remote.id < best.id)) {
      best = remote;
      bestDist = d;
    }
  }
  return best;
}

export function updateRevive(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const prev = state.revive;
  if (state.remotes.length === 0 && !prev) return state;
  const used = prev?.used ?? 0;
  const idle: ReviveState = { ms: 0, by: null, byHp: 0, used };
  if (state.player.hp > 0 || !reviveAvailable(state)) return prev && (prev.ms > 0 || prev.by !== null) ? { ...state, revive: idle } : state;
  const helper = helperOf(state);
  if (!helper) {
    if (prev && prev.ms > 0) events.push({ type: 'reviveInterrupted' });
    return prev?.by === null && prev.ms === 0 ? state : { ...state, revive: idle };
  }
  const hp = helper.player.hp;
  let next: ReviveState;
  if (!prev || prev.by !== helper.id) next = { ms: dtMs, by: helper.id, byHp: hp, used };
  else if (hp < prev.byHp) {
    events.push({ type: 'reviveInterrupted' });
    next = { ms: 0, by: helper.id, byHp: hp, used };
  } else next = { ms: prev.ms + dtMs, by: helper.id, byHp: hp, used };
  if (next.ms < COOP_REVIVE.holdMs) return { ...state, revive: next };
  events.push({ type: 'revived', by: helper.id });
  const revivedHp = Math.max(1, Math.round(state.player.maxHp * COOP_REVIVE.hpShare));
  return { ...state, player: { ...state.player, hp: revivedHp }, revive: { ms: 0, by: null, byHp: 0, used: used + 1 } };
}
