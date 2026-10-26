import type { ApiResult, RemoteSave } from '../adapters/account-api';
import type { KeyValueStore } from '../adapters/storage';
import { EMPTY_SAVE, migrate, sanitize, type SaveData } from './save';

/**
 * Cloud save sync (docs/gdd.md, Cuentas): the decisions and the push loop,
 * free of the network and the DOM so they are tested with fakes.
 *
 * - First login on a device: `firstLoginDecision` (upload, take the cloud,
 *   nothing to do, or ask the player).
 * - A session already linked on this device, at start: `resumeDecision`.
 * - Afterwards every local save write is pushed (debounced) with the known
 *   revision; a 409 adopts the server's save, a network failure keeps the
 *   latest save and retries later. Play never waits for any of it.
 */
export const DEBOUNCE_MS = 2000;
export const FIRST_RETRY_MS = 5000;
export const MAX_RETRY_MS = 60_000;

/** Which cloud record this device writes to, and the revision its last push or pull saw. */
export interface SyncLink {
  saveId: string | null;
  rev: number;
}

/** Reads cloud data like a local save: migrated, then sanitized (anything hostile reads as empty). */
export const readRemote = (raw: unknown): SaveData => sanitize(migrate(raw));

const key = (save: SaveData): string => JSON.stringify(sanitize(save));
const EMPTY_KEY = key(EMPTY_SAVE);

export const isEmptySave = (save: SaveData): boolean => key(save) === EMPTY_KEY;
export const sameSave = (a: SaveData, b: SaveData): boolean => key(a) === key(b);

/** What the choice screen shows of each save. */
export const saveSummary = (save: SaveData): { coins: number; owned: number } => ({ coins: save.coins, owned: save.owned?.length ?? 0 });

export type FirstLogin = 'upload' | 'download' | 'same' | 'ask';

/**
 * First login on this device: no cloud save (or an empty one) takes the
 * local save; an empty device takes the cloud save; two different saves
 * with progress are the player's call.
 */
export function firstLoginDecision(local: SaveData, remote: RemoteSave | null): FirstLogin {
  if (!remote) return 'upload';
  const cloud = readRemote(remote.data);
  if (sameSave(local, cloud)) return 'same';
  if (isEmptySave(cloud)) return 'upload';
  if (isEmptySave(local)) return 'download';
  return 'ask';
}

export type Resume = 'adopt' | 'push' | 'none' | 'upload';

/**
 * A linked session at start: a newer cloud revision (another device played)
 * wins, as on a 409; otherwise progress made here while offline is pushed.
 */
export function resumeDecision(local: SaveData, remote: RemoteSave | null, link: SyncLink): Resume {
  if (!remote) return 'upload';
  if (remote.id !== link.saveId || remote.rev > link.rev) return 'adopt';
  return sameSave(local, readRemote(remote.data)) ? 'none' : 'push';
}

/** A store that calls `onWrite` after each successful write of `watched` (the save facade's key). */
export function observeKey(inner: KeyValueStore, watched: string, onWrite: () => void): KeyValueStore {
  return {
    get: (k) => inner.get(k),
    set(k, value) {
      inner.set(k, value);
      if (k === watched) onWrite();
    },
  };
}

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export const realTimers: Timers = {
  set: (fn, ms) => globalThis.setTimeout(fn, ms),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface PushApi {
  create(data: SaveData): Promise<ApiResult<RemoteSave>>;
  update(saveId: string, data: SaveData, rev: number): Promise<ApiResult<RemoteSave>>;
}

export interface PusherDeps {
  api: PushApi;
  timers: Timers;
  link(): SyncLink;
  setLink(link: SyncLink): void;
  /** The current local save. */
  readLocal(): SaveData;
  /** The cloud save won (409): write it locally without pushing it back. */
  adopt(save: SaveData): void;
  /** The session expired or was revoked. */
  onAuthLost(): void;
}

export interface Pusher {
  /** A local save was written: push it after the debounce. */
  changed(): void;
  /** Push now (tab hidden, back online); a push in flight is followed by another if needed. */
  flush(): void;
  /** Records the save known to be in the cloud (nothing to push while local equals it). */
  synced(save: SaveData): void;
  stop(): void;
}

export function createPusher(deps: PusherDeps): Pusher {
  let timer: unknown = null;
  let dirty = false;
  let inFlight = false;
  let stopped = false;
  let retryMs = FIRST_RETRY_MS;
  let syncedKey: string | null = null;

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
    dirty = false;
    const data = sanitize(deps.readLocal());
    const text = JSON.stringify(data);
    if (text === syncedKey) return;
    const link = deps.link();
    inFlight = true;
    let result: ApiResult<RemoteSave>;
    try {
      result = link.saveId ? await deps.api.update(link.saveId, data, link.rev) : await deps.api.create(data);
    } catch {
      result = { ok: false, error: { kind: 'offline' } };
    }
    inFlight = false;
    if (stopped) return;
    if (result.ok) {
      deps.setLink({ saveId: result.value.id, rev: result.value.rev });
      syncedKey = text;
      retryMs = FIRST_RETRY_MS;
      if (dirty) schedule(DEBOUNCE_MS);
      return;
    }
    const error = result.error;
    switch (error.kind) {
      case 'conflict': {
        // The server wins; changes made during this push are superseded too.
        const current = readRemote(error.current.data);
        deps.setLink({ saveId: error.current.id, rev: error.current.rev });
        syncedKey = key(current);
        dirty = false;
        retryMs = FIRST_RETRY_MS;
        deps.adopt(current);
        return;
      }
      case 'unauthorized':
        dirty = true;
        deps.onAuthLost();
        return;
      case 'rejected':
        // The server will not take this save (e.g. out of its bounds): retrying the same bytes cannot help.
        return;
      default:
        dirty = true;
        schedule(retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  }

  return {
    changed() {
      if (stopped) return;
      dirty = true;
      schedule(DEBOUNCE_MS);
    },
    flush() {
      if (stopped) return;
      cancel();
      void push();
    },
    synced(save) {
      syncedKey = key(save);
    },
    stop() {
      stopped = true;
      cancel();
    },
  };
}
