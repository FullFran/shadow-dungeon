import { t } from '../i18n';
import { sanitizeNickname, NICKNAME_MAX } from '../net/nickname';
import { dropdown, type Dropdown } from '../ui/dropdown';
import { pixelIconSvg, type PixelIconId } from '../ui/pixel-icons';
import { isCompactTouch } from '../ui/compact-touch';
import { attachPager } from '../ui/pager';
import { slider } from '../ui/slider';
import { h, mdWindow } from '../ui/window';
import { SETTING_SLIDERS, applySetting, settingChoice, settingChoices, settingControlKind, settingRows, settingSections, type SettingRow, type SettingsAccess } from './settings-panel';
import { inputOf, rebind, resetBindings, type BindAction } from '../adapters/bindings';
import { bindingRows, rebindFeedback } from './key-bindings-panel';
import '../styles/settings.css';
import { deviceHint } from '../ui/device-hint';

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
 * The last section, Keyboard and mouse (issue #62), rebinds the play keys: click a box (or Enter on it), then press
 * the new key or mouse button; Esc cancels. Its model is key-bindings-panel.ts, the conflict policy bindings.ts.
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

const FOCUSABLE = '[role="slider"], button[role="switch"], button[role="radio"][tabindex="0"], button.dd, input, button.st-key:not(:disabled), button.st-reset';

export function settingsView(options: SettingsViewOptions): SettingsView {
  const { access } = options;
  let current = options.tab ?? 0;
  let dropdowns: Dropdown[] = [];
  let navs: HTMLElement[] = [];
  let aboutOf = new Map<HTMLElement, string>();
  let rendered = -1;

  const sectionsNow = () => settingSections(settingRows(access));
  const sections = sectionsNow();
  // The keyboard and mouse section comes after the model's sections (its rows are not settings rows).
  const keysTab = sections.length;
  const railEntries: { title: string; icon: PixelIconId }[] = [...sections, { title: t('bind.tab'), icon: 'controls' }];
  current = Math.min(Math.max(0, current), railEntries.length - 1);

  // ---- rail
  const tabs = railEntries.map((section, i) => {
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
  const foot = h('div', { className: 'st-foot' }, [h('div', { className: 'st-actions' }, footButtons), pageNav, about, deviceHint('st-keys', 'settings.hint')]);

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

  // ---- keyboard and mouse
  /** The slot waiting for a key or mouse button. */
  let listening: { action: BindAction; slot: 0 | 1 } | null = null;
  /** The click (and context menu) that follows a captured mouse button, and the keyup of a captured key, are eaten. */
  let swallowClick = false;
  let swallowKeyUp: string | null = null;
  const bindStatus = h('p', { className: 'st-bind-status' });
  bindStatus.setAttribute('aria-live', 'polite');

  function bindingElements(): HTMLElement[] {
    const rows = bindingRows(access.get().keyBindings).map((row) => {
      const id = `st-bind-${row.action}`;
      const keys = row.slots.map((slot, i) => {
        const waiting = listening?.action === row.action && listening.slot === i;
        const button = h('button', { type: 'button', className: `st-key${slot.input ? '' : ' is-empty'}${waiting ? ' is-listening' : ''}`, textContent: waiting ? '…' : slot.label });
        button.setAttribute('aria-label', `${row.label}, ${t(i === 0 ? 'bind.primary' : 'bind.secondary')}: ${slot.label}`);
        button.dataset.slot = String(i);
        button.disabled = slot.fixed;
        button.addEventListener('click', () => listen(row.action, i as 0 | 1));
        navs.push(button);
        return button;
      });
      const element = h('div', { className: 'st-row st-kind-binding' }, [
        h('div', { className: 'st-text' }, [h('span', { className: 'st-label', id: `${id}-l`, textContent: row.label })]),
        h('div', { className: 'st-ctl st-bindkeys' }, keys),
      ]);
      element.dataset.row = `bind-${row.action}`;
      aboutOf.set(element, t('bind.about'));
      return element;
    });
    const reset = h('button', { type: 'button', className: 'st-btn st-reset', textContent: t('bind.reset') });
    reset.addEventListener('click', () => {
      listening = null;
      access.update({ keyBindings: resetBindings() });
      renderPanel();
      bindStatus.textContent = t('bind.resetDone');
    });
    navs.push(reset);
    const resetRow = h('div', { className: 'st-row st-kind-reset' }, [h('div', { className: 'st-text' }, [h('p', { className: 'st-bind-note', textContent: t('bind.note') })]), h('div', { className: 'st-ctl' }, [reset])]);
    resetRow.dataset.row = 'bind-reset';
    aboutOf.set(resetRow, t('bind.note'));
    return [...rows, resetRow, bindStatus];
  }

  function listen(action: BindAction, slot: 0 | 1): void {
    listening = { action, slot };
    renderPanel();
    bindStatus.textContent = t('bind.listening');
    focusSlot(action, slot);
  }

  function focusSlot(action: BindAction, slot: 0 | 1): void {
    const button = rowsBox.querySelector<HTMLElement>(`[data-row="bind-${action}"] .st-key[data-slot="${slot}"]`);
    if (button) {
      pager.reveal(button.closest<HTMLElement>('.st-row')!);
      button.focus({ preventScroll: true });
    }
  }

  /** Ends the capture: `input` is bound (or refused), null cancels. */
  function capture(input: string | null): void {
    const waiting = listening;
    listening = null;
    if (!waiting) return;
    let message = t('bind.cancelled');
    if (input !== null) {
      const result = rebind(access.get().keyBindings, waiting.action, waiting.slot, input);
      if (result.kind !== 'refused') access.update({ keyBindings: result.bindings });
      message = rebindFeedback(result, waiting.action, input);
    }
    renderPanel();
    bindStatus.textContent = message;
    focusSlot(waiting.action, waiting.slot);
  }

  const onCaptureKey = (e: KeyboardEvent): void => {
    if (!listening) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat) return;
    // Esc cancels (the pad's B sends it too); other synthetic pad keys bind nothing.
    if (e.code === 'Escape') capture(null);
    else if (e.isTrusted) {
      swallowKeyUp = e.code;
      capture(e.code);
    }
  };
  const onCaptureKeyUp = (e: KeyboardEvent): void => {
    // A Space keyup on the focused box would click it again.
    if (swallowKeyUp !== e.code) return;
    swallowKeyUp = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const onCaptureMouse = (e: MouseEvent): void => {
    if (!listening) {
      // A new press: whatever click the captured button left pending (not every button sends one) is gone.
      swallowClick = false;
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    swallowClick = true;
    capture(inputOf(e.button));
  };
  const onCaptureClick = (e: MouseEvent): void => {
    if (!swallowClick) return;
    if (e.type !== 'contextmenu') swallowClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const CAPTURE_EVENTS = [
    ['keydown', onCaptureKey],
    ['keyup', onCaptureKeyUp],
    ['mousedown', onCaptureMouse],
    ['click', onCaptureClick],
    ['auxclick', onCaptureClick],
    ['contextmenu', onCaptureClick],
  ] as const;
  // Registered before the window's own key handler below, so a captured key never moves the cursor or changes section.
  for (const [type, handler] of CAPTURE_EVENTS) window.addEventListener(type, handler as EventListener, true);
  const removeCapture = () => {
    for (const [type, handler] of CAPTURE_EVENTS) window.removeEventListener(type, handler as EventListener, true);
  };

  function renderPanel(): void {
    const page = pager.page();
    const active = document.activeElement as HTMLElement | null;
    const keep = active && panel.contains(active) ? (active.closest('[data-row]') as HTMLElement | null)?.dataset.row : undefined;
    for (const box of dropdowns) box.dispose();
    dropdowns = [];
    navs = [];
    aboutOf = new Map();
    const section = current === keysTab ? { title: t('bind.section'), icon: 'controls' as const, rows: [] } : sectionsNow()[current]!;
    heading.replaceChildren(pixelIconSvg(section.icon, 'px-icon'), h('span', { textContent: section.title }));
    if (current !== keysTab) bindStatus.textContent = '';
    const rows = current === keysTab ? bindingElements() : section.rows.map(buildRow);
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
    listening = null;
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
      removeCapture();
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
    // The two boxes of a binding row: Left / Right move between them.
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && target?.classList.contains('st-key')) {
      e.preventDefault();
      e.stopPropagation();
      const boxes = [...(target.parentElement?.querySelectorAll<HTMLButtonElement>('.st-key:not(:disabled)') ?? [])];
      const at = boxes.indexOf(target as HTMLButtonElement);
      const next = at + (e.key === 'ArrowRight' ? 1 : -1);
      if (next < 0) tabs[current]!.focus();
      else boxes[Math.min(next, boxes.length - 1)]?.focus();
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
      removeCapture();
      for (const box of dropdowns) box.dispose();
      dropdowns = [];
    },
  };
}
