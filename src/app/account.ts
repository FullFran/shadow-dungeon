import type { AccountApi, ApiError, RemoteSave } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { addBackup, clearBackups, exportText, findBackup, backupProfile, readBackups, type Backup, type BackupReason } from './backups';
import { encodeCloud } from './cloud-payload';
import {
  createPusher,
  decideSync,
  decisionInput,
  EMPTY_SYNC,
  readRemote,
  readSync,
  SYNC_KEY,
  writeSync,
  type Pusher,
  type SyncState,
  type SyncStatus,
  type Timers,
} from './cloud-sync';
import { economyHash, mergeProfiles } from './profile-merge';
import { EMPTY_PROFILE, PROFILE_KEYS, profileHash, profileSummary, readProfile, sameProfile, writeProfile, type Profile, type ProfileSummary } from './profile';

/**
 * The player's account on this device (docs/gdd.md, Cuentas): the session
 * (token in localStorage, refreshed at start), sign up, log in, log out,
 * delete account, and the cloud profile sync wired to it (cloud-sync.ts:
 * the decision table and the push loop; profile-merge.ts: what merges;
 * backups.ts: the safety ring). A guest makes no request at all. Storage
 * failures only cost persistence: the session then lasts for the page.
 */
export const ACCOUNT_KEY = 'mazmorra-sombria.account';
export const MIN_PASSWORD = 8;
/** How long "Deshacer" stays offered after a replacement. */
export const UNDO_MS = 30_000;

interface StoredAccount {
  token: string;
  userId: string;
  email: string;
}

export type AccountState = { kind: 'guest' } | { kind: 'signed-in'; email: string };
/** Player-facing events. */
export const NOTICES = ['cloud-loaded', 'expired', 'choose', 'resolved', 'restored', 'imported', 'external'] as const;
export type Notice = (typeof NOTICES)[number];
export const ACCOUNT_ERRORS = ['offline', 'unauthorized', 'rejected', 'rate-limited', 'server', 'too-short', 'invalid-email'] as const satisfies readonly (Exclude<ApiError['kind'], 'conflict'> | 'too-short' | 'invalid-email')[];
export type AccountError = (typeof ACCOUNT_ERRORS)[number];
export type AuthOutcome = { ok: true } | { ok: false; error: AccountError };

/**
 * A choice the player must make before anything moves:
 * - `offer`: "Encontramos tu progreso en la nube" (an empty browser): Descargar / Empezar de cero.
 * - `diverged`: two different profiles: "Este dispositivo" / "La nube" (economy), the rest merges.
 * - `foreign`: this browser holds another account's progress: keep as backup / discard / use as this account's.
 * - `held`: after "Empezar de cero": Descargar la nube / Sobrescribir la nube.
 */
export type Choice =
  | { kind: 'offer'; cloud: ProfileSummary }
  | { kind: 'diverged'; device: ProfileSummary; cloud: ProfileSummary }
  | { kind: 'foreign'; device: ProfileSummary }
  | { kind: 'held'; device: ProfileSummary; cloud: ProfileSummary };

export type ChoiceAnswer = 'download' | 'fresh' | 'device' | 'cloud' | 'overwrite' | 'keep-backup' | 'discard' | 'adopt';

export interface SyncInfo {
  status: SyncStatus;
  syncedAt: number | null;
}

export interface Account {
  state(): AccountState;
  /** Restores a stored session; the leader tab also refreshes it and syncs. Never throws. */
  start(): Promise<void>;
  /** This tab became the leader (it pushes and syncs). */
  lead(): void;
  /** Back online: finish an interrupted start, or push what is queued. */
  online(): void;
  register(email: string, password: string): Promise<AuthOutcome>;
  logIn(email: string, password: string): Promise<AuthOutcome>;
  /** The open choice, if any. */
  pendingChoice(): Choice | null;
  answer(answer: ChoiceAnswer): Promise<void>;
  /** Looks at the cloud again (another tab left a choice open, or the player asks). */
  check(): Promise<void>;
  /** Sign out: the local data stays (and stays tagged with this account). */
  logOut(): void;
  deleteAccount(): Promise<{ ok: true } | { ok: false; error: AccountError }>;
  /** Erases this device's progress, sync state and backups (signs out first). */
  wipeDevice(): void;
  syncInfo(): SyncInfo;
  backups(): Backup[];
  /** Puts a backup back as the local profile (the current one is backed up first); pushed when signed in. */
  restore(id: string): boolean;
  /** The local profile as a "Descargar copia" file. */
  exportText(): string;
  /** Takes an imported profile as the local one (the current one is backed up first). */
  importProfile(profile: Profile): void;
  /** The game wrote progress (main.ts observes the profile keys). */
  saveChanged(): void;
  /** Another tab changed `key` (storage event). */
  external(key: string | null): void;
  /** Push now (the tab is being hidden). */
  flush(): void;
}

