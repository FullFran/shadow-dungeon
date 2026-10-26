import type { AccountApi, ApiError, RemoteSave } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { createPusher, firstLoginDecision, readRemote, resumeDecision, sameSave, saveSummary, type Pusher, type SyncLink, type Timers } from './cloud-sync';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * The player's account on this device (docs/gdd.md, Cuentas): the session
 * (token in localStorage, refreshed at start), sign up, log in, log out,
 * delete account, and the cloud save sync wired to it (cloud-sync.ts).
 * A guest makes no request at all. Storage failures only cost persistence:
 * the session then lasts for the page.
 */
export const ACCOUNT_KEY = 'mazmorra-sombria.account';
export const MIN_PASSWORD = 8;

interface StoredAccount {
  token: string;
  userId: string;
  email: string;
  /** Null while this device has not settled its first-login choice. */
  link: SyncLink | null;
}

export type AccountState = { kind: 'guest' } | { kind: 'signed-in'; email: string };
/** Player-facing events: a cloud save was taken at login, a newer one replaced the local save, the session expired, a choice is waiting. */
export type Notice = 'cloud-loaded' | 'adopted' | 'expired' | 'choose';
export type AccountError = Exclude<ApiError['kind'], 'conflict'> | 'too-short' | 'invalid-email';
export type SaveSummary = ReturnType<typeof saveSummary>;
export type AuthOutcome = { ok: true } | { ok: true; choose: { device: SaveSummary; cloud: SaveSummary } } | { ok: false; error: AccountError };

export interface Account {
  state(): AccountState;
  /** Restores a stored session: refresh the token, then sync the save. Never throws. */
  start(): Promise<void>;
  /** Back online: finish an interrupted start, or push what is queued. */
  online(): void;
  register(email: string, password: string): Promise<AuthOutcome>;
  logIn(email: string, password: string): Promise<AuthOutcome>;
  /** The open first-login choice, if any (both saves summarized). */
  pendingChoice(): { device: SaveSummary; cloud: SaveSummary } | null;
  choose(keep: 'device' | 'cloud'): void;
  logOut(): void;
  deleteAccount(): Promise<{ ok: true } | { ok: false; error: AccountError }>;
  /** The game wrote its save (main.ts observes the save key). */
  saveChanged(): void;
  /** Push now (the tab is being hidden). */
  flush(): void;
}

