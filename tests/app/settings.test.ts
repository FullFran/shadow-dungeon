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

  it('defaults to the species loadout, hold lock and the given language', () => {
    expect(defaultSettings('en')).toEqual({ language: 'en', lockMode: 'hold', loadout: ['shadow-claw', 'play-rough'] });
  });

  it('round-trips through the store', () => {
    const store = memoryStore();
    const settings = { language: 'en' as const, lockMode: 'toggle' as const, loadout: ['shadow-sneak', 'shadow-ball'] as const };
    saveSettings(store, settings);
    expect(loadSettings(store, defaultSettings('es'))).toEqual(settings);
  });

  it('falls back field by field on missing, corrupt or invalid data', () => {
    const fallback = defaultSettings('es');
    const store: KeyValueStore = memoryStore();
    expect(loadSettings(store, fallback)).toEqual(fallback);
    store.set('mazmorra-sombria.settings', '{not json');
    expect(loadSettings(store, fallback)).toEqual(fallback);
    // A heavy move in the fast slot and an unknown language are rejected; the valid lock mode is kept.
    store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'fr', lockMode: 'toggle', loadout: ['play-rough', 'shadow-ball'] }));
    expect(loadSettings(store, fallback)).toEqual({ ...fallback, lockMode: 'toggle' });
  });
});
