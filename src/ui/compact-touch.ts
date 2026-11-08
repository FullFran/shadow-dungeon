/**
 * A touch screen short enough that a screen must fit without scrolling: a phone held on its side and the small touch
 * tablets the fit audit covers (tools/mobile/fit-audit.mjs: up to 1024x600). Same rule as the stylesheets'
 * `html.touch` + `@media (max-height: 640px)`. Desktop (mouse) never matches.
 */
export const COMPACT_TOUCH_QUERY = '(max-height: 640px)';

export const isCompactTouch = (): boolean => document.documentElement.classList.contains('touch') && !!window.matchMedia?.(COMPACT_TOUCH_QUERY).matches;
