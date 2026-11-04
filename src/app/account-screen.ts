import { apiBaseUrl, httpAccountApi } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { getLanguage, t } from '../i18n';
import type { ListItem } from '../ui/cursor-list';
import { h } from '../ui/window';
import { createAccount, UNDO_MS, type Account, type Choice, type ChoiceAnswer, type Notice, type SyncInfo } from './account';
import type { Backup } from './backups';
import { observeKeys, realTimers } from './cloud-sync';
import { PROFILE_KEYS, type ProfileSummary } from './profile';
import { electLeader, type LockManagerLike } from './sync-leader';

/**
 * Account wiring and screen (docs/gdd.md, Cuentas). `setupAccount` builds
 * the account over the device store and returns the store the game must use:
 * the same store, observed, so every progress write (save, records, shrine,
 * leaderboard, bestiary) is pushed to the cloud while signed in. Only the
 * leader tab pushes; the others follow through storage events. A guest makes
 * no request.
 */
export function setupAccount(options: {
  store: KeyValueStore;
  notify(text: string): void;
  onChange(): void;
  onReplaced?(): void;
  /** The account synced with the cloud (the public profile follows it, app/profile-publish.ts). */
  onSynced?(session: { token: string; userId: string }): void;
}): { account: Account; store: KeyValueStore } {
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
    onSynced: (session) => options.onSynced?.(session),
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
  // On the body, not in #app: screens replace #app's children and the notice must outlive a redraw.
  const root = document.body;
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

/** What a choice may ask the screen to confirm first. */
export type ChoiceStep = 'discard' | 'overwrite';

export const dateText = (ms: number | null): string => (ms === null ? t('sync.card.noDate') : new Date(ms).toLocaleString(getLanguage() === 'en' ? 'en-GB' : 'es-ES', { dateStyle: 'medium', timeStyle: 'short' }));

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

/** The choice views: what the player sees before anything moves. */
export function choiceView(choice: Choice, answer: (a: ChoiceAnswer) => void, go: (step: ChoiceStep) => void): { body: Node[]; items: ListItem[] } {
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

export const reasonText = (b: Backup): string => t(`sync.backup.reason.${b.reason}`);

export function saveFile(text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = h('a', { href: url, download: `mazmorra-sombria-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

