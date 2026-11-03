import { describe, expect, it } from 'vitest';
import { cameraFor, STALL } from '../../src/ui/gacha-stall';

/** Mimikyu's stall scene for the gacha page (src/ui/gacha-stall.ts; .claude/skills/pixel-craft). */
describe('stall layout', () => {
  it('keeps the scene on a 320x200 buffer (about 200 rows: the sprite and the scene share one pixel)', () => {
    expect([STALL.w, STALL.h]).toEqual([320, 200]);
  });

  it('stands Mimikyu on the counter top, inside the counter and inside the safe area every viewport shows', () => {
    const { stand, counter, safe } = STALL;
    expect(stand.x).toBeGreaterThan(counter.x0);
    expect(stand.x).toBeLessThan(counter.x1);
    // Its feet sink a pixel or two into the plank, never float above it or sit below the counter.
    expect(stand.y).toBeGreaterThanOrEqual(counter.top);
    expect(stand.y).toBeLessThanOrEqual(counter.top + 3);
    expect(stand.x).toBeGreaterThanOrEqual(safe.x0);
    expect(stand.x).toBeLessThanOrEqual(safe.x1);
    expect(stand.y).toBeLessThanOrEqual(safe.y1);
    expect(stand.y - 48).toBeGreaterThanOrEqual(safe.y0);
  });

  it('hangs the lantern inside the safe area', () => {
    const { lantern, safe } = STALL;
    expect(lantern.x).toBeGreaterThan(safe.x0);
    expect(lantern.x).toBeLessThan(safe.x1);
    expect(lantern.y).toBeGreaterThan(safe.y0);
    expect(lantern.r).toBeGreaterThan(20);
  });
});

describe('camera', () => {
  it('covers the viewport with the buffer in quarter steps and centres it', () => {
    const wide = cameraFor(1440, 900);
    expect(wide.scale).toBe(4.5);
    expect(wide.x).toBe(0);
    expect(wide.y).toBe(0);
    const tall = cameraFor(1000, 750);
    expect(tall.scale).toBe(3.75);
    expect(tall.x).toBeLessThan(0);
    const phone = cameraFor(844, 390);
    expect(phone.scale).toBe(2.75);
    expect(phone.y).toBeLessThan(0);
    for (const cam of [wide, tall, phone]) {
      expect(STALL.w * cam.scale + cam.x * 2).toBeGreaterThanOrEqual(0);
    }
  });

  // The page is the viewport minus the legal notice under it (about 40 px): these are the heights the camera really gets.
  it('keeps the whole safe area on screen at the three target sizes, favouring the awning over the floor', () => {
    for (const [w, h] of [
      [1440, 860],
      [1000, 700],
      [844, 335],
    ] as const) {
      const cam = cameraFor(w, h);
      const { safe } = STALL;
      expect(safe.x0 * cam.scale + cam.x, `${w}x${h} left`).toBeGreaterThanOrEqual(-0.5);
      expect(safe.x1 * cam.scale + cam.x, `${w}x${h} right`).toBeLessThanOrEqual(w + 0.5);
      expect(safe.y0 * cam.scale + cam.y, `${w}x${h} top`).toBeGreaterThanOrEqual(-0.5);
      expect(safe.y1 * cam.scale + cam.y, `${w}x${h} bottom`).toBeLessThanOrEqual(h + 0.5);
    }
  });
});
