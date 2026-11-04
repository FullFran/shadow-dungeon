import type { AppError } from '../adapters/net-error';

/**
 * Whether the game can reach the network (odd/tasks/loading-errors.md). It
 * follows the browser's online/offline events and also believes a request that
 * failed as `offline` (the browser often claims to be online behind a dead
 * link). Work that failed for lack of a connection registers a retry, which
 * runs once when the connection returns. The offline banner reads this.
 */
export interface Connectivity {
  online(): boolean;
  /** Called with the new state whenever it changes. */
  subscribe(fn: (online: boolean) => void): () => void;
  /** Runs `fn` once, the next time the connection is back. Returns a cancel. */
  retryWhenBack(fn: () => void): () => void;
  /** Feeds a classified failure from the error sink. */
  noteError(error: AppError): void;
  dispose(): void;
}

export interface ConnectivityEnv {
  isOnline(): boolean;
  listen(type: 'online' | 'offline', fn: () => void): () => void;
}

export function createConnectivity(env: ConnectivityEnv): Connectivity {
  let online = env.isOnline();
  const subscribers = new Set<(online: boolean) => void>();
  const retries = new Set<() => void>();

  function set(next: boolean): void {
    if (next === online) return;
    online = next;
    for (const fn of [...subscribers]) fn(online);
    if (online) {
      const run = [...retries];
      retries.clear();
      for (const fn of run) fn();
    }
  }

  const stops = [env.listen('online', () => set(true)), env.listen('offline', () => set(false))];

  return {
    online: () => online,
    subscribe(fn) {
      subscribers.add(fn);
      return () => void subscribers.delete(fn);
    },
    retryWhenBack(fn) {
      retries.add(fn);
      return () => void retries.delete(fn);
    },
    noteError(error) {
      if (error.kind === 'offline') set(false);
    },
    dispose() {
      for (const stop of stops) stop();
      subscribers.clear();
      retries.clear();
    },
  };
}

/** The browser-backed instance. */
export function browserConnectivity(): Connectivity {
  return createConnectivity({
    isOnline: () => navigator.onLine !== false,
    listen: (type, fn) => {
      window.addEventListener(type, fn);
      return () => window.removeEventListener(type, fn);
    },
  });
}

let shared: Connectivity | null = null;
/** The one monitor of the page (the offline banner and every screen that retries when the connection returns). */
export const sharedConnectivity = (): Connectivity => (shared ??= browserConnectivity());
