import { t } from '../i18n';
import { sanitizeNickname, NICKNAME_MAX } from '../net/nickname';
import { dropdown, type Dropdown } from '../ui/dropdown';
import { pixelIconSvg, type PixelIconId } from '../ui/pixel-icons';
import { isCompactTouch } from '../ui/compact-touch';
import { attachPager } from '../ui/pager';
import { slider } from '../ui/slider';
import { h, mdWindow } from '../ui/window';
import { SETTING_SLIDERS, applySetting, settingChoice, settingChoices, settingControlKind, settingRows, settingSections, type SettingRow, type SettingsAccess } from './settings-panel';
import '../styles/settings.css';

/**
 * The Settings window (owner, 2026-11-03: "mejora ... principalmente UX el menú de ajustes"), one
 * implementation for the window over the town and the full-screen Settings page: a rail of
 * sections with a colour icon each, and the section's settings on the right as rows (label, one
 * sentence of help, the control). Volumes are draggable sliders (the effects one plays a short
 * sound when released), on / off are switches, up to three choices a segmented control, more a
 * dropdown. Every change goes through `access.update`, the path the cursor list always used.
 * Fixed geometry: the window never changes size between sections. Keyboard and gamepad: Up / Down
 * move between rows, Left / Right adjust, Enter acts, Q / E change section, Esc goes back.
 * settings-panel.ts holds the tested model (which control, which options, which section).
 */
export interface SettingsAction {
  label: string;
  icon: PixelIconId;
  run(): void;
}

export interface SettingsViewOptions {
  access: SettingsAccess;
  /** The section to open (index in rail order). */
  tab?: number;
  onTab?(tab: number): void;
  onBack(): void;
  /** Secondary buttons beside Back: report a problem, the account, the personality test. */
  actions?: readonly SettingsAction[];
}

export interface SettingsView {
  element: HTMLElement;
  dispose(): void;
}

/** Why a disabled row is off (shown in place of its help). */
const DISABLED_REASON: Partial<Record<SettingRow['id'], string>> = { clickToLock: 'setting.clickToLock.disabled' };

const FOCUSABLE = '[role="slider"], button[role="switch"], button[role="radio"][tabindex="0"], button.dd, input';

