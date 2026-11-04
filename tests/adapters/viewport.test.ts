import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/core/dungeon';
import { floorArena } from '../../src/core/floor';
import { cameraView, pixelScaleFor } from '../../src/adapters/view';
import { MAX_DPR } from '../../src/adapters/fit';
import { playViewport } from '../../src/adapters/viewport';

/** Desktop windows, phones both ways, a tablet, a 4K screen and a tiny window. */
const WINDOWS: readonly (readonly [number, number])[] = [
  [1440, 900],
  [1366, 768],
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
  [3840, 2160],
  [1024, 640],
  [800, 600],
  [844, 390],
  [390, 844],
  [932, 430],
  [740, 360],
  [1180, 820],
  [320, 480],
  [1537, 961],
];

describe('playViewport: the play view fills the window', () => {
  for (const touch of [false, true]) {
    for (const dpr of [1, 2, 3]) {
      for (const [w, h] of WINDOWS) {
        const name = `${w}x${h} dpr ${dpr}${touch ? ' touch' : ''}`;
        it(`${name}: covers the window to its last pixel, never stretched`, () => {
          const v = playViewport(w, h, dpr, touch);
          // No letterbox: the canvas covers the window and overshoots by less than one world pixel.
          expect(v.cssWidth).toBeGreaterThanOrEqual(w - 1e-6);
          expect(v.cssHeight).toBeGreaterThanOrEqual(h - 1e-6);
          expect(v.cssWidth).toBeLessThan(w + v.zoom + 1e-6);
          expect(v.cssHeight).toBeLessThan(h + v.zoom + 1e-6);
          // Whole world pixels in the view, whole backing pixels per world pixel (crisp).
          expect(Number.isInteger(v.viewWidth) && Number.isInteger(v.viewHeight)).toBe(true);
          expect(Number.isInteger(v.pixelScale) && v.pixelScale >= 1).toBe(true);
          // Same factor on both axes: nearest-neighbour scaling, never a stretch.
          expect(v.cssWidth / (v.viewWidth * v.pixelScale)).toBeCloseTo(v.cssHeight / (v.viewHeight * v.pixelScale), 9);
          expect(v.cssWidth / v.viewWidth).toBeCloseTo(v.zoom, 9);
          expect(v.cssHeight / v.viewHeight).toBeCloseTo(v.zoom, 9);
        });
      }
    }
  }

  it('desktop keeps the integer pixel scale it always had (sprites do not change size, the view grows)', () => {
    for (const [w, h] of WINDOWS) {
      const v = playViewport(w, h, 2, false);
      expect(v.zoom).toBe(pixelScaleFor(w, h, 512, 320));
      expect(v.pixelScale).toBe(v.zoom);
    }
    expect(playViewport(1440, 900, 1, false)).toMatchObject({ zoom: 2, viewWidth: 720, viewHeight: 450, cssWidth: 1440, cssHeight: 900 });
    expect(playViewport(1280, 720, 1, false)).toMatchObject({ zoom: 2, viewWidth: 640, viewHeight: 360 });
  });

  it('touch scales by the short side so the view is 320 world pixels across the short side both ways round', () => {
    const land = playViewport(844, 390, 3, true);
    const port = playViewport(390, 844, 3, true);
    expect(land.viewHeight).toBe(320);
    expect(port.viewWidth).toBe(320);
    expect(land.viewWidth).toBeGreaterThan(640);
    expect(port.viewHeight).toBeGreaterThan(640);
    // The backing store follows the device pixel ratio up to the cap.
    expect(land.pixelScale).toBe(Math.round(land.zoom * MAX_DPR));
    expect(playViewport(844, 390, 1, true).pixelScale).toBe(Math.round(land.zoom));
  });

  it('a small window never drops under one world pixel per CSS pixel', () => {
    const v = playViewport(300, 200, 1, false);
    expect(v.zoom).toBe(1);
    expect(v.viewWidth).toBe(300);
    expect(v.viewHeight).toBe(200);
  });
});

describe('camera on a view larger than the map', () => {
  const arena = floorArena(generateFloor(7, 1));
  it('centres a map that is smaller than the view and clamps one that is larger', () => {
    const v = playViewport(3840, 2160, 1, false);
    const centred = cameraView({ x: 10, y: 10 }, v.viewWidth, v.viewHeight, { width: 200, height: 120 });
    expect(centred.x).toBe((200 - v.viewWidth) / 2);
    expect(centred.y).toBe((120 - v.viewHeight) / 2);
    const clamped = cameraView({ x: 0, y: 0 }, 720, 450, arena);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });
});
