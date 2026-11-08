/**
 * A touch screen short enough that a screen must fit without scrolling: a phone held on its side and the small touch
 * tablets the fit audit covers (tools/mobile/fit-audit.mjs: up to 1024x600). Same rule as the stylesheets'
 * `html.touch` + `@media (max-height: 640px)`. Desktop (mouse) never matches.
 */
export const COMPACT_TOUCH_QUERY = '(max-height: 640px)';

export const isCompactTouch = (): boolean => document.documentElement.classList.contains('touch') && !!window.matchMedia?.(COMPACT_TOUCH_QUERY).matches;

/**
 * A pager measured while its window was still being built, or before the pixel and reading fonts settled, can hold a page that
 * is a few pixels too tall. Measure again once the window is on screen and the fonts are ready (the pager itself only watches
 * the size of its box, not of its items).
 */
export function remeasureSoon(pager: { refresh(): void }): void {
  const again = (): void => pager.refresh();
  requestAnimationFrame(() => requestAnimationFrame(again));
  setTimeout(again, 350);
  void document.fonts?.ready.then(again);
}
