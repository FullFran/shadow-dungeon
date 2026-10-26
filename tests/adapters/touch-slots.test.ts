import { describe, expect, it } from 'vitest';
import type { PlayerState } from '../../src/core/state';
import { MOVES, type MoveId } from '../../src/data/moves';
import { MAX_RANK } from '../../src/data/tutor';
import { slotButtonState } from '../../src/adapters/touch-slots';

const withCooldown = (Object.values(MOVES).find((m) => (m.cooldownMs ?? 0) > 0)!).id as MoveId;
const charged = (Object.values(MOVES).find((m) => m.charge)!).id as MoveId;
const plain = 'shadow-claw' as MoveId;

const player = (o: Partial<PlayerState> = {}): PlayerState =>
  ({ loadout: [plain, charged, withCooldown, null], stamina: 100, cooldowns: {}, moveRanks: {}, action: null, items: [], ...o }) as unknown as PlayerState;

describe('slot button state (touch)', () => {
  it('is empty for an empty slot', () => {
    expect(slotButtonState(player(), 3)).toBeNull();
  });

  it('names the move and is ready with no cooldown, rank or action', () => {
    expect(slotButtonState(player(), 0)).toEqual({ moveId: plain, cooldown: 0, seconds: null, rank: 0, maxRank: MAX_RANK, ready: true, active: false, charge: 0 });
  });

  it('shows the cooldown as the share still to run and whole seconds left, and is not ready meanwhile', () => {
    const total = MOVES[withCooldown].cooldownMs!;
    const state = slotButtonState(player({ cooldowns: { [withCooldown]: total / 2 } }), 2)!;
    expect(state.cooldown).toBeCloseTo(0.5);
    expect(state.seconds).toBe(Math.ceil(total / 2 / 1000));
    expect(state.ready).toBe(false);
  });

  it('is not ready when the stamina cannot pay the move', () => {
    const cost = MOVES[plain].staminaCost;
    if (cost <= 0) return;
    expect(slotButtonState(player({ stamina: cost - 1 }), 0)!.ready).toBe(false);
  });

  it('carries the bought ranks, capped', () => {
    expect(slotButtonState(player({ moveRanks: { [plain]: 2 } }), 0)!.rank).toBe(Math.min(2, MAX_RANK));
    expect(slotButtonState(player({ moveRanks: { [plain]: 99 } }), 0)!.rank).toBe(MAX_RANK);
  });

  it('is active while its move runs and shows the charge share while charging', () => {
    const maxHold = MOVES[charged].charge!.at(-1)!.holdMs;
    const charging = player({ action: { slotIndex: 1, moveId: charged, phase: 'charging', phaseMs: 0, chargeMs: maxHold / 2, chargeLevel: 0, aimDir: { x: 1, y: 0 }, mouseAim: false, hitIds: [], startTick: 0 } as unknown as PlayerState['action'] });
    const state = slotButtonState(charging, 1)!;
    expect(state.active).toBe(true);
    expect(state.charge).toBeCloseTo(0.5);
    expect(slotButtonState(charging, 0)!.active).toBe(false);
  });
});
