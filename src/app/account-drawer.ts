import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { ACCOUNT_ICONS, type AccountIconId } from '../ui/icons/account-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h } from '../ui/window';
import type { Account, ChoiceAnswer } from './account';
import { choiceView, cardText, dateText, reasonText, saveFile, statusText, type ChoiceStep } from './account-screen';
import { backTarget, focusMove, GUEST_CONS, GUEST_PROS, modeView, outcomeOf, type DrawerMode, type FieldKind, type FlowAction } from './account-drawer-model';
import type { AuthFlow, FlowResult } from './auth-flow';
import { backupProfile, parseImport } from './backups';
import { profileSummary } from './profile';
import '../styles/relic-controls.css';
import '../styles/account-drawer.css';

/**
 * The account drawer (owner, 2026-11-04: "un login rápido tipo drawer lateral"):
 * slides in from the right over a darkened scene. Signed out it offers Google,
 * Discord, email + password (sign-up with an emailed code, password recovery)
 * and, as an equal choice, playing as a guest with what an account adds and
 * what a guest gives up. Signed in it shows the account, its sync, backups,
 * sign-out and the two deletions, each behind the shared confirmation.
 * Pending state shows at once; errors stay inline. Keyboard: focus is trapped,
 * arrows and Tab move, Enter acts, Esc or a press outside closes.
 */
export interface AccountDrawerOptions {
  account: Account;
  flow: AuthFlow;
  /** Called after the drawer is gone (Esc, outside press, close or "seguir como invitado"). */
  onClose(): void;
  parent?: HTMLElement;
}

export interface AccountDrawer {
  /** Redraws for a change of the account (signed in or out, a sync choice), unless the player is typing as a guest. */
  redraw(): void;
  close(): void;
  element: HTMLElement;
}

const icon = (id: AccountIconId): SVGSVGElement => pixelSvgOf(ACCOUNT_ICONS[id], 'px-icon');

/** What the player sees apart from the forms. */
type View = 'main' | 'backups';

