import { describe, expect, it } from 'vitest';
import { floorLabel } from '../src/adapters/hud';
import { catalog, detectLanguage, LANGUAGES, setLanguage, t } from '../src/i18n';

describe('i18n catalogs', () => {
  const spanishKeys = Object.keys(catalog('es'));

  for (const language of LANGUAGES) {
    it(`"${language}" defines every key that Spanish defines`, () => {
      const missing = spanishKeys.filter((key) => !(key in catalog(language)));
      expect(missing).toEqual([]);
    });

    it(`"${language}" has no empty strings`, () => {
      const empty = Object.entries(catalog(language)).filter(([, value]) => value.trim() === '');
      expect(empty).toEqual([]);
    });
  }
});

describe('sound strings', () => {
  const keys = ['menu.sound', 'menu.masterVolume', 'menu.musicVolume', 'menu.sfxVolume', 'menu.mute', 'menu.controls.mute'];
  for (const language of LANGUAGES) {
    it(`"${language}" names the sound settings and the mute key`, () => {
      expect(keys.filter((key) => !(key in catalog(language)))).toEqual([]);
    });
  }
});

describe('lock type and Esc menu strings', () => {
  const keys = [
    'menu.lockType',
    'lockType.toggle',
    'lockType.hold',
    'lockType.clickOnly',
    'lockType.off',
    'menu.controls.menu',
    'pause.title',
    'pause.resume',
    'pause.settings',
    'pause.restart',
    'pause.quit',
  ];
  for (const language of LANGUAGES) {
    it(`"${language}" names the lock types and the Esc menu`, () => {
      expect(keys.filter((key) => !(key in catalog(language)))).toEqual([]);
    });
  }
});

describe('run strings', () => {
  it('names the floor counter, the end-screen summary and the floor restart', () => {
    setLanguage('es');
    expect([t('hud.floor'), t('screen.floorReached'), t('screen.seed'), t('pause.restart')]).toEqual(['Planta', 'Planta alcanzada', 'Semilla', 'Reiniciar planta']);
    setLanguage('en');
    expect([t('hud.floor'), t('screen.floorReached'), t('screen.seed'), t('pause.restart')]).toEqual(['Floor', 'Floor reached', 'Seed', 'Restart floor']);
    expect(floorLabel(2)).toBe('Floor 2');
    setLanguage('es');
    expect(floorLabel(3)).toBe('Planta 3');
  });
});

describe('detectLanguage', () => {
  it('picks English only for English browser languages', () => {
    expect(detectLanguage('en-GB')).toBe('en');
    expect(detectLanguage('EN')).toBe('en');
    expect(detectLanguage('es-ES')).toBe('es');
    expect(detectLanguage('fr')).toBe('es');
    expect(detectLanguage(undefined)).toBe('es');
  });
});

describe('t', () => {
  it('returns the string of the current language and falls back to the key', () => {
    setLanguage('en');
    expect(t('app.title')).toBe('Shadow Dungeon');
    setLanguage('es');
    expect(t('app.title')).toBe('Mazmorra Sombría');
    expect(t('does.not.exist')).toBe('does.not.exist');
  });
});
