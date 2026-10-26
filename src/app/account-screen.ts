import { apiBaseUrl, httpAccountApi } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { getLanguage, t } from '../i18n';
import { cursorList, type ListItem } from '../ui/cursor-list';
import { h, mdWindow } from '../ui/window';
import { createAccount, MIN_PASSWORD, UNDO_MS, type Account, type AccountError, type Choice, type ChoiceAnswer, type Notice, type SyncInfo } from './account';
import { backupProfile, parseImport, type Backup } from './backups';
import { observeKeys, realTimers } from './cloud-sync';
import { PROFILE_KEYS, profileSummary, type ProfileSummary } from './profile';
import { electLeader, type LockManagerLike } from './sync-leader';

/**
 * Account wiring and screen (docs/gdd.md, Cuentas). `setupAccount` builds
 * the account over the device store and returns the store the game must use:
 * the same store, observed, so every progress write (save, records, shrine,
 * leaderboard, bestiary) is pushed to the cloud while signed in. Only the
 * leader tab pushes; the others follow through storage events. A guest makes
 * no request.
 */
export function setupAccount(options: { store: KeyValueStore; notify(text: string): void; onChange(): void; onReplaced?(): void }): { account: Account; store: KeyValueStore } {
  const tabId = `t${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;
  const locks = (globalThis.navigator as Navigator & { locks?: LockManagerLike }).locks ?? null;
  let leader: { isLeader(): boolean } = { isLeader: () => false };
  const account = createAccount({
    api: httpAccountApi(apiBaseUrl(import.meta.env.VITE_API_URL)),
    store: options.store,
    timers: realTimers,
    now: () => Date.now(),
    isLeader: () => leader.isLeader(),
    onNotice: (notice: Notice, undo?: string) => {
      const text = t(`account.notice.${notice}`);
      if (undo) undoToast(text, () => account.restore(undo));
      else options.notify(text);
    },
    onChange: options.onChange,
    onReplaced: () => options.onReplaced?.(),
  });
  leader = electLeader({ locks, store: options.store, timers: realTimers, now: () => Date.now(), id: tabId, onLeader: () => account.lead(), onLost: () => {} });
  const store = observeKeys(options.store, PROFILE_KEYS, () => account.saveChanged());
  // Leaving the page or switching apps: push what is queued now. Back online: retry. Another tab wrote: follow it.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) account.flush();
  });
  window.addEventListener('online', () => account.online());
  window.addEventListener('storage', (event) => account.external(event.key));
  window.addEventListener('pagehide', () => leader.isLeader() && account.flush());
  void account.start();
  return { account, store };
}

/** A notice with "Deshacer" for UNDO_MS (the replaced profile is in the backups either way). */
function undoToast(text: string, undo: () => void): void {
  const root = document.getElementById('app');
  if (!root) return;
  root.querySelector('.sync-undo')?.remove();
  const button = h('button', { type: 'button', className: 'sync-undo-button', textContent: t('sync.undo') });
  const box = h('div', { className: 'sync-undo' }, [h('span', { textContent: text }), button]);
  box.setAttribute('role', 'status');
  const timer = window.setTimeout(() => box.remove(), UNDO_MS);
  button.addEventListener('click', () => {
    window.clearTimeout(timer);
    box.remove();
    undo();
  });
  root.append(box);
}

export type AccountView = 'main' | 'delete' | 'wipe' | 'overwrite' | 'discard' | 'backups';

export interface AccountScreenOptions {
  account: Account;
  /** Rebuilds the screen (after signing in or out, or a choice), on `view`. */
  refresh(view?: AccountView): void;
  onBack(): void;
}

/** "hace unos segundos", "hace 5 min", "hace 2 h", "hace 3 días". */
export function agoText(elapsedMs: number, tr: (key: string) => string = t): string {
  const minutes = Math.floor(Math.max(0, elapsedMs) / 60_000);
  if (minutes < 1) return tr('sync.ago.now');
  if (minutes < 60) return tr('sync.ago.minutes').replace('{n}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tr('sync.ago.hours').replace('{n}', String(hours));
  return tr('sync.ago.days').replace('{n}', String(Math.floor(hours / 24)));
}

/** The status line: "Sincronizado hace X", "Sin conexión: se subirá luego", "Conflicto resuelto"... (empty when there is nothing to say). */
export function statusText(info: SyncInfo, nowMs: number, tr: (key: string) => string = t): string {
  const ago = info.syncedAt === null ? '' : tr('sync.status.synced').replace('{ago}', agoText(nowMs - info.syncedAt, tr));
  switch (info.status) {
    case 'synced':
      return ago;
    case 'resolved':
      return [tr('sync.status.resolved'), ago].filter(Boolean).join(' ');
    case 'idle':
      return '';
    default:
      return tr(`sync.status.${info.status}`);
  }
}

const dateText = (ms: number | null): string => (ms === null ? t('sync.card.noDate') : new Date(ms).toLocaleString(getLanguage() === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }));

/** One side of a choice: date, Pokémonedas, Pokémon, logros and best record. */
export function cardText(summary: ProfileSummary, tr: (key: string) => string = t): string[] {
  return [
    tr('sync.card.coins').replace('{coins}', String(summary.coins)).replace('{owned}', String(summary.owned)),
    tr('sync.card.progress').replace('{achievements}', String(summary.achievements)).replace('{floor}', summary.bestFloor > 0 ? String(summary.bestFloor) : '-').replace('{sima}', summary.bestSima > 0 ? String(summary.bestSima) : '-'),
  ];
}

function card(title: string, summary: ProfileSummary): HTMLElement {
  return h('div', { className: 'sync-card' }, [h('p', { className: 'sync-card-title', textContent: title }), h('p', { className: 'dim', textContent: dateText(summary.savedAt) }), ...cardText(summary).map((line) => h('p', { textContent: line }))]);
}

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

/** The choice views: what the player sees before anything moves. */
function choiceView(choice: Choice, answer: (a: ChoiceAnswer) => void, go: (view: AccountView) => void): { body: Node[]; items: ListItem[] } {
  switch (choice.kind) {
    case 'offer':
      return {
        body: [h('p', { className: 'sync-headline', textContent: t('sync.offer.title') }), card(t('sync.side.cloud'), choice.cloud), h('p', { className: 'dim', textContent: t('sync.offer.fresh') })],
        items: [
          { label: t('sync.offer.download'), onConfirm: () => answer('download') },
          { label: t('sync.offer.startFresh'), onConfirm: () => answer('fresh') },
        ],
      };
    case 'diverged':
      return {
        body: [h('p', { textContent: t('sync.diverged.intro') }), h('div', { className: 'sync-cards' }, [card(t('sync.side.device'), choice.device), card(t('sync.side.cloud'), choice.cloud)]), h('p', { className: 'dim', textContent: t('sync.merge.note') })],
        items: [
          { label: t('sync.diverged.keepDevice'), onConfirm: () => answer('device') },
          { label: t('sync.diverged.keepCloud'), onConfirm: () => answer('cloud') },
        ],
      };
    case 'foreign':
      return {
        body: [h('p', { textContent: t('sync.foreign.intro') }), card(t('sync.side.device'), choice.device)],
        items: [
          { label: t('sync.foreign.keepBackup'), onConfirm: () => answer('keep-backup') },
          { label: t('sync.foreign.adopt'), onConfirm: () => answer('adopt') },
          { label: t('sync.foreign.discard'), className: 'danger', onConfirm: () => go('discard') },
        ],
      };
    case 'held':
      return {
        body: [h('p', { textContent: t('sync.held.intro') }), h('div', { className: 'sync-cards' }, [card(t('sync.side.device'), choice.device), card(t('sync.side.cloud'), choice.cloud)]), h('p', { className: 'dim', textContent: t('sync.merge.note') })],
        items: [
          { label: t('sync.held.download'), onConfirm: () => answer('download') },
          { label: t('sync.held.overwrite'), className: 'danger', onConfirm: () => go('overwrite') },
        ],
      };
  }
}

const reasonText = (b: Backup): string => t(`sync.backup.reason.${b.reason}`);

function saveFile(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: `mazmorra-sombria-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The account window: sign in or up as a guest, a pending sync choice, the signed-in account, backups, and confirmations. */
export function accountWindow(options: AccountScreenOptions, view: AccountView = 'main'): HTMLElement {
  const { account } = options;
  const status = h('p', { className: 'lobby-error account-status' });
  status.setAttribute('role', 'status');
  let busy = false;
  /** Runs one request at a time; an error stays on screen, success rebuilds it. */
  const run = async (task: () => Promise<{ ok: boolean; error?: AccountError }>, after: AccountView = 'main') => {
    if (busy) return;
    busy = true;
    status.textContent = t('account.busy');
    const result = await task();
    busy = false;
    if (result.ok) options.refresh(after);
    else status.textContent = t(`account.error.${result.error}`);
  };
  const go = (next: AccountView) => options.refresh(next);
  const answer = (a: ChoiceAnswer) => void account.answer(a).then(() => options.refresh('main'));
  const state = account.state();
  const choice = account.pendingChoice();
  const info = account.syncInfo();
  let body: Node[];
  let items: ListItem[];
  let note = state.kind === 'guest' ? `${t('account.privacy')} ${t('account.forgot')}` : t('account.privacy');

  if (view === 'delete' && state.kind === 'signed-in') {
    body = [h('p', { textContent: t('account.deleteConfirm') })];
    items = [
      { label: t('account.deleteYes'), className: 'danger', onConfirm: () => void run(() => account.deleteAccount()) },
      { label: t('account.deleteNo'), onConfirm: () => go('main') },
    ];
  } else if (view === 'wipe') {
    body = [h('p', { textContent: t('sync.wipe.confirm') })];
    items = [
      {
        label: t('sync.wipe.yes'),
        className: 'danger',
        onConfirm: () => {
          account.wipeDevice();
          go('main');
        },
      },
      { label: t('account.deleteNo'), onConfirm: () => go('main') },
    ];
  } else if (view === 'overwrite' && choice?.kind === 'held') {
    body = [h('p', { textContent: t('sync.held.overwriteConfirm') })];
    items = [
      { label: t('sync.held.overwriteYes'), className: 'danger', onConfirm: () => answer('overwrite') },
      { label: t('account.deleteNo'), onConfirm: () => go('main') },
    ];
  } else if (view === 'discard' && choice?.kind === 'foreign') {
    body = [h('p', { textContent: t('sync.foreign.discardConfirm') })];
    items = [
      { label: t('sync.foreign.discardYes'), className: 'danger', onConfirm: () => answer('discard') },
      { label: t('account.deleteNo'), onConfirm: () => go('main') },
    ];
  } else if (view === 'backups') {
    const backups = account.backups();
    const picker = h('input', { type: 'file', className: 'sync-file' });
    picker.accept = 'application/json,.json';
    picker.hidden = true;
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      void file.text().then((text) => {
        const profile = parseImport(text);
        if (!profile) {
          status.textContent = t('sync.backup.importBad');
          return;
        }
        account.importProfile(profile);
        go('backups');
      });
    });
    body = [h('p', { textContent: backups.length > 0 ? t('sync.backup.intro') : t('sync.backup.none') }), picker];
    items = [
      ...backups.map(
        (b): ListItem => ({
          label: `${dateText(b.at)} · ${reasonText(b)}`,
          value: h('span', { className: 'account-summary', textContent: cardText(profileSummary(backupProfile(b)))[0]! }),
          onConfirm: () => {
            account.restore(b.id);
            go('backups');
          },
        }),
      ),
      { label: t('sync.backup.export'), onConfirm: () => saveFile(account.exportText()) },
      { label: t('sync.backup.import'), onConfirm: () => picker.click() },
      { label: t('menu.back'), onConfirm: () => go('main') },
    ];
    note = t('sync.backup.note');
  } else if (state.kind === 'signed-in' && choice) {
    ({ body, items } = choiceView(choice, answer, go));
    if (choice.kind === 'held') items.push({ label: t('menu.back'), onConfirm: options.onBack });
  } else if (state.kind === 'signed-in') {
    const line = statusText(info, Date.now());
    body = [h('p', {}, [t('account.signedInAs'), ' ', h('span', { className: 'account-email', textContent: state.email })]), h('p', { className: 'dim sync-status', textContent: line || t('account.synced') })];
    items = [
      ...(info.status === 'choice' ? [{ label: t('sync.check'), onConfirm: () => void account.check().then(() => go('main')) }] : []),
      { label: t('sync.backups'), onConfirm: () => go('backups') },
      {
        label: t('account.logOut'),
        onConfirm: () => {
          account.logOut();
          go('main');
          window.setTimeout(() => {
            const shown = document.querySelector('.account-status');
            if (shown) shown.textContent = t('sync.loggedOut');
          }, 0);
        },
      },
      { label: t('account.delete'), onConfirm: () => go('delete') },
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
      { label: t('sync.backups'), onConfirm: () => go('backups') },
      { label: t('sync.wipe'), className: 'danger', onConfirm: () => go('wipe') },
      { label: t('menu.back'), onConfirm: options.onBack },
    ];
  }

  const back = view === 'main' ? options.onBack : () => go('main');
  const list = cursorList({ items, onBack: back, label: t('account.title') });
  return mdWindow({ title: t('account.title'), className: 'online account' }, [...body, list.element, status, h('p', { className: 'dim account-note', textContent: note })]);
}
