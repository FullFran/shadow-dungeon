import { describe, expect, it } from 'vitest';
import { PAD, padFrame, padMemory, type PadState } from '../../src/adapters/gamepad';
import { IDLE_TOUCH } from '../../src/adapters/touch';

const pad = (buttons: number[] = []): PadState => ({ axes: [0, 0, 0, 0], pressed: new Set(buttons) });

describe('the bag on a controller (odd/tasks/items-bag.md)', () => {
  it('RT, D-pad up and down did nothing in combat before the bag (they were free)', () => {
    for (const button of [PAD.rt, PAD.up, PAD.down]) {
      const { frame } = padFrame(pad([button]), padMemory(null));
      expect({ ...frame, item: false, itemCycle: 0 }, String(button)).toEqual({ ...IDLE_TOUCH, item: false, itemCycle: 0 });
    }
  });

  it('RT uses the selected consumable once per press', () => {
    const first = padFrame(pad([PAD.rt]), padMemory(null));
    expect(first.frame.item).toBe(true);
    expect(padFrame(pad([PAD.rt]), first.memory).frame.item ?? false).toBe(false);
  });

  it('D-pad down selects the next slot, up the previous one, once per press', () => {
    expect(padFrame(pad([PAD.down]), padMemory(null)).frame.itemCycle).toBe(1);
    expect(padFrame(pad([PAD.up]), padMemory(null)).frame.itemCycle).toBe(-1);
    const held = padFrame(pad([PAD.down]), padMemory(null));
    expect(padFrame(pad([PAD.down]), held.memory).frame.itemCycle ?? 0).toBe(0);
  });
});
