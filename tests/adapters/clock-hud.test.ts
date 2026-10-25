import { describe, expect, it } from 'vitest';
import { bonusText, clockLook, tickDue } from '../../src/adapters/clock-hud';
import { PALETTE } from '../../src/ui/tokens';

describe('run clock HUD', () => {
  it('is plain above the low mark, red and pulsing under it', () => {
    expect(clockLook(120_000, 30_000, 0)).toEqual({ text: '2:00', color: PALETTE.text, scale: 1 });
    const low = [0, 250, 500, 750].map((now) => clockLook(12_000, 30_000, now));
    expect(low.every((l) => l.color === PALETTE.danger && l.text === '0:12')).toBe(true);
    expect(new Set(low.map((l) => l.scale.toFixed(3))).size).toBeGreaterThan(1);
    expect(Math.max(...low.map((l) => l.scale))).toBeLessThanOrEqual(1.15);
  });

  it('ticks once per whole second while low, never above the mark or at zero', () => {
    expect(tickDue(20_010, 19_990, 30_000)).toBe(true);
    expect(tickDue(19_990, 19_970, 30_000)).toBe(false);
    expect(tickDue(40_010, 39_990, 30_000)).toBe(false);
    expect(tickDue(1, 0, 30_000)).toBe(false);
  });

  it('shows added time in whole seconds', () => {
    expect(bonusText(40_000)).toBe('+40 s');
    expect(bonusText(59_600)).toBe('+60 s');
  });
});
