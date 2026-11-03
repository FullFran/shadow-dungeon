import { describe, expect, it } from 'vitest';
import { gachaUrl, isGachaPath, leaveUrl } from '../../src/app/gacha-route';

/** The /gacha page route (owner, 2026-11-03): found by the end of the path, so it works under any Vite base. */
describe('gacha route', () => {
  it('knows the page by the end of the path, with or without a slash and under a sub-path', () => {
    for (const path of ['/gacha', '/gacha/', '/repo/gacha', '/a/b/gacha/']) expect(isGachaPath(path), path).toBe(true);
    for (const path of ['/', '/repo/', '/repo/index.html', '/gacha-x', '/repo/gachas', '/gacha/extra']) expect(isGachaPath(path), path).toBe(false);
  });

  it('builds the page url beside the current page, keeping the base', () => {
    expect(gachaUrl('/')).toBe('/gacha');
    expect(gachaUrl('/repo/')).toBe('/repo/gacha');
    expect(gachaUrl('/repo/index.html')).toBe('/repo/gacha');
    expect(gachaUrl('/repo/gacha')).toBe('/repo/gacha');
  });

  it('leaves to the app root of the same base', () => {
    expect(leaveUrl('/gacha')).toBe('/');
    expect(leaveUrl('/repo/gacha/')).toBe('/repo/');
    expect(leaveUrl('/repo/')).toBe('/repo/');
  });
});
