import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { defaultSettings, loadSettings, saveSettings } from '../../src/app/settings';
import { settingRows } from '../../src/app/settings-panel';
import { setLanguage } from '../../src/i18n';
import type { Settings } from '../../src/app/settings';
import { TOUCH_SCALES } from '../../src/ui/touch-layout';
import { TOUCH_OPACITIES, touchPrefsOf } from '../../src/app/settings';

describe('touch settings', () => {
  it('default to Auto touch mode, auto-aim and haptics on', () => {
    const s = defaultSettings('es');
    expect(s.touchMode).toBe('auto');
    expect(s.autoAim).toBe(true);
    expect(s.haptics).toBe(true);
  });

  it('load valid stored values and fall back on invalid or missing ones', () => {
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings('es'), touchMode: 'off', autoAim: false, haptics: false });
    const loaded = loadSettings(store, defaultSettings('es'));
    expect([loaded.touchMode, loaded.autoAim, loaded.haptics]).toEqual(['off', false, false]);

    store.set('mazmorra-sombria.settings', JSON.stringify({ touchMode: 'sometimes', autoAim: 'yes' }));
    const bad = loadSettings(store, defaultSettings('es'));
    expect([bad.touchMode, bad.autoAim, bad.haptics]).toEqual(['auto', true, true]);
  });

  it('have rows: touch mode cycles, auto-aim and haptics toggle', () => {
    setLanguage('es');
    let settings: Settings = defaultSettings('es');
    const rows = () => settingRows({ get: () => settings, update: (c) => (settings = { ...settings, ...c }), setLanguage: () => {} });
    const row = (id: string) => rows().find((r) => r.id === id)!;
    expect(rows().map((r) => r.id).slice(-6, -3)).toEqual(['touchMode', 'autoAim', 'haptics']);
    row('touchMode').adjust(1);
    expect(settings.touchMode).toBe('on');
    row('touchMode').adjust(-1);
    row('touchMode').adjust(-1);
    expect(settings.touchMode).toBe('off');
    row('autoAim').confirm();
    row('haptics').adjust(1);
    expect([settings.autoAim, settings.haptics]).toEqual([false, false]);
  });

  it('default the buttons to normal size, fully opaque, right-handed', () => {
    const s = defaultSettings('es');
    expect([s.touchSize, s.touchOpacity, s.touchLeftHanded]).toEqual([1, 1, false]);
    expect(touchPrefsOf(s)).toEqual({ scale: 1, opacity: 1, leftHanded: false });
  });

  it('load only offered sizes and opacities, else the defaults', () => {
    const store = memoryStore();
    saveSettings(store, { ...defaultSettings('es'), touchSize: TOUCH_SCALES[2], touchOpacity: TOUCH_OPACITIES[0], touchLeftHanded: true });
    const loaded = loadSettings(store, defaultSettings('es'));
    expect([loaded.touchSize, loaded.touchOpacity, loaded.touchLeftHanded]).toEqual([TOUCH_SCALES[2], TOUCH_OPACITIES[0], true]);
    store.set('mazmorra-sombria.settings', JSON.stringify({ touchSize: 7, touchOpacity: 0, touchLeftHanded: 'left' }));
    const bad = loadSettings(store, defaultSettings('es'));
    expect([bad.touchSize, bad.touchOpacity, bad.touchLeftHanded]).toEqual([1, 1, false]);
  });

  it('have rows after haptics: size and opacity cycle, left hand toggles', () => {
    setLanguage('es');
    let settings: Settings = defaultSettings('es');
    const rows = () => settingRows({ get: () => settings, update: (c) => (settings = { ...settings, ...c }), setLanguage: () => {} });
    const row = (id: string) => rows().find((r) => r.id === id)!;
    expect(rows().map((r) => r.id).slice(-3)).toEqual(['touchSize', 'touchOpacity', 'touchLeftHanded']);
    row('touchSize').adjust(1);
    expect(settings.touchSize).toBe(TOUCH_SCALES[2]);
    row('touchSize').adjust(1);
    expect(settings.touchSize).toBe(TOUCH_SCALES[0]);
    row('touchOpacity').adjust(-1);
    expect(settings.touchOpacity).toBe(TOUCH_OPACITIES[TOUCH_OPACITIES.length - 2]);
    row('touchLeftHanded').confirm();
    expect(settings.touchLeftHanded).toBe(true);
  });
});
