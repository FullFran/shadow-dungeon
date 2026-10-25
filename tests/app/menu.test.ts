import { describe, expect, it } from 'vitest';
import { PAUSE_ON_MENU, simulationPaused } from '../../src/app/menu';

describe('Esc menu pause policy', () => {
  it('pauses the solo demo while the menu is open', () => {
    expect(PAUSE_ON_MENU).toBe(true);
    expect(simulationPaused(true)).toBe(true);
    expect(simulationPaused(false)).toBe(false);
  });

  it('a no-pause policy (future co-op) keeps the game running with the menu open', () => {
    expect(simulationPaused(true, false)).toBe(false);
    expect(simulationPaused(false, false)).toBe(false);
  });
});
