import '../styles/report-dismiss.css';
import { dropdownKey, type DropdownOption } from './dropdown-model';
import { FORM_ICONS } from './icons/report-icons';
import { pixelSvgOf } from './pixel-icons';
import { h } from './window';

/**
 * The game's own dropdown (never a native `<select>`): a button that opens a
 * listbox popup, the ARIA select-only combobox pattern. Keyboard: Enter,
 * Space and the arrows open it on the chosen option; the arrows, Home and
 * End move; Enter or Space choose; Esc closes only the popup; Tab chooses and
 * moves on; a letter jumps to the next option starting with it
 * (dropdown-model.ts is that model, tested). Mouse and touch: a press on the
 * button toggles, a press on an option chooses, a press anywhere else closes.
 * Each option can carry a pixel icon and a one-line hint. The popup lives on
 * `document.body` (fixed), so a scrolling window or a transformed ancestor
 * never clips it; it carries `.dd-popup`, which the click-outside dismissal
 * (dismiss.ts) knows is not a backdrop.
 */
export interface DropdownItem extends DropdownOption {
  /** A fresh icon node per call (the button and the list each draw one). */
  icon?: () => Node;
  /** A second, dim line under the label. */
  hint?: string;
}

export interface DropdownConfig {
  /** Accessible name of the control (the field's label). */
  label: string;
  items: readonly DropdownItem[];
  /** Selected value; '' shows the placeholder. */
  value: string;
  placeholder?: string;
  onChange(value: string): void;
  className?: string;
  /** The id of the element that labels it, when the label is visible text. */
  labelledBy?: string;
  /** Marks the control invalid for assistive tech and the red frame. */
  invalid?: boolean;
}

export interface Dropdown {
  element: HTMLButtonElement;
  value(): string;
  setValue(value: string): void;
  setInvalid(invalid: boolean): void;
  close(): void;
  dispose(): void;
}

let counter = 0;
const TYPE_AHEAD_MS = 700;