export interface AccountDeps {
  api: AccountApi;
  /** The raw device store: session, sync state and backups live here, and replaced profiles are written here. */
  store: KeyValueStore;
  timers: Timers;
  now(): number;
  /** Whether this tab is the one that pushes (sync-leader.ts); a single tab always is. */
  isLeader(): boolean;
  /** A player-facing event; `undo` names the backup "Deshacer" restores. */
  onNotice(notice: Notice, undo?: string): void;
  onChange(): void;
  /** The local profile was replaced (pull, choice, restore): screens showing it should redraw. */
  onReplaced(): void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function readStored(store: KeyValueStore): (StoredAccount & { legacy: { saveId: string | null; rev: number } | null }) | null {
  try {
    const raw: unknown = JSON.parse(store.get(ACCOUNT_KEY) ?? 'null');
    if (!isRecord(raw) || typeof raw.token !== 'string' || typeof raw.userId !== 'string' || typeof raw.email !== 'string' || !raw.token) return null;
    // Sessions from before profile sync kept their cloud link here.
    const legacy = isRecord(raw.link) && (typeof raw.link.saveId === 'string' || raw.link.saveId === null) && Number.isSafeInteger(raw.link.rev) ? { saveId: raw.link.saveId, rev: raw.link.rev as number } : null;
    return { token: raw.token, userId: raw.userId, email: raw.email, legacy };
  } catch {
    return null;
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Pending =
  | { kind: 'offer'; remote: RemoteSave }
  | { kind: 'diverged'; remote: RemoteSave }
  | { kind: 'foreign'; remote: RemoteSave | null }
  | { kind: 'held'; remote: RemoteSave };

export function createAccount(deps: AccountDeps): Account {
  let session: StoredAccount | null = null;
  let pusher: Pusher | null = null;
  let pending: Pending | null = null;
  /** The session was refreshed and the profile reconciled (false while that waits for the network). */
  let resumed = false;
  let syncing = false;
  let lastStatus: SyncStatus | null = null;

  const persist = () => {
    try {
      deps.store.set(ACCOUNT_KEY, session ? JSON.stringify(session) : '');
    } catch {
      // The session lasts for this page only.
    }
  };
  const local = (): Profile => readProfile(deps.store);
  const sync = (): SyncState => readSync(deps.store);
  const setSync = (patch: Partial<SyncState>) => {
    const next = { ...sync(), ...patch };
    lastStatus = next.status;
    writeSync(deps.store, next);
  };
  const setStatus = (status: SyncStatus) => {
    if (!session || sync().owner !== session.userId || lastStatus === status) return;
    setSync({ status });
    deps.onChange();
  };
  const backup = (profile: Profile, reason: BackupReason) => addBackup(deps.store, profile, reason, deps.now());
  /** Writes a profile as the local one (raw store: not echoed as a game write). */
  const replaceLocal = (profile: Profile) => {
    writeProfile(deps.store, profile);
    deps.onReplaced();
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

  function ensurePusher(): void {
    if (pusher || !session || !deps.isLeader()) return;
    const userId = session.userId;
    pusher = createPusher({
      api: {
        create: (data) => deps.api.createSave(session!.token, session!.userId, data),
        update: (saveId, data, rev) => deps.api.updateSave(session!.token, saveId, data, rev),
      },
      timers: deps.timers,
      // Only this account's own sync state allows a push; an open choice blocks it too.
      state: () => {
        const s = sync();
        return s.owner === userId && !pending ? s : { ...s, owner: null };
      },
      readLocal: local,
      encode: (profile) => encodeCloud(profile, { savedAt: deps.now() }),
      pushed: (remote, sent) => {
        setSync({ saveId: remote.id, rev: remote.rev, ...bases(sent), syncedAt: deps.now(), status: sync().status === 'resolved' ? 'resolved' : 'synced' });
        deps.onChange();
      },
      conflict: (current) => reconcile(current, 'conflict'),
      onAuthLost: () => {
        signOut();
        deps.onNotice('expired');
      },
      status: (status) => setStatus(status),
    });
  }
  const pushNow = () => {
    ensurePusher();
    pusher?.flush();
  };

  /** Links the device to `remote` with `base` as the profile synced at its revision (null: none yet). */
  const link = (remote: RemoteSave | null, base: Profile | null, status: SyncStatus = 'synced') => {
    if (!session) return;
    setSync({ owner: session.userId, saveId: remote?.id ?? null, rev: remote?.rev ?? 0, ...bases(base), held: false, status, syncedAt: deps.now() });
  };

  /**
   * Takes `kept` as the profile of both sides: `remote` is the cloud record it
   * replaces or keeps. The replaced local profile is backed up (and offered for
   * "Deshacer" when `undo`); the cloud one too when it is overwritten.
   */
  function settle(remote: RemoteSave | null, kept: Profile, reason: BackupReason, status: SyncStatus, undoSide: 'local' | 'cloud' | null): string | null {
    const before = local();
    const cloud = remote ? readRemote(remote).profile : EMPTY_PROFILE;
    const localBackup = sameProfile(before, kept) ? null : backup(before, reason);
    const cloudBackup = remote && !sameProfile(cloud, kept) ? backup(cloud, 'cloud') : null;
    if (!sameProfile(before, kept)) replaceLocal(kept);
    // The base is the cloud as it is: when `kept` differs from it the push loop sends `kept` at its revision.
    link(remote, remote ? cloud : null, status);
    if (!remote || !sameProfile(cloud, kept)) pushNow();
    deps.onChange();
    return undoSide === 'local' ? localBackup : undoSide === 'cloud' ? cloudBackup : null;
  }

  /** The decision table on the cloud record, and what it decides. */
  function reconcile(remote: RemoteSave | null, from: 'login' | 'resume' | 'conflict' | 'check'): void {
    if (!session) return;
    const profile = local();
    const action = decideSync(decisionInput(sync(), session.userId, profile, remote));
    pending = null;
    switch (action) {
      case 'none':
        link(remote, profile);
        break;
      case 'push':
        // Base: the record as it is (its revision), so the push loop sends the local profile over it.
        link(remote, remote ? readRemote(remote).profile : null, 'pending');
        pushNow();
        break;
      case 'pull': {
        const undo = settle(remote, mergeProfiles(readRemote(remote!).profile, profile), 'pull', 'synced', 'local');
        deps.onNotice('cloud-loaded', undo ?? undefined);
        break;
      }
      case 'held':
        pending = { kind: 'held', remote: remote! };
        setStatus('held');
        break;
      case 'offer-download':
      case 'diverged':
      case 'foreign': {
        pending = action === 'foreign' ? { kind: 'foreign', remote } : { kind: action === 'offer-download' ? 'offer' : 'diverged', remote: remote! };
        setStatus('choice');
        if (from !== 'login' && from !== 'check') deps.onNotice('choose');
      }
    }
    deps.onChange();
  }

  async function signedIn(email: string, password: string): Promise<AuthOutcome> {
    const login = await deps.api.logIn(email, password);
    if (!login.ok) return { ok: false, error: errorOf(login.error) };
    const remote = await deps.api.getSave(login.value.token, login.value.userId);
    if (!remote.ok) return { ok: false, error: errorOf(remote.error) };
    signOut();
    session = { ...login.value };
    resumed = true;
    persist();
    reconcile(remote.value, 'login');
    return { ok: true };
  }

  async function resume(): Promise<void> {
    if (!session || syncing) return;
    syncing = true;
    try {
      const refreshed = await deps.api.refresh(session.token);
      if (!session) return;
      if (!refreshed.ok) {
        if (refreshed.error.kind === 'unauthorized') {
          signOut();
          deps.onNotice('expired');
        } else setStatus('offline');
        return;
      }
      session = { ...refreshed.value };
      persist();
      const remote = await deps.api.getSave(session.token, session.userId);
      if (!session) return;
      if (!remote.ok) {
        setStatus('offline');
        return;
      }
      resumed = true;
      ensurePusher();
      reconcile(remote.value, 'resume');
    } finally {
      syncing = false;
    }
  }

  async function answerChoice(answer: ChoiceAnswer): Promise<void> {
    const open = pending;
    if (!open || !session) return;
    const device = local();
    switch (open.kind) {
      case 'offer':
        if (answer === 'download') {
          pending = null;
          const undo = settle(open.remote, mergeProfiles(readRemote(open.remote).profile, device), 'download', 'synced', 'local');
          deps.onNotice('cloud-loaded', undo ?? undefined);
        } else if (answer === 'fresh') {
          // "Empezar de cero": this device keeps its fresh progress; nothing goes up or down until the player picks a side.
          pending = { kind: 'held', remote: open.remote };
          setSync({ owner: session.userId, saveId: open.remote.id, rev: open.remote.rev, hash: null, econ: null, held: true, status: 'held', syncedAt: null });
        }
        break;
      case 'held':
      case 'diverged': {
        const keepCloud = answer === 'cloud' || answer === 'download';
        const keepDevice = answer === 'device' || answer === 'overwrite';
        if (!keepCloud && !keepDevice) return;
        pending = null;
        const cloud = readRemote(open.remote).profile;
        const kept = keepCloud ? mergeProfiles(cloud, device) : mergeProfiles(device, cloud);
        const undo = settle(open.remote, kept, 'choice', 'resolved', keepCloud ? 'local' : 'cloud');
        deps.onNotice('resolved', undo ?? undefined);
        break;
      }
      case 'foreign': {
        if (answer !== 'keep-backup' && answer !== 'discard' && answer !== 'adopt') return;
        pending = null;
        if (answer === 'adopt') {
          // Used as this account's: it is guest progress now, and the table runs again.
          writeSync(deps.store, { ...EMPTY_SYNC, owner: session.userId, status: 'pending' });
        } else {
          // Both keep it in the backup ring (every replacement does); "keep" just names it as another account's.
          backup(device, answer === 'keep-backup' ? 'other-account' : 'discard');
          replaceLocal(EMPTY_PROFILE);
          writeSync(deps.store, { ...EMPTY_SYNC, owner: session.userId, status: 'idle' });
        }
        reconcile(open.remote, 'check');
        break;
      }
    }
    deps.onChange();
  }

  return {
    state: () => (session ? { kind: 'signed-in', email: session.email } : { kind: 'guest' }),
    async start() {
      const stored = readStored(deps.store);
      if (!stored) return;
      session = { token: stored.token, userId: stored.userId, email: stored.email };
      // A session from before profile sync: its link becomes the base, with the local profile as it is now.
      const state = sync();
      if (stored.legacy && state.owner === null) {
        writeSync(deps.store, { ...EMPTY_SYNC, owner: stored.userId, saveId: stored.legacy.saveId, rev: stored.legacy.rev, ...bases(local()), status: 'idle' });
        persist();
      }
      deps.onChange();
      if (!deps.isLeader()) return;
      try {
        await resume();
      } catch {
        // Any surprise leaves the session as stored; play goes on.
      }
    },
    lead() {
      if (!session) return;
      ensurePusher();
      if (!resumed) void resume().catch(() => {});
      else pusher?.flush();
    },
    online() {
      if (!session || !deps.isLeader()) return;
      if (!resumed) void resume().catch(() => {});
      else pushNow();
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
    pendingChoice() {
      if (!pending) return null;
      const device = profileSummary(local());
      if (pending.kind === 'foreign') return { kind: 'foreign', device };
      const { profile, meta } = readRemote(pending.remote);
      const cloud = profileSummary(profile, meta?.savedAt ?? null);
      if (pending.kind === 'offer') return { kind: 'offer', cloud };
      return { kind: pending.kind, device: { ...device, savedAt: sync().syncedAt }, cloud };
    },
    answer: answerChoice,
    async check() {
      if (!session) return;
      const remote = await deps.api.getSave(session.token, session.userId);
      if (!session) return;
      if (!remote.ok) {
        if (remote.error.kind === 'unauthorized') {
          signOut();
          deps.onNotice('expired');
        } else setStatus('offline');
        return;
      }
      reconcile(remote.value, 'check');
    },
    logOut() {
      // Send what is queued first; the answer no longer matters.
      pusher?.flush();
      signOut();
    },
    async deleteAccount() {
      if (!session) return { ok: true };
      const result = await deps.api.deleteAccount(session.token, session.userId);
      if (!result.ok) return { ok: false, error: errorOf(result.error) };
      signOut();
      // The cloud record is gone: the device keeps its data as guest progress.
      writeSync(deps.store, EMPTY_SYNC);
      return { ok: true };
    },
    wipeDevice() {
      // Signed out first, so an empty profile can never be pushed over the cloud.
      if (session) signOut();
      writeProfile(deps.store, EMPTY_PROFILE);
      writeSync(deps.store, EMPTY_SYNC);
      clearBackups(deps.store);
      deps.onReplaced();
      deps.onChange();
    },
    syncInfo() {
      const s = sync();
      if (!session || s.owner !== session.userId) return { status: pending ? 'choice' : 'idle', syncedAt: null };
      return { status: pending && pending.kind !== 'held' ? 'choice' : s.status, syncedAt: s.syncedAt };
    },
    backups: () => readBackups(deps.store),
    restore(id) {
      const found = findBackup(deps.store, id);
      if (!found) return false;
      // The backup's economy comes back; achievements, records and the rest stay merged (never lost).
      const current = local();
      backup(current, 'restore');
      replaceLocal(mergeProfiles(backupProfile(found), current));
      if (session) pushNow();
      deps.onNotice('restored');
      deps.onChange();
      return true;
    },
    exportText: () => exportText(local(), deps.now()),
    importProfile(profile) {
      const current = local();
      backup(current, 'import');
      replaceLocal(mergeProfiles(profile, current));
      if (session) pushNow();
      deps.onNotice('imported');
      deps.onChange();
    },
    saveChanged() {
      if (!session || pending) return;
      ensurePusher();
      pusher?.changed();
    },
    external(key) {
      if (key === ACCOUNT_KEY || key === null) {
        // Signed in or out in another tab.
        const stored = readStored(deps.store);
        if (!stored && session) {
          pusher?.stop();
          pusher = null;
          pending = null;
          session = null;
          resumed = false;
        } else if (stored && (!session || stored.userId !== session.userId || stored.token !== session.token)) {
          pusher?.stop();
          pusher = null;
          session = { token: stored.token, userId: stored.userId, email: stored.email };
          resumed = true;
          pushNow();
        }
        deps.onChange();
        return;
      }
      if (key === SYNC_KEY) {
        lastStatus = null;
        // Another tab settled a choice or pushed: a choice open here may be stale.
        if (pending && pending.kind !== 'foreign' && session && sync().owner === session.userId && !sync().held && sync().status !== 'choice') pending = null;
        pusher?.flush();
        deps.onChange();
        return;
      }
      if ((PROFILE_KEYS as readonly string[]).includes(key)) {
        // Progress written by another tab: the leader pushes it.
        if (session && !pending) {
          ensurePusher();
          pusher?.changed();
        }
        deps.onReplaced();
      }
    },
    flush() {
      if (session && !pending) pusher?.flush();
    },
  };
}

/** The base hashes of a synced profile (null: none). */
const bases = (profile: Profile | null): Pick<SyncState, 'hash' | 'econ'> => (profile ? { hash: profileHash(profile), econ: economyHash(profile) } : { hash: null, econ: null });

const errorOf = (error: ApiError): AccountError => (error.kind === 'conflict' ? 'server' : error.kind);
