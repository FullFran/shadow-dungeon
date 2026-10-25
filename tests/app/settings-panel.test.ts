import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { settingRows, stepVolume } from '../../src/app/settings-panel';
import { setLanguage } from '../../src/i18n';

/** Rows over a settings value that `update` changes in place, like the app does. */
function harness(initial: Partial<Settings> = {}) {
  let settings: Settings = { ...defaultSettings('es'), ...initial };
  const languages: string[] = [];
  const rows = () =>
    settingRows({
      get: () => settings,
      update: (changes) => (settings = { ...settings, ...changes }),
      setLanguage: (language) => languages.push(language),
    });
  const row = (id: string) => rows().find((r) => r.id === id)!;
  return { rows, row, settings: () => settings, languages };
}

describe('settings rows', () => {
  it('lists language, lock type, click-to-lock, three volumes and mute', () => {
    setLanguage('es');
    expect(harness().rows().map((r) => r.id)).toEqual(['language', 'lockType', 'clickToLock', 'masterVolume', 'musicVolume', 'sfxVolume', 'muted']);
  });

  it('cycles the language both ways and applies it to the page', () => {
    const h = harness({ language: 'es' });
    h.row('language').adjust(1);
    expect(h.settings().language).toBe('en');
    h.row('language').adjust(1);
    expect(h.settings().language).toBe('es');
    h.row('language').adjust(-1);
    expect(h.languages).toEqual(['en', 'es', 'en']);
  });

  it('cycles the lock type and greys out click-to-lock where it does not apply', () => {
    setLanguage('es');
    const h = harness({ lockType: 'toggle' });
    expect(h.row('clickToLock').disabled).toBe(false);
    h.row('lockType').adjust(1);
    expect(h.settings().lockType).toBe('hold');
    h.row('lockType').adjust(1);
    expect(h.settings().lockType).toBe('clickOnly');
    expect(h.row('clickToLock').disabled).toBe(true);
    h.row('lockType').adjust(-1);
    h.row('lockType').adjust(-1);
    h.row('lockType').adjust(-1);
    expect(h.settings().lockType).toBe('off');
    expect(h.row('lockType').value).toBe('Desactivado');
  });

  it('toggles click-to-lock and mute with either direction or a confirm', () => {
    setLanguage('en');
    const h = harness({ clickToLock: true, muted: false });
    h.row('clickToLock').adjust(-1);
    expect(h.settings().clickToLock).toBe(false);
    expect(h.row('clickToLock').value).toBe('Off');
    h.row('muted').confirm();
    expect(h.settings().muted).toBe(true);
    expect(h.row('muted').value).toBe('On');
    setLanguage('es');
  });

  it('steps volumes by 5 %, clamped to 0..1, and shows the level as a percentage and a 0..1 meter', () => {
    const h = harness({ musicVolume: 0.5 });
    h.row('musicVolume').adjust(1);
    expect(h.settings().musicVolume).toBe(0.55);
    expect(h.row('musicVolume')).toMatchObject({ value: '55 %', level: 0.55 });
    expect(stepVolume(0.98, 1)).toBe(1);
    expect(stepVolume(0.02, -1)).toBe(0);
    expect(stepVolume(0.7, -1)).toBe(0.65);
  });
});
