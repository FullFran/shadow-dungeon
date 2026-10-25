import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserStore, memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { defaultSettings, loadSettings, saveSettings, slotOptions, withSpecies, withStarter } from '../../src/app/settings';
import { SPECIES } from '../../src/data/species';

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
    expect(slotOptions('fast', 'cubone')).toEqual(['bone-club', 'bone-rush']);
    expect(slotOptions('heavy', 'litwick')).toEqual(['hex', 'inferno']);
  });

  const SOUND = { masterVolume: 0.7, musicVolume: 0.5, sfxVolume: 0.8, muted: false, touchMode: 'auto', autoAim: true, haptics: true };

  it('defaults to the species loadout, toggle lock with click-to-lock on, sound on and the given language', () => {
    expect(defaultSettings('en')).toEqual({ language: 'en', lockType: 'toggle', clickToLock: true, species: 'mimikyu', starterChosen: false, loadout: ['shadow-claw', 'play-rough'], ...SOUND });
  });

  it('round-trips through the store', () => {
    const store = memoryStore();
    const settings = {
      language: 'en' as const,
      lockType: 'clickOnly' as const,
      clickToLock: false,
      species: 'mimikyu' as const,
      starterChosen: true,
      loadout: ['shadow-sneak', 'shadow-ball'] as const,
      masterVolume: 0.3,
      musicVolume: 0,
      sfxVolume: 1,
      muted: true,
      touchMode: 'on' as const,
      autoAim: false,
      haptics: false,
    };
    saveSettings(store, settings);
    expect(loadSettings(store, defaultSettings('es'))).toEqual(settings);
  });

  it('remembers the picked species with a loadout of its own moves', () => {
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings('es'), species: 'zorua', loadout: ['fury-swipes', 'foul-play'] });
    expect(loadSettings(store, defaultSettings('es'))).toMatchObject({ species: 'zorua', loadout: ['fury-swipes', 'foul-play'] });
  });

  it('picking another species equips its default moves; picking the same one keeps the loadout', () => {
    const tuned = { ...defaultSettings('es'), loadout: ['shadow-sneak', 'shadow-ball'] as const };
    expect(withSpecies(tuned, 'litwick')).toMatchObject({ species: 'litwick', loadout: ['ember', 'hex'] });
    expect(withSpecies(tuned, 'mimikyu')).toEqual(tuned);
  });

  it('gives a stored species its default loadout when the stored moves are not its own, and drops unknown species', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', JSON.stringify({ species: 'cubone', loadout: ['shadow-claw', 'play-rough'] }));
    expect(loadSettings(store, defaultSettings('es'))).toMatchObject({ species: 'cubone', loadout: ['bone-club', 'bonemerang'] });
    store.set('mazmorra-sombria.settings', JSON.stringify({ species: 'aegislash', loadout: ['shadow-sneak', 'shadow-ball'] }));
    expect(loadSettings(store, defaultSettings('es'))).toMatchObject({ species: 'mimikyu', loadout: ['shadow-sneak', 'shadow-ball'] });
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

  it('loads settings saved with the old lock mode: hold stays hold, anything else becomes toggle', () => {
    const store = memoryStore();
    for (const [lockMode, lockType] of [['hold', 'hold'], ['toggle', 'toggle'], ['weird', 'toggle']]) {
      store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'en', lockMode, loadout: ['shadow-sneak', 'play-rough'] }));
      const loaded = loadSettings(store, defaultSettings('es'));
      expect(loaded).toEqual({ language: 'en', lockType, clickToLock: true, species: 'mimikyu', starterChosen: false, loadout: ['shadow-sneak', 'play-rough'], ...SOUND });
      expect(loaded).not.toHaveProperty('lockMode');
    }
  });

  it('accepts every lock type and rejects unknown ones; a stored lock type wins over the old lock mode', () => {
    const store = memoryStore();
    for (const lockType of ['toggle', 'hold', 'clickOnly', 'off']) {
      store.set('mazmorra-sombria.settings', JSON.stringify({ lockType }));
      expect(loadSettings(store, defaultSettings('es')).lockType).toBe(lockType);
    }
    store.set('mazmorra-sombria.settings', JSON.stringify({ lockType: 'sticky' }));
    expect(loadSettings(store, defaultSettings('es')).lockType).toBe('toggle');
    store.set('mazmorra-sombria.settings', JSON.stringify({ lockType: 'off', lockMode: 'hold' }));
    expect(loadSettings(store, defaultSettings('es')).lockType).toBe('off');
  });

  it('clamps volumes to 0..1 and rejects non-numbers', () => {
    const fallback = defaultSettings('es');
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', JSON.stringify({ masterVolume: 3, musicVolume: -1, sfxVolume: 'loud', muted: 'yes' }));
    const loaded = loadSettings(store, fallback);
    expect(loaded.masterVolume).toBe(1);
    expect(loaded.musicVolume).toBe(0);
    expect(loaded.sfxVolume).toBe(fallback.sfxVolume);
    expect(loaded.muted).toBe(false);
    store.set('mazmorra-sombria.settings', JSON.stringify({ masterVolume: null }));
    expect(loadSettings(store, fallback).masterVolume).toBe(fallback.masterVolume);
  });

  it('loads settings saved before sound existed with the sound defaults', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'en', clickToLock: false, loadout: ['shadow-claw', 'shadow-ball'] }));
    expect(loadSettings(store, defaultSettings('es'))).toEqual({ language: 'en', lockType: 'toggle', clickToLock: false, species: 'mimikyu', starterChosen: false, loadout: ['shadow-claw', 'shadow-ball'], ...SOUND });
  });
});

describe('the quiz starter', () => {
  it('is not chosen by default, so the first Play runs the quiz', () => {
    expect(defaultSettings('es').starterChosen).toBe(false);
  });

  it('withStarter sets the species with its default moves and marks the starter chosen', () => {
    const next = withStarter(defaultSettings('es'), 'litwick');
    expect(next.species).toBe('litwick');
    expect(next.loadout).toEqual(SPECIES.litwick.defaultLoadout);
    expect(next.starterChosen).toBe(true);
  });

  it('survives a reload, and a stored non-boolean falls back to not chosen', () => {
    const store = memoryStore();
    saveSettings(store, withStarter(defaultSettings('es'), 'cubone'));
    const loaded = loadSettings(store, defaultSettings('es'));
    expect(loaded.species).toBe('cubone');
    expect(loaded.starterChosen).toBe(true);
    store.set('mazmorra-sombria.settings', JSON.stringify({ starterChosen: 'yes' }));
    expect(loadSettings(store, defaultSettings('es')).starterChosen).toBe(false);
  });
});
