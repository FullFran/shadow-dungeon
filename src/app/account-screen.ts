import { apiBaseUrl, httpAccountApi } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { createAccount, MIN_PASSWORD, type Account, type AccountError, type Notice, type SaveSummary } from './account';
import { observeKey, realTimers } from './cloud-sync';
import { SAVE_KEY } from './save';

/**
 * Account wiring and screen (docs/gdd.md, Cuentas). `setupAccount` builds
 * the account over the device store and returns the store the game must use:
 * the same store, observed, so every save write (save.ts `writeSave`) is
 * pushed to the cloud while signed in. A guest makes no request.
 */
export function setupAccount(options: { store: KeyValueStore; notify(text: string): void; onChange(): void }): { account: Account; store: KeyValueStore } {
  const account = createAccount({
    api: httpAccountApi(apiBaseUrl(import.meta.env.VITE_API_URL)),
    store: options.store,
    timers: realTimers,
    onNotice: (notice: Notice) => options.notify(t(`account.notice.${notice}`)),
    onChange: options.onChange,
  });
  const store = observeKey(options.store, SAVE_KEY, () => account.saveChanged());
  // Leaving the page or switching apps: push what is queued now. Back online: retry.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) account.flush();
  });
  window.addEventListener('online', () => account.online());
  void account.start();
  return { account, store };
}

export interface AccountScreenOptions {
  account: Account;
  /** Rebuilds the screen (after signing in or out, or a choice). */
  refresh(): void;
  onBack(): void;
}

const summaryText = (summary: SaveSummary): HTMLElement =>
  h('span', { className: 'account-summary', textContent: t('account.summary').replace('{coins}', String(summary.coins)).replace('{owned}', String(summary.owned)) });

/** A text field in the room-code field's look, without its capitals. */
function field(type: 'email' | 'password', autocomplete: AutoFill, label: string): HTMLInputElement {
  const input = h('input', { type, className: 'code-input account-input', placeholder: label });
  input.autocomplete = autocomplete;
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  input.setAttribute('autocorrect', 'off');
  input.setAttribute('aria-label', label);
  return input;
}

/** The account window: sign in or up as a guest, the first-login choice, or the signed-in account. */
export function accountWindow(options: AccountScreenOptions, confirmDelete = false): HTMLElement {
  const { account } = options;
  const status = h('p', { className: 'lobby-error account-status' });
  status.setAttribute('role', 'status');
  let busy = false;
  /** Runs one request at a time; an error stays on screen, success rebuilds it. */
  const run = async (task: () => Promise<{ ok: boolean; error?: AccountError }>) => {
    if (busy) return;
    busy = true;
    status.textContent = t('account.busy');
    const result = await task();
    busy = false;
    if (result.ok) options.refresh();
    else status.textContent = t(`account.error.${result.error}`);
  };
  const state = account.state();
  const choice = account.pendingChoice();
  let body: Node[];
  let items: ListItem[];

  if (state.kind === 'signed-in' && choice) {
    body = [h('p', { textContent: t('account.chooseIntro') })];
    items = [
      { label: t('account.keepDevice'), value: summaryText(choice.device), onConfirm: () => (account.choose('device'), options.refresh()) },
      { label: t('account.keepCloud'), value: summaryText(choice.cloud), onConfirm: () => (account.choose('cloud'), options.refresh()) },
    ];
  } else if (state.kind === 'signed-in' && confirmDelete) {
    body = [h('p', { textContent: t('account.deleteConfirm') })];
    items = [
      { label: t('account.deleteYes'), className: 'danger', onConfirm: () => void run(() => account.deleteAccount()) },
      { label: t('account.deleteNo'), onConfirm: options.refresh },
    ];
  } else if (state.kind === 'signed-in') {
    body = [h('p', {}, [t('account.signedInAs'), ' ', h('span', { className: 'account-email', textContent: state.email })]), h('p', { className: 'dim', textContent: t('account.synced') })];
    items = [
      {
        label: t('account.logOut'),
        onConfirm: () => {
          account.logOut();
          options.refresh();
        },
      },
      { label: t('account.delete'), onConfirm: () => deleteView() },
      { label: t('menu.back'), onConfirm: options.onBack },
    ];
  } else {
    const email = field('email', 'username', t('account.email'));
    const password = field('password', 'current-password', t('account.password'));
    password.minLength = MIN_PASSWORD;
    const logIn = () => void run(() => account.logIn(email.value, password.value));
    const register = () => void run(() => account.register(email.value, password.value));
    email.enterKeyHint = 'next';
    password.enterKeyHint = 'go';
    email.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') password.focus();
    });
    password.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') logIn();
    });
    body = [h('p', { textContent: t('account.guestIntro') })];
    items = [
      // The fields are the rows (their placeholder names them): two lines less on a phone.
      { label: email, className: 'account-row', onConfirm: () => email.focus() },
      { label: password, className: 'account-row', onConfirm: () => password.focus() },
      { label: t('account.logIn'), onConfirm: logIn },
      { label: t('account.register'), onConfirm: register },
      { label: t('menu.back'), onConfirm: options.onBack },
    ];
  }

  const list = cursorList({ items, onBack: options.onBack, label: t('account.title') });
  const panel = mdWindow({ title: t('account.title'), className: 'online account' }, [
    ...body,
    list.element,
    status,
    h('p', { className: 'dim account-note', textContent: state.kind === 'guest' ? `${t('account.privacy')} ${t('account.forgot')}` : t('account.privacy') }),
  ]);
  function deleteView(): void {
    panel.replaceWith(accountWindow(options, true));
  }
  return panel;
}
