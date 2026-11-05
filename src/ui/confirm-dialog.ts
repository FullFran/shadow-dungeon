import { t } from '../i18n';
import { h, mdWindow } from './window';
import '../styles/confirm-dialog.css';

/**
 * The shared confirmation before spending (owner, 2026-11-03: "haz confirmación para
 * evolucionar y para aprender movimientos, que ahora mismo de un click te lo gastas"):
 * a relic window over a dark veil with Cancel (focused first, the safe choice) and the
 * ember Confirm. Arrows switch, Enter resolves the focused button, Esc or a press on the
 * veil cancels. Keys never reach the menu underneath while it is open. Never a native confirm().
 */
export type ConfirmChoice = 'cancel' | 'confirm';

export interface ConfirmState {
  focus: ConfirmChoice;
  result: ConfirmChoice | null;
  key(k: string): ConfirmState;
}

export function confirmModel(focus: ConfirmChoice = 'cancel', result: ConfirmChoice | null = null): ConfirmState {
  return {
    focus,
    result,
    key(k: string): ConfirmState {
      if (k === 'Escape') return confirmModel(focus, 'cancel');
      if (k === 'Enter' || k === ' ') return confirmModel(focus, focus);
      if (k === 'ArrowLeft' || k === 'ArrowUp') return confirmModel('cancel', result);
      if (k === 'ArrowRight' || k === 'ArrowDown') return confirmModel('confirm', result);
      if (k === 'Tab') return confirmModel(focus === 'cancel' ? 'confirm' : 'cancel', result);
      return this;
    },
  };
}

export interface ConfirmOptions {
  title: string;
  /** What will happen, in one or two short lines (or a node with icons and costs). */
  body: string | Node;
  confirmLabel: string;
  cancelLabel?: string;
  /** Shown above the buttons, e.g. "180 P" or the materials it takes. */
  cost?: Node;
}

/** Opens the confirmation over the page; resolves true only when Confirm is chosen. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const previous = document.activeElement as HTMLElement | null;
    let state = confirmModel();
    const cancel = h('button', { className: 'rc-cancel', type: 'button', textContent: options.cancelLabel ?? t('confirm.cancel') });
    const confirm = h('button', { className: 'rc-confirm', type: 'button', textContent: options.confirmLabel });
    const body = typeof options.body === 'string' ? h('p', { className: 'rc-body', textContent: options.body }) : options.body;
    const win = mdWindow({ title: options.title, className: 'rc-window' }, [body, ...(options.cost ? [h('div', { className: 'rc-cost' }, [options.cost])] : []), h('div', { className: 'rc-actions' }, [cancel, confirm])]);
    win.setAttribute('role', 'alertdialog');
    win.setAttribute('aria-modal', 'true');
    win.setAttribute('aria-label', options.title);
    const veil = h('div', { className: 'rc-veil' }, [win]);
    const focusNow = () => (state.focus === 'cancel' ? cancel : confirm).focus({ preventScroll: true });
    const finish = (choice: ConfirmChoice) => {
      window.removeEventListener('keydown', onKey, true);
      veil.remove();
      previous?.focus?.({ preventScroll: true });
      resolve(choice === 'confirm');
    };
    const onKey = (e: KeyboardEvent) => {
      // Captured before the menu underneath sees it.
      e.stopPropagation();
      e.preventDefault();
      state = state.key(e.key);
      if (state.result) finish(state.result);
      else focusNow();
    };
    cancel.addEventListener('click', () => finish('cancel'));
    confirm.addEventListener('click', () => finish('confirm'));
    cancel.addEventListener('focus', () => (state = confirmModel('cancel')));
    confirm.addEventListener('focus', () => (state = confirmModel('confirm')));
    veil.addEventListener('pointerdown', (e) => {
      if (e.target === veil) finish('cancel');
    });
    window.addEventListener('keydown', onKey, true);
    document.body.append(veil);
    focusNow();
  });
}