export function dropdown(config: DropdownConfig): Dropdown {
  const uid = `dd${++counter}`;
  let value = config.value;
  const items = config.items;
  let state = { open: false, active: 0 };
  let popup: HTMLUListElement | null = null;
  let typed = '';
  let typedAt = 0;

  const text = h('span', { className: 'dd-text' });
  const caret = h('span', { className: 'dd-caret' }, [pixelSvgOf(FORM_ICONS.caret!, 'px-icon')]);
  caret.setAttribute('aria-hidden', 'true');
  const trigger = h('button', { type: 'button', className: ['dd', config.className ?? ''].filter(Boolean).join(' ') }, [text, caret]);
  trigger.setAttribute('role', 'combobox');
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', `${uid}-list`);
  if (config.labelledBy) trigger.setAttribute('aria-labelledby', `${config.labelledBy} ${uid}-text`);
  else trigger.setAttribute('aria-label', config.label);
  text.id = `${uid}-text`;

  const indexOf = (v: string): number => items.findIndex((i) => i.value === v);
  const paintInvalid = (invalid: boolean) => {
    trigger.classList.toggle('is-invalid', invalid);
    if (invalid) trigger.setAttribute('aria-invalid', 'true');
    else trigger.removeAttribute('aria-invalid');
  };
  paintInvalid(config.invalid ?? false);

  function paint(): void {
    const item = items[indexOf(value)];
    text.replaceChildren(...(item?.icon ? [h('span', { className: 'dd-icon' }, [item.icon()])] : []), h('span', { className: 'dd-label' + (item ? '' : ' is-placeholder'), textContent: item?.label ?? config.placeholder ?? '' }));
  }

  function paintActive(): void {
    if (!popup) return;
    [...popup.children].forEach((li, i) => {
      const on = i === state.active;
      li.classList.toggle('is-active', on);
      if (on) {
        trigger.setAttribute('aria-activedescendant', li.id);
        (li as HTMLElement).scrollIntoView?.({ block: 'nearest' });
      }
    });
  }

  function place(): void {
    if (!popup) return;
    const box = trigger.getBoundingClientRect();
    const gap = 4;
    const below = window.innerHeight - box.bottom - gap - 8;
    const above = box.top - gap - 8;
    const openUp = below < 200 && above > below;
    const room = Math.max(120, Math.min(460, openUp ? above : below));
    popup.style.left = `${Math.max(8, Math.min(box.left, window.innerWidth - Math.max(box.width, 220) - 8))}px`;
    popup.style.minWidth = `${box.width}px`;
    popup.style.maxHeight = `${room}px`;
    if (openUp) {
      popup.style.top = '';
      popup.style.bottom = `${window.innerHeight - box.top + gap}px`;
    } else {
      popup.style.bottom = '';
      popup.style.top = `${box.bottom + gap}px`;
    }
  }

  const outside = (e: Event): void => {
    const target = e.target as Node | null;
    if (target && (popup?.contains(target) || trigger.contains(target))) return;
    close();
  };
  const reflow = (e: Event): void => {
    if (e.target instanceof Node && popup?.contains(e.target)) return;
    close();
  };

  function choose(index: number): void {
    const item = items[index];
    close();
    if (!item || item.disabled) return;
    const changed = item.value !== value;
    value = item.value;
    paint();
    if (changed) config.onChange(value);
  }

  function open(active: number): void {
    if (popup) return;
    state = { open: true, active };
    popup = h('ul', { className: 'dd-popup', id: `${uid}-list` });
    popup.setAttribute('role', 'listbox');
    popup.setAttribute('aria-label', config.label);
    items.forEach((item, i) => {
      const li = h('li', { className: 'dd-option' + (item.disabled ? ' is-disabled' : ''), id: `${uid}-o${i}` }, [
        ...(item.icon ? [h('span', { className: 'dd-icon' }, [item.icon()])] : []),
        h('span', { className: 'dd-body' }, [h('span', { className: 'dd-label', textContent: item.label }), item.hint ? h('span', { className: 'dd-hint', textContent: item.hint }) : null]),
        h('span', { className: 'dd-mark', textContent: i === indexOf(value) ? '✓' : '' }),
      ]);
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === indexOf(value)));
      if (item.disabled) li.setAttribute('aria-disabled', 'true');
      // Keep the focus on the button: the press must not blur it.
      li.addEventListener('pointerdown', (e) => e.preventDefault());
      li.addEventListener('pointermove', () => {
        if (state.active !== i && !item.disabled) {
          state = { open: true, active: i };
          paintActive();
        }
      });
      li.addEventListener('click', () => choose(i));
      popup!.append(li);
    });
    document.body.append(popup);
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    place();
    paintActive();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', reflow, true);
  }

  function close(): void {
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', close);
    window.removeEventListener('scroll', reflow, true);
    state = { open: false, active: state.active };
    popup?.remove();
    popup = null;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    trigger.classList.remove('is-open');
  }

  trigger.addEventListener('pointerdown', (e) => {
    // A press toggles the list; the click that follows must not toggle it again.
    if (e.button !== 0) return;
    e.preventDefault();
    trigger.focus();
    if (popup) close();
    else open(Math.max(0, indexOf(value)));
  });
  // Keyboard-synthesised clicks are handled by keydown; swallow them.
  trigger.addEventListener('click', (e) => e.preventDefault());

  trigger.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const now = Date.now();
    if (e.key.length === 1 && e.key !== ' ') {
      typed = now - typedAt > TYPE_AHEAD_MS ? e.key : typed + e.key;
      typedAt = now;
    }
    const out = dropdownKey(state, e.key, items, Math.max(0, indexOf(value)), e.key.length === 1 && e.key !== ' ' ? typed : e.key);
    if (out.handled) {
      e.preventDefault();
      e.stopPropagation();
    }
    const wasOpen = state.open;
    state = out.state;
    if (out.commit !== undefined) choose(out.commit);
    else if (out.state.open && !wasOpen) open(out.state.active);
    else if (!out.state.open && wasOpen) close();
    else paintActive();
  });
  trigger.addEventListener('blur', () => {
    // A press inside the popup keeps focus here (pointerdown is prevented), so a blur means focus really left.
    if (popup) close();
  });

  paint();
  return {
    element: trigger,
    value: () => value,
    setValue(next) {
      value = next;
      paint();
    },
    setInvalid: paintInvalid,
    close,
    dispose() {
      close();
      trigger.remove();
    },
  };
}
