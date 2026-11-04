import { MAX_DPR, playViewport, type PlayViewport } from './viewport';

export { MAX_DPR };

/**
 * Sizes `canvas` to fill the window (see `playViewport`) and returns the view it
 * shows. The backing store is the view at the whole pixel scale; the CSS size is
 * set explicitly (the window, or a hair more) and the page clips the overshoot.
 */
export function fitCanvasToWindow(canvas: HTMLCanvasElement, touch: boolean): PlayViewport {
  const fit = playViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio, touch);
  const width = fit.viewWidth * fit.pixelScale;
  const height = fit.viewHeight * fit.pixelScale;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const cssWidth = `${fit.cssWidth}px`;
  const cssHeight = `${fit.cssHeight}px`;
  if (canvas.style.width !== cssWidth) canvas.style.width = cssWidth;
  if (canvas.style.height !== cssHeight) canvas.style.height = cssHeight;
  return fit;
}
