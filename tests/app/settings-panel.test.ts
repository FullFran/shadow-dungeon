import { describe, expect, it } from 'vitest';
import { defaultSettings, type Settings } from '../../src/app/settings';
import { SETTING_SLIDERS, SETTING_TAB_ICONS, applySetting, settingChoice, settingChoices, settingControlKind, settingRows, settingSections, settingTabs, stepVolume, type SettingsAccess } from '../../src/app/settings-panel';
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
  return { rows, row, settings: () => settings, languages, update: (changes: Partial<Settings>) => (settings = { ...settings, ...changes }) };
}

describe('settings rows', () => {
  it('lists language, lock type, click-to-lock, three volumes, mute and the figuraciones', () => {
    setLanguage('es');
    expect(harness().rows().map((r) => r.id)).toEqual(['language', 'lockType', 'clickToLock', 'masterVolume', 'musicVolume', 'sfxVolume', 'muted', 'figurations', 'touchMode', 'autoAim', 'haptics', 'touchSize', 'touchOpacity', 'touchLeftHanded']);
  });

  it('cycles the Sima\'s figuraciones on, reduced, off (accessibility)', () => {
    const h = harness();
    expect(h.settings().figurations).toBe('on');
    h.row('figurations').adjust(1);
    expect(h.settings().figurations).toBe('reduced');
    h.row('figurations').confirm();
    expect(h.settings().figurations).toBe('off');
    h.row('figurations').adjust(1);
    expect(h.settings().figurations).toBe('on');
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

// odd/tasks/menu-redesign.md S6: settings in tabs with one sentence per option.
describe('settings in tabs, each option explained', () => {
  it('every option says what it does in one sentence, in both languages, without em dashes', () => {
    for (const language of ['es', 'en'] as const) {
      setLanguage(language);
      for (const row of harness().rows()) {
        expect(row.about, `${language} ${row.id}`).toMatch(/\S/);
        expect(row.about, `${language} ${row.id}`).not.toContain('\u2014');
        expect(row.about, `${language} ${row.id}`).not.toMatch(/^setting\./);
      }
    }
    setLanguage('es');
  });

  it('groups the rows by their sections: General first, then the sections in order, every row once', () => {
    setLanguage('es');
    const rows = harness().rows();
    const tabs = settingTabs(rows);
    expect(tabs.map((tab) => tab.title)).toEqual(['General', 'Fijar objetivo', 'Sonido', 'Accesibilidad', 'Táctil']);
    expect(tabs[0]!.rows.map((r) => r.id)).toEqual(['language']);
    expect(tabs.flatMap((tab) => tab.rows.map((r) => r.id))).toEqual(rows.map((r) => r.id));
  });
});

describe('settings controls', () => {
  const ids = () => harness().rows().map((r) => r.id);

  it('picks the control of each setting: sliders, switches, segmented up to three options, a dropdown above', () => {
    const kinds = Object.fromEntries(ids().map((id) => [id, settingControlKind(id)]));
    expect(kinds).toEqual({
      language: 'segmented',
      lockType: 'dropdown',
      clickToLock: 'switch',
      masterVolume: 'slider',
      musicVolume: 'slider',
      sfxVolume: 'slider',
      muted: 'switch',
      figurations: 'segmented',
      touchMode: 'segmented',
      autoAim: 'switch',
      haptics: 'switch',
      touchSize: 'segmented',
      touchOpacity: 'slider',
      touchLeftHanded: 'switch',
    });
  });

  it('gives every choice setting its options, never more than three for a segmented control', () => {
    setLanguage('es');
    for (const id of ids()) {
      const kind = settingControlKind(id);
      if (kind !== 'segmented' && kind !== 'dropdown') continue;
      const options = settingChoices(id);
      expect(options.length, id).toBeGreaterThan(1);
      if (kind === 'segmented') expect(options.length, id).toBeLessThanOrEqual(3);
      else expect(options.length, id).toBeGreaterThan(3);
      for (const o of options) expect(o.label, `${id} ${o.value}`).toMatch(/\S/);
    }
    expect(settingChoices('lockType').map((o) => o.value)).toEqual(['toggle', 'hold', 'clickOnly', 'off']);
  });

  it('gives every slider a range that covers the values its setting can take', () => {
    for (const id of ['masterVolume', 'musicVolume', 'sfxVolume'] as const) expect(SETTING_SLIDERS[id]).toMatchObject({ min: 0, max: 1, step: 0.05 });
    expect(SETTING_SLIDERS.touchOpacity).toMatchObject({ min: 0.5, max: 1, step: 0.25 });
    expect(Object.keys(SETTING_SLIDERS).sort()).toEqual(ids().filter((id) => settingControlKind(id) === 'slider').sort());
  });

  it('groups the rows into the five sections, each row in exactly one, with an icon each', () => {
    setLanguage('es');
    const h = harness();
    const sections = settingSections(h.rows());
    expect(sections.map((s) => s.icon)).toEqual(SETTING_TAB_ICONS);
    expect(sections.map((s) => s.title)).toEqual(['General', 'Fijar objetivo', 'Sonido', 'Accesibilidad', 'Táctil']);
    expect(sections.flatMap((s) => s.rows.map((r) => r.id)).sort()).toEqual(ids().sort());
    for (const row of h.rows()) expect(sections.filter((s) => s.rows.some((r) => r.id === row.id)), row.id).toHaveLength(1);
  });

  it('writes each control change through the update path (and the language to the page)', () => {
    const h = harness({ language: 'es' });
    const access: SettingsAccess = { get: h.settings, update: (c) => h.update(c), setLanguage: (l) => h.languages.push(l) };
    applySetting(access, 'musicVolume', 0.35);
    applySetting(access, 'muted', true);
    applySetting(access, 'lockType', 'hold');
    applySetting(access, 'touchSize', '1.2');
    applySetting(access, 'touchOpacity', 0.75);
    applySetting(access, 'figurations', 'off');
    applySetting(access, 'touchMode', 'on');
    expect(h.settings()).toMatchObject({ musicVolume: 0.35, muted: true, lockType: 'hold', touchSize: 1.2, touchOpacity: 0.75, figurations: 'off', touchMode: 'on' });
    applySetting(access, 'language', 'en');
    expect(h.settings().language).toBe('en');
    expect(h.languages).toEqual(['en']);
  });

  it('has its own texts in both languages, without em dashes', async () => {
    const { catalog } = await import('../../src/i18n');
    for (const language of ['es', 'en'] as const) {
      const tr = catalog(language);
      for (const key of ['settings.hint', 'settings.sections', 'setting.clickToLock.disabled', 'settings.nickname.hint', 'settings.nickname.saved', 'settings.volume.mutedNote', 'settings.nickname', 'menu.general', 'menu.lockOn', 'menu.sound', 'menu.accessibility', 'touch.section']) {
        expect(tr[key], `${language} ${key}`).toMatch(/\S/);
        expect(tr[key], `${language} ${key}`).not.toContain('—');
      }
      expect(tr['settings.nickname.saved'], language).toContain('{name}');
    }
  });

  it('reads the current choice of a setting as its option value', () => {
    expect(settingChoice('touchSize', { ...defaultSettings('es'), touchSize: 1.2 })).toBe('1.2');
    expect(settingChoice('lockType', { ...defaultSettings('es'), lockType: 'off' })).toBe('off');
  });
});
