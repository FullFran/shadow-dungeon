import { cooldownLeft } from '../core/boosts';
import { playerStats } from '../core/items';
import type { PlayerState } from '../core/state';
import { MOVES, type MoveId } from '../data/moves';
import { MAX_RANK } from '../data/tutor';

/**
 * What a touch slot button shows (pure): on touch the buttons carry what the
 * canvas HUD's slot windows show on desktop, so those windows stay off the
 * thumbs. The move's name, its cooldown as a sweep (share still to run) with
 * whole seconds left, the Mejoras bought (pips), whether it can be used now,
 * whether it is running (or charging, with the charge share).
 */
export interface SlotButtonState {
  moveId: MoveId;
  /** Share of the cooldown still to run, 0 when ready. */
  cooldown: number;
  /** Whole seconds of cooldown left (rounded up), null when ready. */
  seconds: number | null;
  rank: number;
  maxRank: number;
  /** Off cooldown and affordable. */
  ready: boolean;
  /** Its move is the one running (or its boost's buff is up). */
  active: boolean;
  /** Share of the full charge held so far, 0 unless charging. */
  charge: number;
}

export function slotButtonState(player: PlayerState, slotIndex: number): SlotButtonState | null {
  const moveId = player.loadout[slotIndex];
  if (!moveId) return null;
  const move = MOVES[moveId];
  const left = cooldownLeft(player, moveId);
  const total = move.cooldownMs ?? 0;
  const cooling = left > 0 && total > 0;
  const affordable = player.stamina >= move.staminaCost * playerStats(player).staminaCost;
  const action = player.action;
  const mine = action?.slotIndex === slotIndex;
  const maxHold = move.charge?.at(-1)?.holdMs ?? 0;
  return {
    moveId,
    cooldown: cooling ? Math.min(1, left / total) : 0,
    seconds: cooling ? Math.ceil(left / 1000) : null,
    rank: Math.min(MAX_RANK, Math.max(0, Math.floor(player.moveRanks?.[moveId] ?? 0))),
    maxRank: MAX_RANK,
    ready: !cooling && affordable,
    active: mine || player.buff?.moveId === moveId,
    charge: mine && action?.phase === 'charging' && maxHold > 0 ? Math.min(1, action.chargeMs / maxHold) : 0,
  };
}