export function openAccountDrawer(options: AccountDrawerOptions): AccountDrawer {
  const { account, flow } = options;
  const parent = options.parent ?? document.body;
  const previous = document.activeElement as HTMLElement | null;

  let mode: DrawerMode = 'sign-in';
  /** The form the code step came from (where "Atrás" returns). */
  let origin: DrawerMode = 'sign-in';
  let view: View = 'main';
  let busy = false;
  let error: string | null = null;
  let notice: string | null = null;
  let closed = false;
  let lastKind = account.state().kind;
  const values: Record<FieldKind, string> = { email: '', password: '', code: '' };

  const panel = h('aside', { className: 'md-window still ad-drawer' });
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const veil = h('div', { className: 'drawer-veil' }, [panel]);

  const say = h('p', { className: 'ad-say' });
  say.setAttribute('role', 'status');
  say.setAttribute('aria-live', 'polite');

  function close(): void {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    veil.remove();
    previous?.focus?.({ preventScroll: true });
    options.onClose();
  }

  // ---- building blocks
  const button = (label: string, variant: string, run: () => void, glyph?: AccountIconId): HTMLButtonElement => {
    const el = h('button', { type: 'button', className: `rk-btn ${variant}` }, [glyph ? icon(glyph) : null, h('span', { textContent: label })]);
    el.addEventListener('click', run);
    return el;
  };
  const link = (label: string, run: () => void): HTMLButtonElement => {
    const el = h('button', { type: 'button', className: 'rk-link', textContent: label });
    el.addEventListener('click', run);
    return el;
  };

  /** A native text field in the relic skin; its value is kept across redraws. */
  function field(kind: FieldKind, label: string, submit: () => void): HTMLInputElement {
    const input = h('input', { type: kind === 'password' ? 'password' : kind === 'email' ? 'email' : 'text', className: 'rk-input', placeholder: label });
    input.value = values[kind];
    input.spellcheck = false;
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', label);
    input.dataset.field = kind;
    if (kind === 'email') {
      input.autocomplete = 'username';
      input.inputMode = 'email';
    } else if (kind === 'password') {
      input.autocomplete = mode === 'sign-in' ? 'current-password' : 'new-password';
      input.minLength = 8;
    } else {
      input.autocomplete = 'one-time-code';
      input.inputMode = 'numeric';
    }
    input.addEventListener('input', () => {
      values[kind] = input.value;
      if (input.getAttribute('aria-invalid')) input.removeAttribute('aria-invalid');
    });
    input.dataset.submit = '1';
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const inputs = [...panel.querySelectorAll<HTMLInputElement>('form input')];
      const next = inputs[inputs.indexOf(input) + 1];
      if (next) next.focus();
      else submit();
    });
    return input;
  }

  // ---- actions
  /** Runs one request at a time: the pending state shows before the first byte leaves. */
  async function run(action: FlowAction, task: () => Promise<FlowResult>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    notice = null;
    say.textContent = t('account.busy');
    panel.classList.add('is-busy');
    panel.querySelectorAll<HTMLButtonElement>('button[data-cta], button[data-provider]').forEach((b) => (b.disabled = true));
    const result = await task();
    busy = false;
    panel.classList.remove('is-busy');
    if (closed) return;
    const outcome = outcomeOf(action, result, mode);
    error = outcome.error;
    notice = outcome.notice;
    if (outcome.mode === 'signed-in') {
      values.password = '';
      values.code = '';
      notice = 'account.drawer.signedIn';
      lastKind = account.state().kind;
      render();
      return;
    }
    if (outcome.mode !== mode) {
      if (outcome.mode === 'verify' || outcome.mode === 'reset') origin = mode;
      mode = outcome.mode;
    }
    render();
    if (error) {
      const bad = panel.querySelector<HTMLInputElement>(action === 'verify' || action === 'reset' ? 'input[data-field="code"]' : action === 'sign-in' ? 'input[data-field="password"]' : 'input[data-field="email"]');
      bad?.setAttribute('aria-invalid', 'true');
      bad?.focus({ preventScroll: true });
    }
  }

  /** Leaves for the provider; the page only comes back here if starting failed. */
  async function startOauth(id: 'google' | 'discord'): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    say.textContent = t('account.busy');
    panel.querySelectorAll<HTMLButtonElement>('button[data-cta], button[data-provider]').forEach((b) => (b.disabled = true));
    const result = await flow.oauth(id);
    if (result.ok) return;
    busy = false;
    if (closed) return;
    error = outcomeOf('sign-in', result, mode).error;
    render();
  }

  const submit = (): void => {
    if (mode === 'sign-in') void run('sign-in', () => flow.signIn(values.email, values.password));
    else if (mode === 'sign-up') void run('sign-up', () => flow.signUp(values.email, values.password));
    else if (mode === 'verify') void run('verify', () => flow.verify(values.code));
    else if (mode === 'forgot') void run('forgot', () => flow.forgot(values.email));
    else void run('reset', () => flow.reset(values.code, values.password));
  };

  const goMode = (next: DrawerMode): void => {
    if (busy) return;
    if (next === 'verify' || next === 'reset') origin = mode;
    mode = next;
    error = null;
    notice = null;
    render();
    panel.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
  };

  // ---- signed out
  function guestBlock(): HTMLElement {
    const list = (head: string, keys: readonly string[], kind: string) =>
      h('div', { className: `ad-facts ${kind}` }, [h('h4', { className: 'ad-facts-head', textContent: head }), h('ul', {}, keys.map((k) => h('li', { textContent: t(k) })))]);
    return h('section', { className: 'ad-guest' }, [
      h('div', { className: 'ad-guest-title' }, [icon('guest'), h('h3', { textContent: t('account.drawer.guest.title') })]),
      h('p', { className: 'ad-guest-sub', textContent: t('account.drawer.guest.sub') }),
      h('div', { className: 'ad-facts-pair' }, [list(t('account.drawer.guest.pros'), GUEST_PROS, 'is-pro'), list(t('account.drawer.guest.cons'), GUEST_CONS, 'is-con')]),
      button(t('account.drawer.guest.cta'), 'rk-wide', close),
      h('div', { className: 'ad-tools' }, [link(t('sync.backups'), () => ((view = 'backups'), render())), link(t('sync.wipe'), () => void wipe())]),
    ]);
  }

  function providers(): HTMLElement {
    const provider = (id: 'google' | 'discord') => {
      const b = button(t(`account.drawer.${id}`), 'rk-wide ad-provider', () => void startOauth(id), id);
      b.dataset.provider = id;
      // Where the drawer is short the two sit side by side and only the brand name shows (the full label stays the accessible name).
      b.setAttribute('aria-label', t(`account.drawer.${id}`));
      b.querySelector('span')?.classList.add('ad-pv-long');
      b.append(h('span', { className: 'ad-pv-short', textContent: id === 'google' ? 'Google' : 'Discord' }));
      return b;
    };
    return h('div', { className: 'ad-providers' }, [provider('google'), provider('discord'), h('div', { className: 'ad-or' }, [icon('mail'), h('span', { textContent: t('account.drawer.or') })])]);
  }

  function form(): HTMLElement {
    const spec = modeView(mode);
    const inputs = spec.fields.map((kind) => field(kind, kind === 'email' ? t('account.email') : kind === 'code' ? t('account.drawer.code') : mode === 'reset' ? t('account.drawer.newPassword') : t('account.password'), submit));
    const cta = button(busy ? t('account.busy') : t(spec.cta), 'rk-wide rk-ember', submit);
    cta.dataset.cta = '1';
    cta.disabled = busy;
    const links: HTMLElement[] = [];
    if (mode === 'sign-in') {
      links.push(link(t('account.drawer.toSignUp'), () => goMode('sign-up')), link(t('account.forgot'), () => goMode('forgot')));
    } else if (mode === 'sign-up') {
      links.push(link(t('account.drawer.toSignIn'), () => goMode('sign-in')));
    } else {
      links.push(link(t('menu.back'), () => goMode(backTarget(mode, origin))));
    }
    const el = h('form', { className: 'ad-form' }, [...inputs, cta, say, h('div', { className: 'ad-links' }, links)]);
    el.noValidate = true;
    el.addEventListener('submit', (e) => {
      e.preventDefault();
      submit();
    });
    return el;
  }

  function signedOut(): HTMLElement[] {
    const spec = modeView(mode);
    const entry = mode === 'sign-in' || mode === 'sign-up';
    return [
      h('div', { className: 'ad-main' }, [
        h('p', { className: `ad-why${entry ? ' is-entry' : ''}`, textContent: t(spec.why) }),
        ...(entry && flow.usesClerk ? [providers()] : []),
        form(),
      ]),
      guestBlock(),
    ];
  }

  // ---- signed in
  async function ask(title: string, body: string, yes: string): Promise<boolean> {
    return confirmDialog({ title, body, confirmLabel: yes });
  }

  async function wipe(): Promise<void> {
    if (await ask(t('sync.wipe'), t('sync.wipe.confirm'), t('sync.wipe.yes'))) {
      account.wipeDevice();
      notice = 'sync.loggedOut';
      render();
    }
  }

  async function removeAccount(): Promise<void> {
    if (!(await ask(t('account.delete'), t('account.deleteConfirm'), t('account.deleteYes')))) return;
    if (busy) return;
    busy = true;
    say.textContent = t('account.busy');
    const result = await flow.deleteAccount();
    busy = false;
    if (closed) return;
    error = result.ok ? null : `account.error.${result.error}`;
    render();
  }

  function answer(a: ChoiceAnswer): void {
    void account.answer(a).then(() => !closed && render());
  }

  function signedIn(email: string): HTMLElement[] {
    const choice = account.pendingChoice();
    const info = account.syncInfo();
    if (choice) {
      const step = (s: ChoiceStep): void => {
        if (s === 'overwrite') void ask(t('sync.held.overwrite'), t('sync.held.overwriteConfirm'), t('sync.held.overwriteYes')).then((yes) => yes && answer('overwrite'));
        else void ask(t('sync.foreign.discard'), t('sync.foreign.discardConfirm'), t('sync.foreign.discardYes')).then((yes) => yes && answer('discard'));
      };
      const { body, items } = choiceView(choice, answer, step);
      return [
        h('div', { className: 'ad-main' }, [
          h('p', { className: 'ad-who-mail', textContent: email }),
          h('div', { className: 'ad-choice' }, body),
          ...items.map((item) => {
            const b = button(typeof item.label === 'string' ? item.label : '', `rk-wide${item.className === 'danger' ? ' rk-danger' : ''}`, () => item.onConfirm?.());
            return b;
          }),
        ]),
      ];
    }
    const line = statusText(info, Date.now());
    const items: HTMLElement[] = [];
    if (info.status === 'choice') items.push(button(t('sync.check'), 'rk-wide', () => void account.check().then(() => !closed && render())));
    items.push(button(t('sync.backups'), 'rk-wide', () => ((view = 'backups'), render()), 'cloud'));
    // Without Clerk the account has a password the reset mail can change; with Clerk the provider owns it.
    if (!flow.usesClerk && email) items.push(button(t('account.changePassword'), 'rk-wide', () => void run('forgot', () => flow.forgot(email))));
    items.push(
      button(t('account.logOut'), 'rk-wide', () => {
        void flow.logOut().then(() => {
          if (closed) return;
          notice = 'sync.loggedOut';
          lastKind = account.state().kind;
          render();
        });
      }),
    );
    return [
      h('div', { className: 'ad-main' }, [
        h('div', { className: 'ad-who' }, [h('span', { className: 'ad-avatar' }, [h('span', { textContent: (email[0] ?? '?').toUpperCase() })]), h('div', { className: 'ad-who-text' }, [h('p', { className: 'ad-who-label', textContent: t('account.signedInAs') }), h('p', { className: 'ad-who-mail', textContent: email || t('account.title') })])]),
        h('p', { className: 'ad-sync', textContent: line || t('account.synced') }),
        ...items,
        say,
      ]),
      h('div', { className: 'ad-side' }, [
        h('div', { className: 'ad-danger' }, [button(t('account.delete'), 'rk-wide rk-danger', () => void removeAccount()), button(t('sync.wipe'), 'rk-wide rk-danger', () => void wipe())]),
        h('p', { className: 'ad-note', textContent: t('account.privacy') }),
      ]),
    ];
  }

  // ---- backups
  function backups(): HTMLElement[] {
    const list = account.backups();
    const picker = h('input', { type: 'file', className: 'ad-file' });
    picker.accept = 'application/json,.json';
    picker.hidden = true;
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const profile = parseImport(text);
        if (!profile) {
          error = 'sync.backup.importBad';
          render();
          return;
        }
        account.importProfile(profile);
        render();
      });
    });
    const rows = list.map((b) => {
      const row = button('', 'rk-wide ad-backup', () => {
        account.restore(b.id);
        render();
      });
      row.replaceChildren(h('span', { className: 'ad-backup-when', textContent: `${dateText(b.at)} · ${reasonText(b)}` }), h('span', { className: 'ad-backup-sum', textContent: cardText(profileSummary(backupProfile(b)))[0]! }));
      return row;
    });
    return [
      h('div', { className: 'ad-main' }, [
        h('p', { className: 'ad-why', textContent: list.length ? t('sync.backup.intro') : t('sync.backup.none') }),
        h('div', { className: 'ad-backups' }, rows),
        picker,
        button(t('sync.backup.export'), 'rk-wide', () => saveFile(account.exportText())),
        button(t('sync.backup.import'), 'rk-wide', () => picker.click()),
        button(t('menu.back'), 'rk-wide', () => ((view = 'main'), (error = null), render())),
        h('p', { className: 'ad-note', textContent: t('sync.backup.note') }),
      ]),
    ];
  }

  // ---- render
  function render(): void {
    const state = account.state();
    const out = state.kind === 'guest';
    const titleKey = view === 'backups' ? 'sync.backups' : out ? modeView(mode).title : 'account.title';
    panel.setAttribute('aria-labelledby', 'ad-title');
    const close_ = h('button', { type: 'button', className: 'ad-close', textContent: '×' });
    close_.setAttribute('aria-label', t('account.drawer.close'));
    close_.addEventListener('click', close);
    const columns = view === 'backups' ? backups() : out ? signedOut() : signedIn(state.email);
    // The forms carry their own status line; elsewhere the messages sit under the header.
    say.textContent = busy ? t('account.busy') : error || notice ? t(error ?? notice!) : '';
    say.className = `ad-say${error ? ' is-error' : ''}`;
    panel.replaceChildren(h('header', { className: 'ad-head' }, [h('h2', { id: 'ad-title', className: 'ad-title', textContent: t(titleKey) }), close_]), h('div', { className: `ad-cols${columns.length > 1 ? '' : ' is-single'}` }, columns));
    if (!panel.contains(say)) panel.querySelector('.ad-main')?.prepend(say);
    // A rebuilt panel loses the focus: give it back to the first control.
    if (!panel.contains(document.activeElement)) panel.querySelector<HTMLElement>('.ad-provider, input, .ad-main button')?.focus({ preventScroll: true });
  }

  // ---- keys
  const focusables = (): HTMLElement[] => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not([hidden])')];

  function onKey(e: KeyboardEvent): void {
    if (closed) return;
    // The confirmation on top has the keys while it is open.
    if (document.querySelector('.rc-veil')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    // Nothing underneath hears a key while the drawer is open.
    e.stopPropagation();
    const target = document.activeElement as HTMLElement | null;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    // A pad sends synthetic keys, which never click on their own.
    if ((e.key === 'Enter' || e.key === ' ') && target instanceof HTMLButtonElement) {
      e.preventDefault();
      target.click();
      return;
    }
    const key = e.key === 'Tab' ? (e.shiftKey ? 'ShiftTab' : 'Tab') : e.key;
    if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Tab' && key !== 'ShiftTab') return;
    e.preventDefault();
    const list = focusables();
    const next = focusMove(list.length, target ? list.indexOf(target) : -1, key);
    list[next]?.focus({ preventScroll: true });
  }
  window.addEventListener('keydown', onKey, true);

  // ---- open
  render();
  parent.append(veil);
  // Providers first: the quickest way in; a signed-in player lands on the first action.
  queueMicrotask(() => panel.querySelector<HTMLElement>('.ad-provider, input, .ad-main button')?.focus({ preventScroll: true }));

  return {
    element: veil,
    close,
    redraw() {
      if (closed || busy) return;
      const kind = account.state().kind;
      // A guest typing keeps the form; only signing in or out, or a sync choice, rebuilds it.
      if (kind === lastKind && kind === 'guest') return;
      lastKind = kind;
      render();
    },
  };
}
