import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { moveInfoLines } from '../../src/app/move-info';
import { defaultSettings, loadSettings, saveSettings, slotOptions } from '../../src/app/settings';
import { setLanguage } from '../../src/i18n';

describe('four-slot loadout', () => {
  it('offers each starter its boost and its two area moves', () => {
    expect(slotOptions('boost', 'zorua')).toEqual(['nasty-plot']);
    expect(slotOptions('area', 'zorua')).toEqual(['dark-pulse', 'snarl']);
    expect(slotOptions('area', 'litwick')).toEqual(['flamethrower', 'heat-wave']);
  });

  it('persists a four-move pick and rejects a move in the wrong new slot', () => {
    const store = memoryStore();
    const loadout = ['fury-swipes', 'foul-play', 'nasty-plot', 'snarl'] as const;
    saveSettings(store, { ...defaultSettings('es'), species: 'zorua', loadout });
    expect(loadSettings(store, defaultSettings('es'))).toMatchObject({ species: 'zorua', loadout });
    saveSettings(store, { ...defaultSettings('es'), species: 'zorua', loadout: ['fury-swipes', 'foul-play', 'snarl', 'nasty-plot'] });
    expect(loadSettings(store, defaultSettings('es')).loadout).toEqual(['feint-attack', 'night-daze', 'nasty-plot', 'dark-pulse']);
  });

  it('move cards tell the cooldown, the shape and that a boost has no target', () => {
    setLanguage('es');
    expect(moveInfoLines('flamethrower')[0]).toBe('Estamina 35 · onda en línea (atraviesa) · Enfriamiento 8 s');
    expect(moveInfoLines('heat-wave')[0]).toContain('cono amplio');
    expect(moveInfoLines('bulk-up')).toEqual(['Sin coste · sobre ti · Enfriamiento 16 s', 'Mejora propia: no daña, prepara tus golpes']);
  });
});
