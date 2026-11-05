import { t } from '../i18n';
import { confirmDialog } from '../ui/confirm-dialog';
import { ACCOUNT_ICONS, type AccountIconId } from '../ui/icons/account-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h } from '../ui/window';
import type { Account, ChoiceAnswer } from './account';
import { choiceView, cardText, dateText, reasonText, saveFile, statusText, type ChoiceStep } from './account-screen';
import { backTarget, focusMove, GUEST_CONS, GUEST_PROS, modeView, outcomeOf, type DrawerMode, type FieldKind, type FlowAction } from './account-drawer-model';
import type { LinkStatus, OAuthProvider } from '../adapters/clerk-auth';
import { OAUTH_PROVIDERS } from '../adapters/clerk-auth';
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
  /** Called after `onClose` when the player picked "seguir como invitado" (the welcome gate carries on as a guest). */
  onGuest?(): void;
  parent?: HTMLElement;
  /** The player's face avatar (the partner's portrait) for the signed-in header; the mail's initial when absent. */
  face?: () => HTMLElement | null;
}

export interface AccountDrawer {
  /** Redraws for a change of the account (signed in or out, a sync choice), unless the player is typing as a guest. */
  redraw(): void;
  close(): void;
  element: HTMLElement;
}

const icon = (id: AccountIconId): SVGSVGElement => pixelSvgOf(ACCOUNT_ICONS[id], 'px-icon');

