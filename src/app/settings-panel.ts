import { LOCK_TYPES, type LockType } from '../core/state';
import { LANGUAGES, t, type Language } from '../i18n';
import type { Settings } from './settings';

/**
 * Settings controls shared by the main menu and the Esc menu: language, lock
 * type with click-to-lock, and sound. Each control writes through `update`,
 * which persists and applies the change at once.
 */
export type UpdateSettings = (changes: Partial<Settings>) => void;

/** Creates an element with plain properties (textContent, className, value, type...) and children. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, children: (Node | string)[] = []): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

/** One button per language; `onPick` re-renders the page in the new language. */
export function languageRow(settings: Settings, onPick: (language: Language) => void): HTMLElement {
  return el(
    'div',
    { className: 'row', ariaLabel: t('language.label') },
    LANGUAGES.map((language) => {
      const button = el('button', { type: 'button', textContent: t(`language.${language}`) });
      button.setAttribute('aria-pressed', String(language === settings.language));
      button.addEventListener('click', () => onPick(language));
      return button;
    }),
  );
}

/** Click-to-lock only means something with toggle and hold (click only implies it, off ignores it). */
const clickToLockApplies = (lockType: LockType) => lockType === 'toggle' || lockType === 'hold';

/** Lock type select and the click-to-lock checkbox, greyed out when it does not apply. */
export function lockRow(settings: Settings, update: UpdateSettings): HTMLElement {
  const select = el(
    'select',
    {},
    LOCK_TYPES.map((lockType) => el('option', { value: lockType, textContent: t(`lockType.${lockType}`) })),
  );
  select.value = settings.lockType;
  const clickToLock = el('input', { type: 'checkbox' });
  clickToLock.checked = settings.clickToLock;
  clickToLock.disabled = !clickToLockApplies(settings.lockType);
  select.addEventListener('change', () => {
    const lockType = select.value as LockType;
    clickToLock.disabled = !clickToLockApplies(lockType);
    update({ lockType });
  });
  clickToLock.addEventListener('change', () => update({ clickToLock: clickToLock.checked }));
  return el('div', { className: 'row' }, [
    el('label', {}, [`${t('menu.lockType')} `, select]),
    el('label', {}, [clickToLock, ` ${t('menu.clickToLock')}`]),
  ]);
}

/** Master, music and effects volume sliders and the mute checkbox. */
export function soundRow(settings: Settings, update: UpdateSettings): HTMLElement {
  const volumes = (['masterVolume', 'musicVolume', 'sfxVolume'] as const).map((key) => {
    const slider = el('input', { type: 'range', min: '0', max: '1', step: '0.05' });
    slider.value = String(settings[key]);
    slider.addEventListener('input', () => update({ [key]: Number(slider.value) }));
    return el('label', {}, [`${t(`menu.${key}`)} `, slider]);
  });
  const mute = el('input', { type: 'checkbox' });
  mute.checked = settings.muted;
  mute.addEventListener('change', () => update({ muted: mute.checked }));
  return el('div', { className: 'row' }, [...volumes, el('label', {}, [mute, ` ${t('menu.mute')}`])]);
}

/** The in-game key list, shared by the main menu. */
export const CONTROL_KEYS = ['move', 'roll', 'fast', 'heavy', 'lock', 'clickLock', 'mute', 'menu'] as const;
