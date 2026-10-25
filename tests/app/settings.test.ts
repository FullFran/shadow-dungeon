import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { defaultSettings, loadSettings, saveSettings, slotOptions } from '../../src/app/settings';

describe('storage port', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('memory store keeps values', () => {
    const store = memoryStore();
    expect(store.get('a')).toBeNull();
    store.set('a', '1');
    expect(store.get('a')).toBe('1');
  });

  it('browser store survives a missing or throwing localStorage', () => {
    // No localStorage at all (stubbed so the host runtime's own storage never leaks in).
    vi.stubGlobal('localStorage', undefined);
    expect(() => browserStore().set('a', '1')).not.toThrow();
    expect(browserStore().get('a')).toBeNull();

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const store = browserStore();
    expect(() => store.set('a', '1')).not.toThrow();
    expect(store.get('a')).toBeNull();
  });

  it('browser store uses localStorage when it works', () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    browserStore().set('a', '1');
    expect(browserStore().get('a')).toBe('1');
  });
});

describe('settings', () => {
  it('offers only moves of the right slot kind', () => {
    expect(slotOptions('fast')).toEqual(['shadow-claw', 'shadow-sneak']);
    expect(slotOptions('heavy')).toEqual(['play-rough', 'shadow-ball']);
  });

  it('defaults to the species loadout, click-to-lock on and the given language', () => {
    expect(defaultSettings('en')).toEqual({ language: 'en', clickToLock: true, loadout: ['shadow-claw', 'play-rough'] });
  });

  it('round-trips through the store', () => {
    const store = memoryStore();
    const settings = { language: 'en' as const, clickToLock: false, loadout: ['shadow-sneak', 'shadow-ball'] as const };
    saveSettings(store, settings);
    expect(loadSettings(store, defaultSettings('es'))).toEqual(settings);
  });

  it('falls back field by field on missing, corrupt or invalid data', () => {
    const fallback = defaultSettings('es');
    const store: KeyValueStore = memoryStore();
    expect(loadSettings(store, fallback)).toEqual(fallback);
    store.set('mazmorra-sombria.settings', '{not json');
    expect(loadSettings(store, fallback)).toEqual(fallback);
    // A heavy move in the fast slot and an unknown language are rejected; the valid click-to-lock flag is kept.
    store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'fr', clickToLock: false, loadout: ['play-rough', 'shadow-ball'] }));
    expect(loadSettings(store, fallback)).toEqual({ ...fallback, clickToLock: false });
    store.set('mazmorra-sombria.settings', JSON.stringify({ clickToLock: 'yes' }));
    expect(loadSettings(store, fallback).clickToLock).toBe(true);
  });

  it('loads settings saved before the lock-mode option was removed', () => {
    const store = memoryStore();
    for (const lockMode of ['hold', 'toggle']) {
      store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'en', lockMode, loadout: ['shadow-sneak', 'play-rough'] }));
      const loaded = loadSettings(store, defaultSettings('es'));
      expect(loaded).toEqual({ language: 'en', clickToLock: true, loadout: ['shadow-sneak', 'play-rough'] });
      expect(loaded).not.toHaveProperty('lockMode');
    }
  });
});
