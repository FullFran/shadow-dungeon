import { describe, expect, it } from 'vitest';
import { sceneOf } from '../../src/ui/dismiss';

/** Owner, 2026-11-03: on /gacha any press went back to the title (the page has its own Back; it is not a menu window). */
describe('dismiss scene', () => {
  const doc = (present: string[]) => ({ querySelector: (sel: string) => (sel.split(',').some((s) => present.includes(s.trim())) ? {} : null) }) as unknown as ParentNode;
  it('treats the gacha page as a full page, never a menu to close', () => {
    expect(sceneOf(doc(['.gp'])).kind).toBe('other');
    expect(sceneOf(doc([])).kind).toBe('menu');
  });
  it('an open account drawer is an overlay, also over the title hub', () => {
    expect(sceneOf(doc(['.drawer-veil', '.hub'])).kind).toBe('overlay');
  });
});
