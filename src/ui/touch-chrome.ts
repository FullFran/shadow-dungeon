import { t } from '../i18n';
import { h } from './window';

/**
 * Page-level touch chrome, shown only with `html.touch` (index.html CSS):
 * an on-screen "Atrás" button for the screens whose way back is Esc (it
 * sends the same Escape key the cursor lists, the town and the quiz already
 * handle), and a rotate-device hint in portrait. The CSS hides "Atrás" where
 * Esc means nothing or has its own button (title, prologue, run).
 * Long-press menus and text selection are blocked by the same class.
 */
export interface TouchChrome {
  /** Re-reads the texts after a language change. */
  refresh(): void;
}

/** The Escape key as the menus see it (cursor lists and scenes listen on window). */
export function sendEscape(): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }));
}

export function installTouchChrome(parent: HTMLElement = document.body): TouchChrome {
  const back = h('button', { type: 'button', className: 'touch-back' });
  back.addEventListener('click', (e) => {
    e.preventDefault();
    sendEscape();
  });
  const rotate = h('p', { className: 'rotate-hint' });
  rotate.setAttribute('role', 'status');
  // No long-press context menu on touch (images, canvases, buttons).
  window.addEventListener('contextmenu', (e) => {
    if (document.documentElement.classList.contains('touch') && !(e.target instanceof HTMLInputElement)) e.preventDefault();
  });
  const refresh = () => {
    back.textContent = t('touch.back');
    back.setAttribute('aria-label', t('touch.back'));
    rotate.textContent = t('touch.rotate');
  };
  refresh();
  parent.append(back, rotate);
  return { refresh };
}
