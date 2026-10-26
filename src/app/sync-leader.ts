import type { KeyValueStore } from '../adapters/storage';
import type { Timers } from './cloud-sync';

/**
 * One tab pushes (docs/gdd.md, Cuentas): with several tabs of the game open,
 * only the leader runs the cloud push loop and the start-up sync; the others
 * write locally (the leader sees their writes through storage events) and
 * reload their state when the leader changes it.
 *
 * The leader holds an exclusive Web Lock for its whole life; the next tab in
 * the queue gets it when that tab closes. Without the Web Locks API a lease in
 * localStorage, renewed by a heartbeat, does the same: a tab claims it when
 * it is missing or expired, and reads it back to confirm it won.
 */
export const LEADER_LOCK = 'mazmorra-sombria.sync-leader';
export const LEASE_KEY = 'mazmorra-sombria.syncLease';
export const LEASE_MS = 6000;
export const HEARTBEAT_MS = 2000;

/** The part of `navigator.locks` used here. */
export interface LockManagerLike {
  request(name: string, options: { mode: 'exclusive' }, callback: (lock: unknown) => Promise<void>): Promise<unknown>;
}

export interface LeaderDeps {
  /** `navigator.locks` when available. */
  locks: LockManagerLike | null;
  store: KeyValueStore;
  timers: Timers;
  now(): number;
  /** This tab's id. */
  id: string;
  onLeader(): void;
  /** The lease went to another tab (fallback only: a frozen tab that missed its heartbeats). */
  onLost(): void;
}

export interface Leader {
  isLeader(): boolean;
  stop(): void;
}

interface Lease {
  id: string;
  until: number;
}

function readLease(store: KeyValueStore): Lease | null {
  try {
    const raw: unknown = JSON.parse(store.get(LEASE_KEY) ?? 'null');
    if (typeof raw !== 'object' || raw === null) return null;
    const { id, until } = raw as Record<string, unknown>;
    return typeof id === 'string' && typeof until === 'number' ? { id, until } : null;
  } catch {
    return null;
  }
}

export function electLeader(deps: LeaderDeps): Leader {
  let leader = false;
  let stopped = false;

  if (deps.locks) {
    let release: (() => void) | null = null;
    void deps.locks
      .request(LEADER_LOCK, { mode: 'exclusive' }, () => {
        if (stopped) return Promise.resolve();
        leader = true;
        deps.onLeader();
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      })
      .catch(() => {
        // No lock (an old or restricted browser): this tab stays a follower.
      });
    return {
      isLeader: () => leader,
      stop() {
        stopped = true;
        leader = false;
        release?.();
      },
    };
  }

  let timer: unknown = null;
  const tick = () => {
    if (stopped) return;
    const now = deps.now();
    const lease = readLease(deps.store);
    const claim = !lease || lease.until < now || lease.id === deps.id;
    if (claim) {
      try {
        deps.store.set(LEASE_KEY, JSON.stringify({ id: deps.id, until: now + LEASE_MS }));
      } catch {
        // Read back below.
      }
    }
    const after = readLease(deps.store);
    // A claim that storage does not keep: tabs cannot share anything, so this one is on its own and leads itself.
    const won = after ? after.id === deps.id : claim;
    if (won && !leader) {
      leader = true;
      deps.onLeader();
    } else if (!won && leader) {
      leader = false;
      deps.onLost();
    }
    timer = deps.timers.set(tick, HEARTBEAT_MS);
  };
  tick();
  return {
    isLeader: () => leader,
    stop() {
      stopped = true;
      if (timer !== null) deps.timers.clear(timer);
      if (leader) {
        try {
          deps.store.set(LEASE_KEY, JSON.stringify({ id: deps.id, until: 0 }));
        } catch {
          // It expires by itself.
        }
      }
      leader = false;
    },
  };
}
