import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { defaultSettings, loadSettings, saveSettings, withSpecies } from '../../src/app/settings';
import { currentForm, rosterOf } from '../../src/core/collection';

/** An evolved starter replaces its base form everywhere the player picks (odd/tasks/roster-parity.md). */
describe('selected species after an evolution', () => {
  it('a stored base form reads as its line\'s current form; anything else outside the roster falls back', () => {
    const store = memoryStore();
    saveSettings(store, withSpecies(defaultSettings('es'), 'zorua'));
    const roster = rosterOf({ owned: ['zoroark'] });
    expect(loadSettings(store, defaultSettings('es'), roster).species).toBe('zoroark');
    expect(loadSettings(store, defaultSettings('es'), roster).loadout).toEqual(['feint-attack', 'night-daze', 'nasty-plot', 'dark-pulse']);
    saveSettings(store, withSpecies(defaultSettings('es'), 'abra'));
    expect(loadSettings(store, defaultSettings('es'), roster).species).toBe('mimikyu');
  });

  it('the quiz\'s starter maps to the form the player has', () => {
    expect(currentForm({ owned: ['chandelure'] }, 'litwick')).toBe('chandelure');
    expect(currentForm({}, 'litwick')).toBe('litwick');
    expect(currentForm({ owned: ['kadabra'] }, 'mimikyu')).toBe('mimikyu');
  });
});
