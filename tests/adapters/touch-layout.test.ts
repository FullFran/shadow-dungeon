import { describe, expect, it } from 'vitest';
import { primaryPointerIsFinger, touchActive, TOUCH_MODES } from '../../src/adapters/touch-mode';

describe('touch mode', () => {
  it('offers Auto, On and Off', () => {
    expect(TOUCH_MODES).toEqual(['auto', 'on', 'off']);
  });

  it('auto turns on after the first touch; on and off ignore it', () => {
    expect(touchActive('auto', false)).toBe(false);
    expect(touchActive('auto', true)).toBe(true);
    expect(touchActive('on', false)).toBe(true);
    expect(touchActive('off', true)).toBe(false);
  });

  it('a phone (coarse pointer, no hover) counts as touched from the start; a mouse or a touch laptop does not', () => {
    const device = (finger: boolean) => (query: string) => ({ matches: finger && query === '(hover: none) and (pointer: coarse)' });
    expect(primaryPointerIsFinger(device(true))).toBe(true);
    expect(primaryPointerIsFinger(device(false))).toBe(false);
    expect(primaryPointerIsFinger(undefined)).toBe(false);
  });
});
