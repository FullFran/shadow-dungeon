import '../styles/relic-controls.css';
import '../styles/status.css';
import { errorMessageKey, type AppError, type ErrorKind } from '../adapters/net-error';
import { t } from '../i18n';
import { pixelIconSvg } from './pixel-icons';

/**
 * Error states (.agents/DESIGN.md §4 "Errors"), one vocabulary for the whole
 * game: an inline line for a field, a card for a panel (with the next step),
 * a full-screen fatal error, and a toast for background failures. Every
 * message comes from the typed error model (`error.<kind>.title` / `.hint`).
 * Colours only from tokens; no native dialog.
 */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', `rk-btn ${className}`, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** One line under a field: what went wrong, in the danger colour, announced to screen readers. */
export function inlineError(message: string): HTMLElement {
  const line = el('p', 'st-inline', message);
  line.setAttribute('role', 'alert');
  return line;
}

export interface ErrorCardOptions {
  kind: ErrorKind | AppError;
  /** Tries again; shown as "Reintentar" for the kinds a retry can fix. */
  onRetry?: () => void;
  /** A different next step (e.g. signing in again for `auth`): label and action. */
  action?: { label: string; run: () => void };
  /** Replace the kind's own hint with a more specific line. */
  hint?: string;
}

/** A panel's error: the title, one hint, and the next step as a button. */
export function errorCard(options: ErrorCardOptions): HTMLElement {
  const error = typeof options.kind === 'string' ? { kind: options.kind, retryable: options.kind === 'offline' || options.kind === 'timeout' || options.kind === 'server' } : options.kind;
  const prefix = errorMessageKey(error.kind);
  const card = el('section', 'st-card');
  card.setAttribute('role', 'alert');
  const title = el('h3', 'st-card-title', t(`${prefix}.title`));
  const hint = el('p', 'st-card-hint', options.hint ?? t(`${prefix}.hint`));
  const actions = el('div', 'st-card-actions');
  if (options.action) actions.append(button(options.action.label, 'rk-ember', options.action.run));
  else if (options.onRetry && error.retryable) {
    const retry = button(t('error.retry'), 'rk-ember', () => {
      retry.disabled = true;
      retry.textContent = t('error.retrying');
      options.onRetry?.();
    });
    actions.append(retry);
  }
  card.append(pixelIconSvg('lock', 'px-icon st-card-icon'), title, hint);
  if (actions.childElementCount) card.append(actions);
  return card;
}

export interface FatalOptions {
  onReload: () => void;
  /** The technical report text to copy, built by the diagnostics. */
  report: () => Promise<string>;
}

/** The last resort: the game cannot go on. Reload, or copy the technical report to send. */
export function fatalError(options: FatalOptions): HTMLElement {
  const root = el('div', 'st-fatal');
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-labelledby', 'st-fatal-title');
  const body = el('section', 'st-card st-fatal-card');
  const title = el('h2', 'st-card-title', t('error.fatal.title'));
  title.id = 'st-fatal-title';
  const note = el('p', 'st-fatal-note');
  note.setAttribute('role', 'status');
  const copy = button(t('error.copyReport'), '', () => {
    options
      .report()
      .then((text) => navigator.clipboard.writeText(text))
      .then(
        () => (note.textContent = t('error.reportCopied')),
        () => (note.textContent = t('error.reportFailed')),
      );
  });
  const actions = el('div', 'st-card-actions');
  actions.append(button(t('error.reload'), 'rk-ember', options.onReload), copy);
  body.append(pixelIconSvg('lock', 'px-icon st-card-icon'), title, el('p', 'st-card-hint', t('error.fatal.hint')), actions, note);
  root.append(body);
  return root;
}

/** A short notice over whatever is on screen for a background failure (cloud sync, assets): never blocks, goes by itself. */
export function showToast(message: string, ms = 6000): void {
  const toast = el('div', 'st-toast', message);
  toast.setAttribute('role', 'status');
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), ms);
}

/** The offline banner: a thin relic strip at the top while there is no connection. Returns the update function. */
export function offlineBanner(): { element: HTMLElement; set(online: boolean): void } {
  const element = el('div', 'st-offline', t('offline.banner'));
  element.setAttribute('role', 'status');
  element.hidden = true;
  return {
    element,
    set(online) {
      if (online) {
        if (!element.hidden) {
          element.textContent = t('offline.back');
          element.classList.add('is-back');
          window.setTimeout(() => {
            element.hidden = true;
            element.classList.remove('is-back');
          }, 2200);
        }
      } else {
        element.textContent = t('offline.banner');
        element.classList.remove('is-back');
        element.hidden = false;
      }
    },
  };
}
