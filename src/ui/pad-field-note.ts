import { t } from '../i18n';
import '../styles/pad-field-note.css';

/**
 * Text fields and the controller (issue #32; owner's answer in odd/tasks/gamepad.md L4): there is no on-screen
 * keyboard, so the limit is said where it bites. While a field is focused a note sits under it, and the CSS shows it
 * only under `html.pad` (src/adapters/pad-class.ts), the controller being the device used last. One listener for the
 * whole page, so every field has it: room code, nicknames, friend code, account and Clerk sign-in, reports, the admin
 * search, and the backup import's file dialog. The pad still leaves the field: its arrows move the focus on
 * (src/adapters/gamepad.ts padKeyDefault).
 */
export type PadLimit = 'type' | 'file';

export const PAD_LIMIT_KEYS: Readonly<Record<PadLimit, string>> = { type: 'gamepad.limit.type', file: 'gamepad.limit.file' };

/** The focused element, as far as the pad's limits care. */
export interface LimitTarget {
  tag: string;
  type?: string;
  editable?: boolean;
  /** `data-pad-limit`: a control that opens something the pad cannot drive (the backup import's file dialog). */
  limit?: string | null;
}

/** Inputs that are not typed in. */
const NOT_TYPED = new Set(['button', 'submit', 'reset', 'image', 'checkbox', 'radio', 'range', 'color', 'hidden']);

export function padFieldLimit(target: LimitTarget): PadLimit | null {
  if (target.limit === 'file') return 'file';
  if (target.tag === 'INPUT') return target.type === 'file' ? 'file' : NOT_TYPED.has(target.type ?? 'text') ? null : 'type';
  if (target.tag === 'TEXTAREA' || target.editable) return 'type';
  return null;
}

const limitOf = (el: Element): PadLimit | null =>
  el instanceof HTMLElement
    ? padFieldLimit({ tag: el.tagName, type: el instanceof HTMLInputElement ? el.type : undefined, editable: el.isContentEditable, limit: el.dataset.padLimit ?? null })
    : null;

/** Installs the note for the page; returns the function that removes it. */
export function installPadFieldNote(): () => void {
  const note = document.createElement('p');
  note.className = 'pad-field-note';
  note.hidden = true;
  let field: HTMLElement | null = null;
  const place = () => {
    if (!field) return;
    const r = field.getBoundingClientRect();
    const below = r.bottom + 6;
    const fitsBelow = below + note.offsetHeight <= window.innerHeight;
    note.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - note.offsetWidth - 8))}px`;
    note.style.top = `${fitsBelow ? below : Math.max(8, r.top - note.offsetHeight - 6)}px`;
  };
  const hide = () => {
    field = null;
    note.hidden = true;
  };
  const onFocusIn = (e: FocusEvent) => {
    const target = e.target instanceof Element ? e.target : null;
    const limit = target ? limitOf(target) : null;
    if (!target || !limit) return hide();
    field = target as HTMLElement;
    note.textContent = t(PAD_LIMIT_KEYS[limit]);
    note.hidden = false;
    // Above every window and drawer: it belongs to the field, wherever the field sits.
    document.body.appendChild(note);
    place();
  };
  const onFocusOut = (e: FocusEvent) => {
    if (e.target === field) hide();
  };
  document.addEventListener('focusin', onFocusIn, true);
  document.addEventListener('focusout', onFocusOut, true);
  window.addEventListener('scroll', place, true);
  window.addEventListener('resize', place);
  return () => {
    document.removeEventListener('focusin', onFocusIn, true);
    document.removeEventListener('focusout', onFocusOut, true);
    window.removeEventListener('scroll', place, true);
    window.removeEventListener('resize', place);
    note.remove();
  };
}
