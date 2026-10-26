import type { ApiResult, RemoteSave } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { decodeCloud, type CloudData, type CloudMeta } from './cloud-payload';
import { isEmptyProfile, profileHash, type Profile } from './profile';

/**
 * Cloud profile sync (docs/gdd.md, Cuentas): the per-device sync state, the
 * decision table and the push loop, free of the network and the DOM so they
 * are tested with fakes.
 *
 * The device remembers, per account, the cloud record and revision it last
 * synced (`baseRev`) and a hash of the profile at that moment. Comparing the
 * server's revision with baseRev, and the local profile with that hash, tells
 * who moved since: only the device (push), only the cloud (silent pull),
 * both (the player picks), or nobody knows yet (first login on a browser).
 */
export const SYNC_KEY = 'mazmorra-sombria.sync';
export const DEBOUNCE_MS = 2000;
export const FIRST_RETRY_MS = 5000;
export const MAX_RETRY_MS = 60_000;

export const SYNC_STATUSES = ['idle', 'synced', 'pending', 'offline', 'resolved', 'choice', 'held'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

/** What this device remembers about syncing (kept across sign-outs: local data stays tagged with its account). */
export interface SyncState {
  /** The account the local profile belongs to (null: guest progress never linked to any account). */
  owner: string | null;
  /** The cloud record this device writes to. */
  saveId: string | null;
  /** The server revision of the last push or pull (baseRev). */
  rev: number;
  /** Hash of the local profile at that push or pull (null: never synced). */
  hash: string | null;
  /** When it last synced (ms). */
  syncedAt: number | null;
  /** "Empezar de cero": nothing is pushed or pulled until the player picks a side in the account screen. */
  held: boolean;
  status: SyncStatus;
}

export const EMPTY_SYNC: SyncState = { owner: null, saveId: null, rev: 0, hash: null, syncedAt: null, held: false, status: 'idle' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const OWNER = /^[a-z0-9]{1,32}$/;

export function parseSync(raw: string | null): SyncState {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    return EMPTY_SYNC;
  }
  if (!isRecord(data)) return EMPTY_SYNC;
  const owner = typeof data.owner === 'string' && OWNER.test(data.owner) ? data.owner : null;
  const saveId = typeof data.saveId === 'string' && OWNER.test(data.saveId) ? data.saveId : null;
  const rev = Number.isSafeInteger(data.rev) && (data.rev as number) >= 0 ? (data.rev as number) : 0;
  const hash = typeof data.hash === 'string' && data.hash.length <= 40 ? data.hash : null;
  const syncedAt = Number.isSafeInteger(data.syncedAt) && (data.syncedAt as number) >= 0 ? (data.syncedAt as number) : null;
  const status = SYNC_STATUSES.includes(data.status as SyncStatus) ? (data.status as SyncStatus) : 'idle';
  // A base needs its owner: a record without one is no base at all.
  if (!owner) return { ...EMPTY_SYNC, status: 'idle' };
  return { owner, saveId, rev, hash, syncedAt, held: data.held === true, status };
}

export function readSync(store: KeyValueStore): SyncState {
  try {
    return parseSync(store.get(SYNC_KEY));
  } catch {
    return EMPTY_SYNC;
  }
}

export function writeSync(store: KeyValueStore, state: SyncState): void {
  try {
    store.set(SYNC_KEY, JSON.stringify(state));
  } catch {
    // Lasts for this page only.
  }
}

/** Whose the local profile is, seen from the account signing in. */
export type Owner = 'none' | 'same' | 'other';
export const ownerOf = (state: SyncState, accountId: string): Owner => (state.owner === null ? 'none' : state.owner === accountId ? 'same' : 'other');

export interface DecisionInput {
  owner: Owner;
  /** "Empezar de cero" chosen by this account on this device. */
  held: boolean;
  /** The last sync of this device for this account (null: never). */
  base: { saveId: string | null; rev: number; hash: string | null } | null;
  local: { hash: string; empty: boolean };
  /** The cloud record (null: the account has none). */
  remote: { id: string; rev: number; hash: string; empty: boolean } | null;
}

/**
 * - `none`: nothing to move (already equal, or nothing anywhere).
 * - `push`: only this device moved (or the cloud holds nothing).
 * - `pull`: only the cloud moved: take it silently and say so.
 * - `offer-download`: a browser with no progress meets cloud progress it never synced: "Encontramos tu progreso en la nube".
 * - `diverged`: both moved, or first meeting of two different profiles: the player picks a side (economy), the rest merges.
 * - `foreign`: this browser holds another account's progress: keep it as a backup, discard it, or use it as this account's.
 * - `held`: the player chose "Empezar de cero": nothing moves until they pick a side.
 */
export type SyncAction = 'none' | 'push' | 'pull' | 'offer-download' | 'diverged' | 'foreign' | 'held';

/** The decision table (exhaustively tested in tests/app/cloud-sync.test.ts). */
export function decideSync(input: DecisionInput): SyncAction {
  const { owner, local, remote, base } = input;
  if (owner === 'other' && !local.empty) return 'foreign';
  // An empty cloud: this device's progress goes up (an empty device has nothing to send).
  if (!remote || remote.empty) return local.empty ? 'none' : 'push';
  if (remote.hash === local.hash) return 'none';
  if (input.held) return 'held';
  // Is the device's base this very record, at or behind its revision?
  const known = owner === 'same' && base !== null && base.saveId === remote.id && remote.rev >= base.rev;
  // An empty device never overwrites cloud progress: never synced here, offer it; synced before, its storage was wiped: take it back.
  if (local.empty) return known ? 'pull' : 'offer-download';
  if (!known) return 'diverged';
  const localChanged = base.hash !== local.hash;
  if (remote.rev === base.rev) return 'push';
  return localChanged ? 'diverged' : 'pull';
}

/** The decision input for the local profile and a cloud record. */
export function decisionInput(state: SyncState, accountId: string, local: Profile, remote: RemoteSave | null): DecisionInput {
  const owner = ownerOf(state, accountId);
  const cloud = remote ? decodeCloud(remote.data).profile : null;
  return {
    owner,
    held: owner === 'same' && state.held,
    base: owner === 'same' && state.hash !== null ? { saveId: state.saveId, rev: state.rev, hash: state.hash } : null,
    local: { hash: profileHash(local), empty: isEmptyProfile(local) },
    remote: remote && cloud ? { id: remote.id, rev: remote.rev, hash: profileHash(cloud), empty: isEmptyProfile(cloud) } : null,
  };
}

/** A cloud record read as a profile, with its save time. */
export function readRemote(remote: RemoteSave): { profile: Profile; meta: CloudMeta | null } {
  return decodeCloud(remote.data);
}

/** Store writes of any of `watched` call `onWrite(key)` after they succeed (the game's store; profile keys). */
export function observeKeys(inner: KeyValueStore, watched: readonly string[], onWrite: (key: string) => void): KeyValueStore {
  return {
    get: (k) => inner.get(k),
    set(k, value) {
      inner.set(k, value);
      if (watched.includes(k)) onWrite(k);
    },
  };
}

/** One key: kept for the save facade's callers. */
export const observeKey = (inner: KeyValueStore, watched: string, onWrite: () => void): KeyValueStore => observeKeys(inner, [watched], onWrite);

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realTimers: Timers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PushApi {
  create(data: CloudData): Promise<ApiResult<RemoteSave>>;
  update(saveId: string, data: CloudData, rev: number): Promise<ApiResult<RemoteSave>>;
}

export interface PusherDeps {
  api: PushApi;
  timers: Timers;
  /** The device's sync state, read fresh (another tab may have changed it). */
  state(): SyncState;
  /** The current local profile. */
  readLocal(): Profile;
  /** The payload for a profile (adds the save time). */
  encode(profile: Profile): CloudData;
  /** A push landed: the new base. */
  pushed(remote: RemoteSave, hash: string): void;
  /** The server holds a newer revision (409): the caller decides (pull or ask). */
  conflict(current: RemoteSave): void;
  onAuthLost(): void;
  /** Waiting to retry (offline or server down) or queued. */
  status(status: 'pending' | 'offline'): void;
}

export interface Pusher {
  /** Local progress was written: push it after the debounce. */
  changed(): void;
  /** Push now (tab hidden, back online); a push in flight is followed by another if needed. */
  flush(): void;
  stop(): void;
}

/**
 * The push loop: debounced, with the known baseRev; a 409 goes back to the
 * decision table, a network failure keeps the latest and retries with
 * backoff. It never pushes while a choice is open or held, nor an empty
 * profile over a known cloud record (wiped storage is not lost progress).
 */
export function createPusher(deps: PusherDeps): Pusher {
  let timer: unknown = null;
  let dirty = false;
  let inFlight = false;
  let stopped = false;
  let retryMs = FIRST_RETRY_MS;

  const cancel = () => {
    if (timer !== null) deps.timers.clear(timer);
    timer = null;
  };
  const schedule = (ms: number) => {
    cancel();
    timer = deps.timers.set(() => {
      timer = null;
      void push();
    }, ms);
  };

  async function push(): Promise<void> {
    if (stopped || inFlight || !dirty) return;
    const state = deps.state();
    if (state.held || state.status === 'choice' || !state.owner) return;
    dirty = false;
    const local = deps.readLocal();
    const hash = profileHash(local);
    if (state.hash === hash && state.saveId) return;
    if (state.saveId && isEmptyProfile(local)) return;
    const data = deps.encode(local);
    inFlight = true;
    let result: ApiResult<RemoteSave>;
    try {
      result = state.saveId ? await deps.api.update(state.saveId, data, state.rev) : await deps.api.create(data);
    } catch {
      result = { ok: false, error: { kind: 'offline' } };
    }
    inFlight = false;
    if (stopped) return;
    if (result.ok) {
      retryMs = FIRST_RETRY_MS;
      deps.pushed(result.value, hash);
      if (dirty) schedule(DEBOUNCE_MS);
      return;
    }
    const error = result.error;
    switch (error.kind) {
      case 'conflict':
        dirty = false;
        retryMs = FIRST_RETRY_MS;
        deps.conflict(error.current);
        return;
      case 'unauthorized':
        dirty = true;
        deps.onAuthLost();
        return;
      case 'rejected':
        // The server will not take this payload: retrying the same bytes cannot help.
        return;
      default:
        dirty = true;
        deps.status('offline');
        schedule(retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  }

  return {
    changed() {
      if (stopped) return;
      dirty = true;
      deps.status('pending');
      schedule(DEBOUNCE_MS);
    },
    flush() {
      if (stopped) return;
      cancel();
      dirty = true;
      void push();
    },
    stop() {
      stopped = true;
      cancel();
    },
  };
}