export interface AccountDeps {
  api: AccountApi;
  /** The raw device store: the session lives here, and adopted cloud saves are written here (not through the observed store, so they are not pushed back). */
  store: KeyValueStore;
  timers: Timers;
  onNotice(notice: Notice): void;
  onChange(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readStored(store: KeyValueStore): StoredAccount | null {
  try {
    const raw: unknown = JSON.parse(store.get(ACCOUNT_KEY) ?? 'null');
    if (!isRecord(raw) || typeof raw.token !== 'string' || typeof raw.userId !== 'string' || typeof raw.email !== 'string' || !raw.token) return null;
    const link = isRecord(raw.link) && (typeof raw.link.saveId === 'string' || raw.link.saveId === null) && Number.isSafeInteger(raw.link.rev) ? { saveId: raw.link.saveId, rev: raw.link.rev as number } : null;
    return { token: raw.token, userId: raw.userId, email: raw.email, link };
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAccount(deps: AccountDeps): Account {
  let session: StoredAccount | null = null;
  let pusher: Pusher | null = null;
  let pending: RemoteSave | null = null;
  /** The stored session was refreshed and the save reconciled (false while that waits for the network). */
  let resumed = false;

  const persist = () => {
    try {
      if (session) deps.store.set(ACCOUNT_KEY, JSON.stringify(session));
      else deps.store.set(ACCOUNT_KEY, '');
    } catch {
      // The session lasts for this page only.
    }
  };
  const local = (): SaveData => loadSave(deps.store);
  const adopt = (save: SaveData, notice: Notice | null) => {
    const changed = !sameSave(local(), save);
    writeSave(deps.store, save);
    pusher?.synced(save);
    if (changed && notice) deps.onNotice(notice);
  };

  function signOut(): void {
    pusher?.stop();
    pusher = null;
    pending = null;
    session = null;
    resumed = false;
    persist();
    deps.onChange();
  }

  function startPusher(): Pusher {
    pusher?.stop();
    const own = createPusher({
      api: {
        create: (data) => deps.api.createSave(session!.token, session!.userId, data),
        update: (saveId, data, rev) => deps.api.updateSave(session!.token, saveId, data, rev),
      },
      timers: deps.timers,
      link: () => session?.link ?? { saveId: null, rev: 0 },
      setLink: (link) => {
        if (!session) return;
        session = { ...session, link };
        persist();
      },
      readLocal: local,
      adopt: (save) => adopt(save, 'adopted'),
      onAuthLost: () => {
        signOut();
        deps.onNotice('expired');
      },
    });
    pusher = own;
    return own;
  }

  const setLink = (remote: RemoteSave | null) => {
    if (!session) return;
    session = { ...session, link: remote ? { saveId: remote.id, rev: remote.rev } : { saveId: null, rev: 0 } };
    persist();
  };
  const pushNow = () => {
    pusher?.changed();
    pusher?.flush();
  };

  /** First login on this device: decide from both saves (cloud-sync.ts). */
  function settleFirstLogin(remote: RemoteSave | null): AuthOutcome {
    const decision = firstLoginDecision(local(), remote);
    const p = startPusher();
    if (decision === 'ask') {
      pending = remote;
      deps.onChange();
      return { ok: true, choose: { device: saveSummary(local()), cloud: saveSummary(readRemote(remote!.data)) } };
    }
    setLink(remote);
    if (remote) p.synced(readRemote(remote.data));
    if (decision === 'upload') pushNow();
    else if (decision === 'download') adopt(readRemote(remote!.data), 'cloud-loaded');
    deps.onChange();
    return { ok: true };
  }

  async function signedIn(email: string, password: string): Promise<AuthOutcome> {
    const login = await deps.api.logIn(email, password);
    if (!login.ok) return { ok: false, error: errorOf(login.error) };
    const remote = await deps.api.getSave(login.value.token, login.value.userId);
    if (!remote.ok) return { ok: false, error: errorOf(remote.error) };
    signOut();
    session = { ...login.value, link: null };
    resumed = true;
    persist();
    return settleFirstLogin(remote.value);
  }

  async function resume(): Promise<void> {
    if (!session) return;
    const refreshed = await deps.api.refresh(session.token);
    if (!session) return;
    if (!refreshed.ok) {
      if (refreshed.error.kind === 'unauthorized') {
        signOut();
        deps.onNotice('expired');
      }
      return;
    }
    session = { ...refreshed.value, link: session.link };
    persist();
    const remote = await deps.api.getSave(session.token, session.userId);
    if (!session || !remote.ok) return;
    resumed = true;
    if (!session.link) {
      const outcome = settleFirstLogin(remote.value);
      if ('choose' in outcome) deps.onNotice('choose');
      return;
    }
    const decision = resumeDecision(local(), remote.value, session.link);
    if (remote.value) pusher?.synced(readRemote(remote.value.data));
    if (decision === 'adopt') {
      setLink(remote.value);
      adopt(readRemote(remote.value!.data), 'adopted');
    } else if (decision === 'upload') {
      setLink(null);
      pushNow();
    } else if (decision === 'push') pushNow();
  }

  return {
    state: () => (session ? { kind: 'signed-in', email: session.email } : { kind: 'guest' }),
    async start() {
      session = readStored(deps.store);
      if (!session) return;
      // Pushes wait for the first-login choice; a linked device queues writes at once.
      if (session.link) startPusher();
      deps.onChange();
      try {
        await resume();
      } catch {
        // Any surprise leaves the session as stored; play goes on.
      }
    },
    online() {
      if (!session) return;
      if (!resumed) void resume().catch(() => {});
      else pusher?.flush();
    },
    async register(email, password) {
      const clean = email.trim();
      if (!EMAIL.test(clean)) return { ok: false, error: 'invalid-email' };
      if (password.length < MIN_PASSWORD) return { ok: false, error: 'too-short' };
      const created = await deps.api.signUp(clean, password);
      if (!created.ok) return { ok: false, error: errorOf(created.error) };
      return signedIn(clean, password);
    },
    logIn(email, password) {
      return signedIn(email.trim(), password);
    },
    pendingChoice: () => (pending ? { device: saveSummary(local()), cloud: saveSummary(readRemote(pending.data)) } : null),
    choose(keep) {
      const remote = pending;
      if (!remote || !session) return;
      pending = null;
      setLink(remote);
      if (keep === 'cloud') adopt(readRemote(remote.data), null);
      else pushNow();
      deps.onChange();
    },
    logOut() {
      // Send what is queued first; the answer no longer matters.
      if (session?.link) pusher?.flush();
      signOut();
    },
    async deleteAccount() {
      if (!session) return { ok: true };
      const result = await deps.api.deleteAccount(session.token, session.userId);
      if (!result.ok) return { ok: false, error: errorOf(result.error) };
      signOut();
      return { ok: true };
    },
    saveChanged() {
      if (session?.link && !pending) pusher?.changed();
    },
    flush() {
      if (session?.link && !pending) pusher?.flush();
    },
  };
}

const errorOf = (error: ApiError): AccountError => (error.kind === 'conflict' ? 'server' : error.kind);
