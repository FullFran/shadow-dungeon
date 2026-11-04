import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { bannerVisible, installCard, runInstallAction } from '../../src/pwa/install';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The install notice as a relic card (odd/tasks/account-drawer-and-menus.md T3): same state, new presentation. */
describe('install card actions map to the existing install state', () => {
  it('offers one primary and two quiet choices where the browser has a prompt', () => {
    const card = installCard('prompt')!;
    expect(card.primary).toEqual({ action: 'install', label: 'pwa.installNow' });
    expect(card.secondary).toEqual({ action: 'later', label: 'pwa.later' });
    expect(card.never).toEqual({ action: 'never', label: 'pwa.never' });
    expect(card.bodyKeys).toEqual(['pwa.card.fullscreen', 'pwa.card.app']);
  });

  it('shows the Share steps on iOS, with an acknowledge primary and no "later"', () => {
    const card = installCard('ios')!;
    expect(card.primary).toEqual({ action: 'later', label: 'pwa.ok' });
    expect(card.secondary).toBeUndefined();
    expect(card.bodyKeys).toEqual(['pwa.ios']);
  });

  it('has no card when there is nothing to offer', () => {
    expect(installCard('none')).toBeNull();
    expect(installCard('manual')).toBeNull();
  });

  it('install closes the card and starts the install, keeping the invitation for later pages', () => {
    const store = memoryStore();
    expect(runInstallAction('install', store)).toEqual({ close: true, install: true });
    expect(bannerVisible(store, 'prompt', false)).toBe(true);
  });

  it('later closes for this page only', () => {
    const store = memoryStore();
    expect(runInstallAction('later', store)).toEqual({ close: true, install: false });
    expect(bannerVisible(store, 'prompt', true)).toBe(false);
    expect(bannerVisible(store, 'prompt', false)).toBe(true);
  });

  it('never closes for good', () => {
    const store = memoryStore();
    expect(runInstallAction('never', store)).toEqual({ close: true, install: false });
    expect(bannerVisible(store, 'prompt', false)).toBe(false);
    expect(bannerVisible(store, 'ios', false)).toBe(false);
  });

  it('every label and line exists in both languages', () => {
    for (const offer of ['prompt', 'ios'] as const) {
      const card = installCard(offer)!;
      const keys = [card.titleKey, ...card.bodyKeys, card.primary.label, card.secondary?.label, card.never.label].filter((k): k is string => Boolean(k));
      for (const language of LANGUAGES) for (const key of keys) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
    }
  });
});
