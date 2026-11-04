import { describe, expect, it } from 'vitest';
import { touchActive, TOUCH_MODES } from '../../src/adapters/touch-mode';

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
});
