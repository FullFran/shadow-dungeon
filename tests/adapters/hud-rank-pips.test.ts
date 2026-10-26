import { describe, expect, it } from 'vitest';
import { slotRankPips } from '../../src/adapters/hud';
import { MAX_RANK, moveTier } from '../../src/data/tutor';
import { TIER_COLORS } from '../../src/ui/tokens';

const slot = { x: 100, y: 200, width: 88, height: 30 };

describe('HUD slot rank pips', () => {
  it('draws nothing for an unranked move (the plain HUD is unchanged)', () => {
    expect(slotRankPips({}, 'shadow-claw', slot)).toBeNull();
    expect(slotRankPips({ moveRanks: { 'shadow-claw': 0 } }, 'shadow-claw', slot)).toBeNull();
    expect(slotRankPips({ moveRanks: { 'play-rough': 2 } }, 'shadow-claw', slot)).toBeNull();
  });

  it('lays out MAX_RANK pips at the top right, the earned ones filled first', () => {
    const one = slotRankPips({ moveRanks: { 'shadow-claw': 1 } }, 'shadow-claw', slot);
    expect(one).not.toBeNull();
    expect(one!.pips).toHaveLength(MAX_RANK);
    expect(one!.pips.map((p) => p.filled)).toEqual([true, false]);
    const two = slotRankPips({ moveRanks: { 'shadow-claw': 2 } }, 'shadow-claw', slot)!;
    expect(two.pips.map((p) => p.filled)).toEqual([true, true]);
    // Left to right, inside the window, clear of the border, on the key-hint line.
    const [a, b] = two.pips;
    expect(a!.x).toBeLessThan(b!.x);
    expect(b!.x + b!.size).toBeLessThanOrEqual(slot.x + slot.width - 5);
    expect(a!.y).toBeGreaterThanOrEqual(slot.y + 3);
    expect(a!.y + a!.size).toBeLessThanOrEqual(slot.y + 13);
    // Pips do not overlap each other.
    expect(a!.x + a!.size).toBeLessThan(b!.x);
  });

  it('clamps an out-of-range rank to MAX_RANK filled pips', () => {
    const many = slotRankPips({ moveRanks: { 'shadow-claw': 7 } }, 'shadow-claw', slot)!;
    expect(many.pips.every((p) => p.filled)).toBe(true);
    expect(many.pips).toHaveLength(MAX_RANK);
  });

  it('wears the move tier colour and moves the cooldown label left of the pips', () => {
    const basic = slotRankPips({ moveRanks: { 'shadow-claw': 1 } }, 'shadow-claw', slot)!;
    expect(moveTier('shadow-claw')).toBe('basic');
    expect(basic.colour).toBe(TIER_COLORS.basic);
    expect(basic.cooldownRight).toBeLessThan(basic.pips[0]!.x);
    const master = slotRankPips({ moveRanks: { 'wood-hammer': 2 } }, 'wood-hammer', slot)!;
    expect(moveTier('wood-hammer')).toBe('master');
    expect(master.colour).toBe(TIER_COLORS.master);
    expect(new Set(Object.values(TIER_COLORS)).size).toBe(3);
  });
});