/** What the player sees apart from the forms. */
type View = 'main' | 'backups' | 'link';

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
  /** Google and Discord on a signed-in account: null until Clerk answers (or without Clerk). */
  let links: LinkStatus | null = null;
  /** The provider waiting for the password (an account signed in before Clerk), and whether Clerk asked for a code. */
  let linkProvider: OAuthProvider | null = null;
  let linkCode = false;
  const loadLinks = (): void => {
    if (!flow.usesClerk || account.state().kind === 'guest') return;
    void flow.linkStatus().then((status) => {
      links = status;
      if (!closed && !busy && view === 'main') render();
    });
  };

  const panel = h('aside', { className: 'md-window still acct-drawer' });
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  const veil = h('div', { className: 'drawer-veil' }, [panel]);

  const say = h('p', { className: 'acct-say' });
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
  function field(kind: FieldKind, label: string): HTMLInputElement {
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
      loadLinks();
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
    if (view === 'link') return void submitLink();
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
      h('div', { className: `acct-facts ${kind}` }, [h('h4', { className: 'acct-facts-head', textContent: head }), h('ul', {}, keys.map((k) => h('li', { textContent: t(k) })))]);
    return h('section', { className: 'acct-guest' }, [
      h('div', { className: 'acct-guest-title' }, [icon('guest'), h('h3', { textContent: t('account.drawer.guest.title') })]),
      h('p', { className: 'acct-guest-sub', textContent: t('account.drawer.guest.sub') }),
      h('div', { className: 'acct-facts-pair' }, [list(t('account.drawer.guest.pros'), GUEST_PROS, 'is-pro'), list(t('account.drawer.guest.cons'), GUEST_CONS, 'is-con')]),
      button(t('account.drawer.guest.cta'), 'rk-wide', () => {
        close();
        options.onGuest?.();
      }),
      h('div', { className: 'acct-tools' }, [link(t('sync.backups'), () => ((view = 'backups'), render())), link(t('sync.wipe'), () => void wipe())]),
    ]);
  }

  function providers(): HTMLElement {
    const provider = (id: 'google' | 'discord') => {
      const b = button(t(`account.drawer.${id}`), 'rk-wide acct-provider', () => void startOauth(id), id);
      b.dataset.provider = id;
      // Where the drawer is short the two sit side by side and only the brand name shows (the full label stays the accessible name).
      b.setAttribute('aria-label', t(`account.drawer.${id}`));
      b.querySelector('span')?.classList.add('acct-pv-long');
      b.append(h('span', { className: 'acct-pv-short', textContent: id === 'google' ? 'Google' : 'Discord' }));
      return b;
    };
    return h('div', { className: 'acct-providers' }, [provider('google'), provider('discord'), h('div', { className: 'acct-or' }, [icon('mail'), h('span', { textContent: t('account.drawer.or') })])]);
  }

  function form(): HTMLElement {
    const spec = modeView(mode);
    const inputs = spec.fields.map((kind) => field(kind, kind === 'email' ? t('account.email') : kind === 'code' ? t('account.drawer.code') : mode === 'reset' ? t('account.drawer.newPassword') : t('account.password')));
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
    const el = h('form', { className: 'acct-form' }, [...inputs, cta, say, h('div', { className: 'acct-links' }, links)]);
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
      h('div', { className: 'acct-main' }, [
        h('p', { className: `acct-why${entry ? ' is-entry' : ''}`, textContent: t(spec.why) }),
        ...(entry && flow.usesClerk ? [providers()] : []),
        form(),
      ]),
      guestBlock(),
    ];
  }

  // ---- linking Google or Discord
  /** One link attempt; on success the page leaves for the provider. */
  async function doLink(task: () => Promise<FlowResult>): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    notice = null;
    say.textContent = t('account.busy');
    panel.querySelectorAll<HTMLButtonElement>('button[data-cta], button[data-provider]').forEach((b) => (b.disabled = true));
    const result = await task();
    busy = false;
    if (closed) return;
    if (result.ok && result.step === 'code') {
      linkCode = true;
      values.code = '';
      render();
      panel.querySelector<HTMLInputElement>('input[data-field="code"]')?.focus({ preventScroll: true });
      return;
    }
    if (result.ok) {
      // Already linked (nothing to leave for): show it.
      view = 'main';
      linkProvider = null;
      loadLinks();
      render();
      return;
    }
    if (result.error === 'session-needed') {
      view = 'link';
      linkCode = false;
      values.password = '';
      render();
      panel.querySelector<HTMLInputElement>('input[data-field="password"]')?.focus({ preventScroll: true });
      return;
    }
    error = `account.error.${result.error}`;
    render();
  }

  const startLink = (provider: OAuthProvider): void => {
    linkProvider = provider;
    void doLink(() => flow.link(provider));
  };

  function submitLink(): void {
    const provider = linkProvider;
    const state = account.state();
    if (!provider || state.kind === 'guest') return;
    if (linkCode) {
      void doLink(async () => {
        const verified = await flow.verify(values.code);
        return verified.ok ? flow.link(provider) : verified;
      });
    } else {
      void doLink(() => flow.link(provider, { email: state.email, password: values.password }));
    }
  }

  function linkBlock(): HTMLElement[] {
    if (!links) return [];
    const rows = OAUTH_PROVIDERS.map((provider) => {
      const done = links!.linked.includes(provider);
      const b = button(t(done ? `account.link.done.${provider}` : `account.link.${provider}`), `rk-wide acct-link-btn${done ? ' is-linked' : ''}`, () => startLink(provider), provider);
      b.dataset.provider = provider;
      b.disabled = done || busy;
      return b;
    });
    return [h('div', { className: 'acct-links-block' }, [h('p', { className: 'acct-link-head', textContent: t('account.link.title') }), ...rows])];
  }

  function linkConfirm(): HTMLElement[] {
    const provider = linkProvider ?? 'google';
    const input = linkCode ? field('code', t('account.drawer.code')) : field('password', t('account.password'));
    const cta = button(busy ? t('account.busy') : t('account.link.cta'), 'rk-wide rk-ember', submitLink);
    cta.dataset.cta = '1';
    cta.disabled = busy;
    const back = link(t('menu.back'), () => ((view = 'main'), (linkProvider = null), (linkCode = false), (error = null), render()));
    const el = h('form', { className: 'acct-form' }, [input, cta, say, h('div', { className: 'acct-links' }, [back])]);
    el.noValidate = true;
    el.addEventListener('submit', (e) => {
      e.preventDefault();
      submitLink();
    });
    return [h('div', { className: 'acct-main' }, [h('p', { className: 'acct-why', textContent: t(linkCode ? 'account.link.code' : `account.link.confirm.${provider}`) }), el])];
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
        h('div', { className: 'acct-main' }, [
          h('p', { className: 'acct-who-mail', textContent: email }),
          h('div', { className: 'acct-choice' }, body),
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
      h('div', { className: 'acct-main' }, [
        h('div', { className: 'acct-who' }, [options.face?.() ?? h('span', { className: 'acct-avatar' }, [h('span', { textContent: (email[0] ?? '?').toUpperCase() })]), h('div', { className: 'acct-who-text' }, [h('p', { className: 'acct-who-label', textContent: t('account.signedInAs') }), h('p', { className: 'acct-who-mail', textContent: email || t('account.title') })])]),
        h('p', { className: 'acct-sync', textContent: line || t('account.synced') }),
        ...linkBlock(),
        ...items,
        say,
      ]),
      h('div', { className: 'acct-side' }, [
        h('div', { className: 'acct-danger' }, [button(t('account.delete'), 'rk-wide rk-danger', () => void removeAccount()), button(t('sync.wipe'), 'rk-wide rk-danger', () => void wipe())]),
        h('p', { className: 'acct-note', textContent: t('account.privacy') }),
      ]),
    ];
  }

  // ---- backups
  function backups(): HTMLElement[] {
    const list = account.backups();
    const picker = h('input', { type: 'file', className: 'acct-file' });
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
      const row = button('', 'rk-wide acct-backup', () => {
        account.restore(b.id);
        render();
      });
      row.replaceChildren(h('span', { className: 'acct-backup-when', textContent: `${dateText(b.at)} · ${reasonText(b)}` }), h('span', { className: 'acct-backup-sum', textContent: cardText(profileSummary(backupProfile(b)))[0]! }));
      return row;
    });
    return [
      h('div', { className: 'acct-main' }, [
        h('p', { className: 'acct-why', textContent: list.length ? t('sync.backup.intro') : t('sync.backup.none') }),
        h('div', { className: 'acct-backups' }, rows),
        picker,
        button(t('sync.backup.export'), 'rk-wide', () => saveFile(account.exportText())),
        button(t('sync.backup.import'), 'rk-wide', () => picker.click()),
        button(t('menu.back'), 'rk-wide', () => ((view = 'main'), (error = null), render())),
        h('p', { className: 'acct-note', textContent: t('sync.backup.note') }),
      ]),
    ];
  }

  // ---- render
  function render(): void {
    const state = account.state();
    const out = state.kind === 'guest';
    const titleKey = view === 'backups' ? 'sync.backups' : view === 'link' ? 'account.link.title' : out ? modeView(mode).title : 'account.title';
    panel.setAttribute('aria-labelledby', 'acct-title');
    const close_ = h('button', { type: 'button', className: 'acct-close', textContent: '×' });
    close_.setAttribute('aria-label', t('account.drawer.close'));
    close_.addEventListener('click', close);
    const columns = view === 'backups' ? backups() : view === 'link' && !out ? linkConfirm() : out ? signedOut() : signedIn(state.email);
    // The forms carry their own status line; elsewhere the messages sit under the header.
    say.textContent = busy ? t('account.busy') : error || notice ? t(error ?? notice!) : '';
    say.className = `acct-say${error ? ' is-error' : ''}`;
    panel.replaceChildren(h('header', { className: 'acct-head' }, [h('h2', { id: 'acct-title', className: 'acct-title', textContent: t(titleKey) }), close_]), h('div', { className: `acct-cols${columns.length > 1 ? '' : ' is-single'}` }, columns));
    if (!panel.contains(say)) panel.querySelector('.acct-main')?.prepend(say);
    // A rebuilt panel loses the focus: give it back to the first control.
    if (!panel.contains(document.activeElement)) panel.querySelector<HTMLElement>('.acct-provider, input, .acct-main button')?.focus({ preventScroll: true });
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
    // Enter in a field goes to the next one, or sends the form from the last.
    if (e.key === 'Enter' && target instanceof HTMLInputElement && target.dataset.field) {
      e.preventDefault();
      const inputs = [...panel.querySelectorAll<HTMLInputElement>('form input')];
      const next = inputs[inputs.indexOf(target) + 1];
      if (next) next.focus();
      else submit();
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
  loadLinks();
  parent.append(veil);
  // Providers first: the quickest way in; a signed-in player lands on the first action.
  queueMicrotask(() => panel.querySelector<HTMLElement>('.acct-provider, input, .acct-main button')?.focus({ preventScroll: true }));

  return {
    element: veil,
    close,
    redraw() {
      if (closed || busy) return;
      const kind = account.state().kind;
      // A guest typing keeps the form; only signing in or out, or a sync choice, rebuilds it.
      if (kind === lastKind && kind === 'guest') return;
      lastKind = kind;
      links = null;
      render();
      loadLinks();
    },
  };
}
