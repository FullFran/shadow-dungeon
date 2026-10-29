/**
 * Which build the player runs (issue #7): the package.json version and the
 * short git commit, injected by vite.config.ts at build time. Outside a Vite
 * build (the tests) both are "dev".
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : 'dev';

/** "v0.9.0 · e60dcb9"; just "dev" for a build without a version. */
export function buildLabel(version: string = APP_VERSION, build: string = APP_BUILD): string {
  return version === 'dev' ? build : `v${version} · ${build}`;
}
