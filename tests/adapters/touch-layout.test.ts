import { describe, expect, it } from 'vitest';
import { fitCanvas, MAX_DPR } from '../../src/adapters/fit';
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

describe('canvas fit', () => {
  it('keeps the desktop integer scale with the CSS size equal to the backing store', () => {
    expect(fitCanvas(1280, 720, 512, 320, 1, false)).toEqual({ pixelScale: 2, cssWidth: 1024, cssHeight: 640 });
    // The device pixel ratio does not change desktop.
    expect(fitCanvas(1280, 720, 512, 320, 3, false)).toEqual({ pixelScale: 2, cssWidth: 1024, cssHeight: 640 });
  });

  it('on touch fills the screen (contain) and sizes the backing store by a capped DPR', () => {
    const fit = fitCanvas(844, 390, 512, 320, 3, true);
    expect(fit.cssHeight).toBeCloseTo(390);
    expect(fit.cssWidth).toBeCloseTo(624);
    // 1.22 CSS scale x DPR capped at 2 -> backing scale rounds to 2.
    expect(fit.pixelScale).toBe(Math.round((390 / 320) * MAX_DPR));
    expect(MAX_DPR).toBe(2);
  });

  it('never goes below scale 1', () => {
    expect(fitCanvas(300, 200, 512, 320, 1, true).pixelScale).toBe(1);
    expect(fitCanvas(300, 200, 512, 320, 1, false).pixelScale).toBe(1);
  });
});
