import { LOCK_TYPES, type LockType } from '../core/state';
import { TOUCH_MODES } from '../adapters/touch-mode';
import { LANGUAGES, t, type Language } from '../i18n';
import type { ListItem } from '../ui/cursor-list';
import { h } from '../ui/window';
import type { Settings } from './settings';

/**
 * Settings rows shared by the Settings screen and the Esc menu: language,
 * lock type, click-to-lock, master / music / effects volume and mute. Each
 * row is a value the cursor list changes with left/right (or the ◀ ▶ arrows)
 * and a confirm; every change writes through `update`, which persists and
 * applies it at once. `settingRows` is the pure model, `settingItems` turns
 * it into cursor list rows.
 */
export type UpdateSettings = (changes: Partial<Settings>) => void;

export interface SettingsAccess {
  get(): Settings;
  update: UpdateSettings;
  /** Applies a new language to the page (title, `lang`); the caller re-renders. */
  setLanguage(language: Language): void;
}

export interface SettingRow {
  id: 'language' | 'lockType' | 'clickToLock' | VolumeKey | 'muted' | 'touchMode' | 'autoAim' | 'haptics';
  label: string;
  value: string;
  /** Volumes: the level 0..1 for the meter. */
  level?: number;
  disabled: boolean;
  adjust(delta: -1 | 1): void;
  confirm(): void;
  /** Section the row starts (a header above it). */
  section?: string;
}

type VolumeKey = 'masterVolume' | 'musicVolume' | 'sfxVolume';

/** Re-export for the screens that build plain elements. */
export const el = h;

const cycle = <T>(values: readonly T[], current: T, delta: -1 | 1): T => {
  const at = values.indexOf(current);
  return values[(((at + delta) % values.length) + values.length) % values.length]!;
};

/** One keyboard step of a volume: 5 %, clamped to 0..1, without float drift. */
export const stepVolume = (value: number, delta: -1 | 1): number => Math.min(1, Math.max(0, Math.round(value * 20 + delta) / 20));

/** Click-to-lock only means something with toggle and hold (click only implies it, off ignores it). */
const clickToLockApplies = (lockType: LockType) => lockType === 'toggle' || lockType === 'hold';

const onOff = (value: boolean) => t(value ? 'menu.on' : 'menu.off');

export function settingRows(access: SettingsAccess): SettingRow[] {
  const s = access.get();
  const pickLanguage = (delta: -1 | 1) => {
    const language = cycle(LANGUAGES, access.get().language, delta);
    access.update({ language });
    access.setLanguage(language);
  };
  const toggle = (key: 'clickToLock' | 'muted' | 'autoAim' | 'haptics') => () => access.update({ [key]: !access.get()[key] });
  const volume = (key: VolumeKey, section?: string): SettingRow => ({
    id: key,
    label: t(`menu.${key}`),
    value: `${Math.round(s[key] * 100)} %`,
    level: s[key],
    disabled: false,
    adjust: (delta) => access.update({ [key]: stepVolume(access.get()[key], delta) }),
    confirm: () => access.update({ [key]: stepVolume(access.get()[key], 1) }),
    ...(section ? { section } : {}),
  });
  const lockType = (delta: -1 | 1) => access.update({ lockType: cycle(LOCK_TYPES, access.get().lockType, delta) });
  const touchMode = (delta: -1 | 1) => access.update({ touchMode: cycle(TOUCH_MODES, access.get().touchMode, delta) });
  return [
    { id: 'language', label: t('language.label'), value: t(`language.${s.language}`), disabled: false, adjust: pickLanguage, confirm: () => pickLanguage(1) },
    { id: 'lockType', section: t('menu.lockOn'), label: t('menu.lockType'), value: t(`lockType.${s.lockType}`), disabled: false, adjust: lockType, confirm: () => lockType(1) },
    {
      id: 'clickToLock',
      label: t('menu.clickToLock'),
      value: onOff(s.clickToLock),
      disabled: !clickToLockApplies(s.lockType),
      adjust: toggle('clickToLock'),
      confirm: toggle('clickToLock'),
    },
    volume('masterVolume', t('menu.sound')),
    volume('musicVolume'),
    volume('sfxVolume'),
    { id: 'muted', label: t('menu.mute'), value: onOff(s.muted), disabled: false, adjust: toggle('muted'), confirm: toggle('muted') },
    { id: 'touchMode', section: t('touch.section'), label: t('touch.mode'), value: t(`touch.mode.${s.touchMode}`), disabled: false, adjust: touchMode, confirm: () => touchMode(1) },
    { id: 'autoAim', label: t('touch.autoAim'), value: onOff(s.autoAim), disabled: false, adjust: toggle('autoAim'), confirm: toggle('autoAim') },
    { id: 'haptics', label: t('touch.haptics'), value: onOff(s.haptics), disabled: false, adjust: toggle('haptics'), confirm: toggle('haptics') },
  ];
}

/** Ten-segment volume meter. */
function meter(level: number): HTMLElement {
  const lit = Math.round(level * 10);
  const node = h(
    'span',
    { className: 'md-meter' },
    Array.from({ length: 10 }, (_, i) => h('i', { className: i < lit ? 'on' : '' })),
  );
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/**
 * Cursor list rows for the settings; `refresh` re-renders after a change
 * (the language row re-renders the whole screen through `setLanguage`).
 */
export function settingItems(access: SettingsAccess, refresh: () => void): ListItem[] {
  const items: ListItem[] = [];
  for (const row of settingRows(access)) {
    if (row.section) items.push({ header: true, label: row.section });
    const value = row.level === undefined ? row.value : h('span', { className: 'md-volume' }, [meter(row.level), h('span', { textContent: row.value })]);
    items.push({
      label: row.label,
      value,
      disabled: row.disabled,
      className: `setting-${row.id}`,
      onAdjust: (delta) => {
        row.adjust(delta);
        if (row.id !== 'language') refresh();
      },
      onConfirm: () => {
        row.confirm();
        if (row.id !== 'language') refresh();
      },
    });
  }
  return items;
}

/** The in-game key list, shown on the Settings screen. */
export const CONTROL_KEYS = ['move', 'roll', 'fast', 'heavy', 'boost', 'area', 'lock', 'clickLock', 'minimap', 'pick', 'mute', 'menu', 'netStats'] as const;
