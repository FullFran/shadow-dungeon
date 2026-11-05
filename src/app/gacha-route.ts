/**
 * The /gacha page's route (owner, 2026-11-03: "Gacha ... en una página aparte /gacha").
 * Vite builds with a relative base (`./`, vite.config.ts) so the game runs from any sub-path
 * (GitHub Pages serves it under /<repo>/): the route is therefore found by the END of the
 * path, never by an absolute one, and its url is built beside the page that is open. The
 * page is one segment deep, so the relative `./assets/...` and `./sprites/...` urls resolve
 * from /gacha to the same folder as from the root.
 */
const PAGE = 'gacha';

/** Whether the path ends in the gacha page (`/gacha`, `/gacha/`, `/repo/gacha`). */
export const isGachaPath = (pathname: string): boolean => /(^|\/)gacha\/?$/.test(pathname);

/** The app's root path of the same base (`/repo/gacha/` -> `/repo/`; the root itself unchanged). */
export const leaveUrl = (pathname: string): string => {
  const dir = isGachaPath(pathname) ? pathname.replace(/gacha\/?$/, '') : pathname;
  return dir.endsWith('/') ? dir : dir.replace(/[^/]*$/, '');
};

/** The gacha page's path beside the open page (`/repo/` or `/repo/index.html` -> `/repo/gacha`). */
export const gachaUrl = (pathname: string): string => `${leaveUrl(pathname)}${PAGE}`;
