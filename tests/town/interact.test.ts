import { describe, expect, it } from 'vitest';
import { INTERACT_RANGE, nearestInteractable, type Interactable } from '../../src/town/interact';

const things: Interactable[] = [
  { id: 'a', pos: { x: 100, y: 100 } },
  { id: 'b', pos: { x: 160, y: 100 } },
];

describe('interaction range', () => {
  it('picks nothing when everything is out of range', () => {
    expect(nearestInteractable({ x: 100, y: 100 + INTERACT_RANGE + 1 }, things)).toBeNull();
  });

  it('picks a target exactly at the range limit', () => {
    expect(nearestInteractable({ x: 100, y: 100 + INTERACT_RANGE }, things)?.id).toBe('a');
  });

  it('picks the nearest of several in range', () => {
    expect(nearestInteractable({ x: 140, y: 110 }, things)?.id).toBe('b');
    expect(nearestInteractable({ x: 120, y: 110 }, things)?.id).toBe('a');
  });

  it('covers a neighbouring tile but not two tiles away', () => {
    expect(INTERACT_RANGE).toBeGreaterThanOrEqual(32 * Math.SQRT2);
    expect(INTERACT_RANGE).toBeLessThan(64);
  });
});
