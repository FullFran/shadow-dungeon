import { pixelScaleFor } from './view';

/** Highest device pixel ratio the canvas backing store follows (phones report 3+; 2 keeps the fill rate sane). */
export const MAX_DPR = 2;

/**
 * The play view (town, dungeons, Sima, shrine fights, solo and co-op): the
 * canvas covers the whole window and the logical view follows its aspect, so
 * a wide window shows more tiles instead of black bars. A phone held upright
 * is the exception: it shows its landscape view, scaled to the width. Pure math; the DOM
 * side is `fitCanvasToWindow` (src/adapters/fit.ts).
 *
 * Crispness: the world is never stretched. A world pixel is `zoom` CSS pixels
 * on both axes (a whole number on desktop; on touch the short side of the
 * window shows `TOUCH_SHORT_SIDE` world pixels) and `pixelScale` whole
 * backing-store pixels. The view is rounded up to whole world pixels, so the
 * canvas overshoots the window by less than one world pixel at the right and
 * bottom (clipped by the page) instead of leaving a gap.
 */

/** The size the game was drawn for; desktop keeps the pixel scale this gives, so sprites do not change size. */
export const BASE_VIEW = { width: 512, height: 320 } as const;

/** Touch: world pixels along the window's short side (the HUD panels are laid out for this much). */
export const TOUCH_SHORT_SIDE = 320;

export interface PlayViewport {
  /** Logical view in world pixels (the camera shows this much). */
  viewWidth: number;
  viewHeight: number;
  /** Backing-store pixels per world pixel (the renderer's transform), a whole number. */
  pixelScale: number;
  /** CSS pixels per world pixel. */
  zoom: number;
  /** On-screen CSS size of the canvas (the window or a hair more). */
  cssWidth: number;
  cssHeight: number;
}

/** Rounds up, forgiving float noise so an exact fit does not gain a pixel. */
const ceilFit = (value: number): number => Math.ceil(value - 1e-9);

export function playViewport(windowWidth: number, windowHeight: number, dpr: number, touch: boolean): PlayViewport {
  const w = Math.max(1, windowWidth);
  const h = Math.max(1, windowHeight);
  const ratio = Math.min(MAX_DPR, Math.max(1, dpr || 1));
  // A phone held upright keeps the small landscape screen (owner, 2026-11-06): the view it shows turned sideways,
  // scaled down to the width and letterboxed (the page centres it), instead of a tall portrait view.
  if (touch && h > w) {
    const land = playViewport(h, w, dpr, true);
    const zoom = w / land.viewWidth;
    return { viewWidth: land.viewWidth, viewHeight: land.viewHeight, pixelScale: Math.max(1, Math.round(zoom * ratio)), zoom, cssWidth: w, cssHeight: land.viewHeight * zoom };
  }
  const zoom = touch ? Math.max(1, Math.min(w, h) / TOUCH_SHORT_SIDE) : pixelScaleFor(w, h, BASE_VIEW.width, BASE_VIEW.height);
  // Desktop: one backing pixel per CSS pixel (unchanged); touch: the device pixel ratio, rounded to a whole scale.
  const pixelScale = touch ? Math.max(1, Math.round(zoom * ratio)) : zoom;
  const viewWidth = ceilFit(w / zoom);
  const viewHeight = ceilFit(h / zoom);
  return { viewWidth, viewHeight, pixelScale, zoom, cssWidth: viewWidth * zoom, cssHeight: viewHeight * zoom };
}