export function settingsView(options: SettingsViewOptions): SettingsView {
  const { access } = options;
  let current = options.tab ?? 0;
  let dropdowns: Dropdown[] = [];
  let navs: HTMLElement[] = [];
  let aboutOf = new Map<HTMLElement, string>();
  let rendered = -1;

  const sectionsNow = () => settingSections(settingRows(access));
  const sections = sectionsNow();
  current = Math.min(Math.max(0, current), sections.length - 1);

  // ---- rail
  const tabs = sections.map((section, i) => {
    const tab = h('button', { type: 'button', className: 'st-tab' }, [pixelIconSvg(section.icon, 'px-icon'), h('span', { textContent: section.title })]);
    tab.setAttribute('role', 'tab');
    tab.addEventListener('click', () => setTab(i));
    return tab;
  });
  const rail = h('nav', { className: 'st-rail' }, tabs);
  rail.setAttribute('role', 'tablist');
  rail.setAttribute('aria-orientation', isCompactTouch() ? 'horizontal' : 'vertical');
  rail.setAttribute('aria-label', t('settings.sections'));

  // ---- panel
  const heading = h('h3', { className: 'st-heading' });
  const rowsBox = h('div', { className: 'st-rows' });
  const about = h('p', { className: 'st-about' });
  const panel = h('section', { className: 'st-panel' }, [heading, rowsBox]);
  panel.setAttribute('role', 'tabpanel');

  // ---- footer
  const back = h('button', { type: 'button', className: 'st-btn st-back' }, [h('span', { textContent: t('menu.back') })]);
  back.addEventListener('click', () => options.onBack());
  const extras = (options.actions ?? []).map((action) => {
    const button = h('button', { type: 'button', className: 'st-btn' }, [pixelIconSvg(action.icon, 'px-icon'), h('span', { textContent: action.label })]);
    button.addEventListener('click', () => action.run());
    return button;
  });
  const footButtons = [back, ...extras];
  // A phone pages the rows of a section instead of scrolling them; the page buttons sit in the footer beside the actions.
  const pageNav = h('div', { className: 'st-pages' });
  const foot = h('div', { className: 'st-foot' }, [h('div', { className: 'st-actions' }, footButtons), pageNav, about, h('p', { className: 'st-keys', textContent: t('settings.hint') })]);

  const pager = attachPager(rowsBox, { nav: pageNav, enabled: isCompactTouch });
  const win = mdWindow({ title: t('title.settings'), className: 'st-window' }, [h('div', { className: 'st-body' }, [rail, panel]), foot]);

  // ---- rows
  const label = (row: SettingRow, id: string) => h('span', { className: 'st-label', id: `${id}-l`, textContent: row.label });

  function sliderControl(row: SettingRow, id: string): HTMLElement {
    const key = row.id as keyof typeof SETTING_SLIDERS;
    const control = slider({
      label: row.label,
      labelledBy: `${id}-l`,
      range: SETTING_SLIDERS[key],
      value: access.get()[key],
      onInput: (value) => applySetting(access, row.id, value),
      // The effects level is heard, not just seen: a click when the thumb is let go (the music already plays).
      onCommit: () => {
        if (row.id !== 'musicVolume' && row.id !== 'touchOpacity') access.preview?.();
      },
    });
    navs.push(control.control);
    return control.element;
  }

  function switchControl(row: SettingRow, id: string): HTMLElement {
    const on = Boolean(access.get()[row.id as 'muted']);
    const button = h('button', { type: 'button', className: 'st-switch' }, [
      h('span', { className: 'st-track' }, [h('i', { className: 'st-knob' })]),
      h('span', { className: 'st-state', textContent: t(on ? 'menu.on' : 'menu.off') }),
    ]);
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(on));
    button.setAttribute('aria-labelledby', `${id}-l`);
    button.disabled = row.disabled;
    const set = (value: boolean) => {
      if (value !== on) {
        applySetting(access, row.id, value);
        renderPanel();
      }
    };
    button.addEventListener('click', () => set(!on));
    button.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      set(e.key === 'ArrowRight');
    });
    navs.push(button);
    return button;
  }

  function segmentedControl(row: SettingRow, id: string): HTMLElement {
    const choices = settingChoices(row.id);
    const value = settingChoice(row.id, access.get());
    const group = h('div', { className: 'st-seg' });
    group.setAttribute('role', 'radiogroup');
    group.setAttribute('aria-labelledby', `${id}-l`);
    const buttons = choices.map((choice) => {
      const selected = choice.value === value;
      const button = h('button', { type: 'button', className: 'st-opt', textContent: choice.label });
      button.setAttribute('role', 'radio');
      button.setAttribute('aria-checked', String(selected));
      button.tabIndex = selected ? 0 : -1;
      button.addEventListener('click', () => {
        if (choice.value === value) return;
        applySetting(access, row.id, choice.value);
        renderPanel();
      });
      return button;
    });
    group.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const at = choices.findIndex((c) => c.value === value);
      const next = Math.min(choices.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)));
      if (next !== at) buttons[next]!.click();
    });
    group.append(...buttons);
    navs.push(buttons.find((b) => b.tabIndex === 0) ?? buttons[0]!);
    return group;
  }

  function dropdownControl(row: SettingRow, id: string): HTMLElement {
    const box = dropdown({
      label: row.label,
      labelledBy: `${id}-l`,
      items: settingChoices(row.id),
      value: settingChoice(row.id, access.get()),
      className: 'st-dd',
      onChange: (value) => {
        applySetting(access, row.id, value);
        renderPanel();
      },
    });
    dropdowns.push(box);
    navs.push(box.element);
    return box.element;
  }

  function buildRow(row: SettingRow): HTMLElement {
    const id = `st-${row.id}`;
    const kind = settingControlKind(row.id);
    const reason = row.disabled ? DISABLED_REASON[row.id] : undefined;
    const muted = row.id === 'muted' && access.get().muted;
    const helpText = reason ? t(reason) : muted ? t('settings.volume.mutedNote') : row.about;
    const control = kind === 'slider' ? sliderControl(row, id) : kind === 'switch' ? switchControl(row, id) : kind === 'segmented' ? segmentedControl(row, id) : dropdownControl(row, id);
    const element = h('div', { className: `st-row st-kind-${kind}${row.disabled ? ' is-disabled' : ''}` }, [
      h('div', { className: 'st-text' }, [label(row, id), h('span', { className: 'st-help', textContent: helpText })]),
      h('div', { className: 'st-ctl' }, [control]),
    ]);
    element.dataset.row = row.id;
    aboutOf.set(element, helpText);
    return element;
  }

  /** The nickname: a text field (the one native input) whose hint shows what will really be saved. */
  function nicknameRow(): HTMLElement {
    const id = 'st-nickname';
    const input = h('input', { type: 'text', className: 'st-input', placeholder: t('nickname.placeholder'), value: access.get().nickname });
    input.maxLength = NICKNAME_MAX * 2;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.enterKeyHint = 'done';
    input.setAttribute('aria-labelledby', `${id}-l`);
    input.setAttribute('aria-describedby', `${id}-h`);
    const help = h('span', { className: 'st-help', id: `${id}-h`, textContent: t('setting.nickname.about') });
    const idle = `${t('setting.nickname.about')} ${t('settings.nickname.hint')}`;
    help.textContent = idle;
    const hint = () => {
      const clean = sanitizeNickname(input.value);
      help.textContent = clean !== input.value ? t('settings.nickname.saved').replace('{name}', clean) : idle;
    };
    const save = () => {
      const clean = sanitizeNickname(input.value);
      input.value = clean;
      help.textContent = idle;
      if (clean !== access.get().nickname) access.update({ nickname: clean });
    };
    input.addEventListener('input', hint);
    input.addEventListener('change', save);
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
    });
    navs.push(input);
    const element = h('div', { className: 'st-row st-text-field' }, [
      h('div', { className: 'st-text' }, [h('span', { className: 'st-label', id: `${id}-l`, textContent: t('settings.nickname') }), help]),
      h('div', { className: 'st-ctl' }, [input]),
    ]);
    element.dataset.row = 'nickname';
    aboutOf.set(element, idle);
    return element;
  }

  function renderPanel(): void {
    const page = pager.page();
    const active = document.activeElement as HTMLElement | null;
    const keep = active && panel.contains(active) ? (active.closest('[data-row]') as HTMLElement | null)?.dataset.row : undefined;
    for (const box of dropdowns) box.dispose();
    dropdowns = [];
    navs = [];
    aboutOf = new Map();
    const section = sectionsNow()[current]!;
    heading.replaceChildren(pixelIconSvg(section.icon, 'px-icon'), h('span', { textContent: section.title }));
    const rows = section.rows.map(buildRow);
    // The profile lives in General, beside the language.
    if (current === 0) rows.push(nicknameRow());
    rowsBox.replaceChildren(...rows);
    // Same section after a change: stay on the page the player was on; a new section opens on its first page.
    if (rendered === current) {
      pager.refresh();
      pager.go(page);
    } else pager.reset();
    rendered = current;
    navs.push(...pageNav.querySelectorAll<HTMLElement>('button'), ...footButtons);
    tabs.forEach((tab, i) => {
      tab.classList.toggle('is-current', i === current);
      tab.setAttribute('aria-selected', String(i === current));
      tab.tabIndex = i === current ? 0 : -1;
    });
    panel.setAttribute('aria-label', section.title);
    about.textContent = '';
    if (keep) focusRow(keep);
  }

  const focusOf = (row: HTMLElement): HTMLElement | null => row.querySelector<HTMLElement>(FOCUSABLE);
  function focusRow(id: string): void {
    const row = rowsBox.querySelector<HTMLElement>(`[data-row="${id}"]`);
    const target = row ? focusOf(row) : null;
    if (row) pager.reveal(row);
    if (target && !(target as HTMLButtonElement).disabled) target.focus({ preventScroll: true });
    else navs[0]?.focus({ preventScroll: true });
  }

  function setTab(next: number): void {
    current = (next + tabs.length) % tabs.length;
    renderPanel();
    options.onTab?.(current);
  }

  // The help of the row under the cursor, for the short screens where the rows hide theirs.
  const describe = (e: Event) => {
    const row = (e.target as HTMLElement).closest?.<HTMLElement>('.st-row');
    if (row && aboutOf.has(row)) about.textContent = aboutOf.get(row)!;
  };
  panel.addEventListener('focusin', describe);
  panel.addEventListener('pointerover', describe);

  // ---- keyboard and gamepad
  const move = (list: readonly HTMLElement[], from: number, delta: number): HTMLElement | undefined => list[Math.min(list.length - 1, Math.max(0, from + delta))];
  // A row on another page, or the page buttons while there is one page, cannot take the focus.
  const enabled = () => navs.filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true' && !el.closest('.pg-off, [hidden]'));

  const onKey = (e: KeyboardEvent): void => {
    if (!win.isConnected) {
      window.removeEventListener('keydown', onKey, true);
      return;
    }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const target = document.activeElement as HTMLElement | null;
    const popupOpen = target?.getAttribute('aria-expanded') === 'true';
    const typing = target instanceof HTMLInputElement;
    const onSlider = target?.getAttribute('role') === 'slider';
    const inRail = !!target && rail.contains(target);

    if (e.key === 'Escape') {
      if (popupOpen) return;
      e.preventDefault();
      if (typing) target.blur();
      else options.onBack();
      return;
    }
    if (typing && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (popupOpen) return;
    // Q / E (and the page keys, except where a slider uses them) change section.
    if (e.code === 'KeyQ' || e.code === 'KeyE' || ((e.key === 'PageUp' || e.key === 'PageDown') && !onSlider)) {
      e.preventDefault();
      e.stopPropagation();
      setTab(current + (e.code === 'KeyQ' || e.key === 'PageUp' ? -1 : 1));
      tabs[current]!.focus({ preventScroll: true });
      return;
    }
    // Buttons act on Enter and Space. A pad sends synthetic keys, which never click on their own.
    if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLButtonElement && !target.classList.contains('dd')) {
      e.preventDefault();
      target.click();
      return;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      e.preventDefault();
      // The dropdown would open on an arrow: here the arrows move between rows.
      e.stopPropagation();
      if (typing) target.blur();
      if (inRail) {
        const at = tabs.indexOf(target as HTMLButtonElement);
        const next = Math.min(tabs.length - 1, Math.max(0, at + delta));
        if (next !== at) setTab(next);
        tabs[current]!.focus({ preventScroll: true });
        return;
      }
      const list = enabled();
      const at = list.findIndex((el) => el === target || el.contains(target));
      if (at < 0) list[0]?.focus();
      else if (at === 0 && delta < 0) tabs[current]!.focus();
      else move(list, at, delta)?.focus();
      return;
    }
    if (e.key === 'ArrowRight' && inRail) {
      e.preventDefault();
      e.stopPropagation();
      enabled()[0]?.focus();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // Sliders, segmented controls and switches adjust themselves.
      if (onSlider || target?.getAttribute('role') === 'radio' || target?.getAttribute('role') === 'switch') return;
      const at = footButtons.indexOf(target as HTMLButtonElement);
      e.preventDefault();
      e.stopPropagation();
      if (at >= 0) {
        const next = at + (e.key === 'ArrowRight' ? 1 : -1);
        if (next < 0) tabs[current]!.focus();
        else footButtons[Math.min(next, footButtons.length - 1)]!.focus();
      } else if (e.key === 'ArrowLeft') tabs[current]!.focus();
    }
  };
  window.addEventListener('keydown', onKey, true);

  renderPanel();
  queueMicrotask(() => (enabled()[0] ?? tabs[current])?.focus({ preventScroll: true }));
  return {
    element: win,
    dispose() {
      pager.dispose();
      window.removeEventListener('keydown', onKey, true);
      for (const box of dropdowns) box.dispose();
      dropdowns = [];
    },
  };
}
