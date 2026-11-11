import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { DEFAULT_BINDINGS, rebind } from '../../src/adapters/bindings';
import { defaultSettings, loadSettings, saveSettings } from '../../src/app/settings';

describe('settings: key bindings (issue #62)', () => {
  it('new players get the default keyboard and mouse bindings', () => {
    expect(defaultSettings('es').keyBindings).toEqual(DEFAULT_BINDINGS);
  });

  it('settings saved before rebinding existed load the defaults', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', JSON.stringify({ language: 'en', muted: true }));
    expect(loadSettings(store, defaultSettings('es')).keyBindings).toEqual(DEFAULT_BINDINGS);
  });

  it('a rebound table survives a save and a load', () => {
    const result = rebind(DEFAULT_BINDINGS, 'roll', 0, 'KeyQ');
    if (result.kind === 'refused') throw new Error('refused');
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings('es'), keyBindings: result.bindings });
    expect(loadSettings(store, defaultSettings('es')).keyBindings).toEqual(result.bindings);
  });

  it('a broken stored table is sanitized: reserved keys and junk fall back to the defaults', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.settings', JSON.stringify({ keyBindings: { roll: ['F11', 42], lock: 'Shift' } }));
    const loaded = loadSettings(store, defaultSettings('es')).keyBindings;
    expect(loaded.roll).toEqual(DEFAULT_BINDINGS.roll);
    expect(loaded.lock).toEqual(DEFAULT_BINDINGS.lock);
  });
});
