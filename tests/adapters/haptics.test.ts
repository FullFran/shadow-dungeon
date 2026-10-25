import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../../src/core/state';
import { HAPTICS, hapticPulse } from '../../src/adapters/haptics';

describe('haptics', () => {
  it('pulses on a hit taken and on a perfect dodge, the hit winning', () => {
    expect(hapticPulse([])).toBeNull();
    expect(hapticPulse([{ type: 'perfectDodge' }] as GameEvent[])).toBe(HAPTICS.perfectDodgeMs);
    expect(hapticPulse([{ type: 'playerHurt', damage: 3 }] as GameEvent[])).toBe(HAPTICS.hurtMs);
    expect(hapticPulse([{ type: 'perfectDodge' }, { type: 'playerHurt', damage: 3 }] as GameEvent[])).toBe(HAPTICS.hurtMs);
  });

  it('keeps pulses short', () => {
    expect(HAPTICS.hurtMs).toBeLessThanOrEqual(60);
    expect(HAPTICS.perfectDodgeMs).toBeLessThanOrEqual(30);
  });
});
