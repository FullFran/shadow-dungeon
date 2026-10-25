import { pixelScaleFor } from './view';

/** Highest device pixel ratio the canvas backing store follows (phones report 3+; 2 keeps the fill rate sane). */
export const MAX_DPR = 2;

export interface CanvasFit {
  /** Backing store pixels per world pixel (the renderer's transform). */
  pixelScale: number;
  /** On-screen CSS size of the canvas. */
  cssWidth: number;
  cssHeight: number;
}

/**
 * Canvas size for a window. Desktop keeps the integer scale with one canvas
 * pixel per CSS pixel (unchanged behaviour). Touch fills the screen: the CSS
 * size is the largest that fits ("contain", so a non-integer factor), and the
 * backing store follows the device pixel ratio capped at `MAX_DPR`, rounded
 * to a whole scale so sprites stay crisp after the browser resamples.
 */
export function fitCanvas(windowWidth: number, windowHeight: number, viewWidth: number, viewHeight: number, dpr: number, touch: boolean): CanvasFit {
  if (!touch) {
    const scale = pixelScaleFor(windowWidth, windowHeight, viewWidth, viewHeight);
    return { pixelScale: scale, cssWidth: viewWidth * scale, cssHeight: viewHeight * scale };
  }
  const css = Math.min(windowWidth / viewWidth, windowHeight / viewHeight);
  const ratio = Math.min(MAX_DPR, Math.max(1, dpr || 1));
  return { pixelScale: Math.max(1, Math.round(css * ratio)), cssWidth: viewWidth * css, cssHeight: viewHeight * css };
}

/**
 * Sizes `canvas` for the window and returns the renderer scale. On touch the
 * CSS size is set explicitly; on desktop it is cleared (backing store = CSS size).
 */
export function fitCanvasToWindow(canvas: HTMLCanvasElement, viewWidth: number, viewHeight: number, touch: boolean): number {
  const fit = fitCanvas(window.innerWidth, window.innerHeight, viewWidth, viewHeight, window.devicePixelRatio, touch);
  const width = viewWidth * fit.pixelScale;
  const height = viewHeight * fit.pixelScale;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const cssWidth = touch ? `${fit.cssWidth}px` : '';
  const cssHeight = touch ? `${fit.cssHeight}px` : '';
  if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
  if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
  return fit.pixelScale;
}
