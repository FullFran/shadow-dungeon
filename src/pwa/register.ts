/**
 * Service worker registration (public/sw.js). Production builds only: the
 * Vite dev server never registers it, so development is never served from a
 * cache. The worker URL carries the build version (the hashed name of this
 * bundle), so every deploy installs a new worker with fresh caches. A new
 * worker waits; `onUpdate` gets a function that activates it and reloads,
 * which the page calls only when the player taps "Actualizar" (never a silent
 * reload mid-run).
 */

/** `sw.js?v=<file name of the bundle>`, relative to the page. */
export function serviceWorkerUrl(moduleUrl: string): string {
  const file = new URL(moduleUrl).pathname.split('/').pop() || 'dev';
  return `./sw.js?v=${encodeURIComponent(file)}`;
}

/** What the dev cleanup needs from `navigator.serviceWorker` and `caches`, faked in tests. */
interface WorkerRegistry {
  getRegistrations(): Promise<ReadonlyArray<{ unregister(): Promise<boolean> }>>;
}
interface CacheRegistry {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

/**
 * Development only: a worker left on this origin by an earlier production build (a `vite preview` on the same
 * port) would keep serving cached art and scripts to the dev server, and a dev page that lost its worker of
 * effects once would never get it back. Unregisters every worker and drops the game's caches; returns how many
 * workers went.
 */
export async function clearDevServiceWorkers(workers: WorkerRegistry, cacheStorage: CacheRegistry | null): Promise<number> {
  const registrations = await workers.getRegistrations();
  await Promise.all(registrations.map((r) => r.unregister()));
  if (cacheStorage) {
    const names = await cacheStorage.keys();
    await Promise.all(names.filter((name) => name.startsWith('mazmorra-')).map((name) => cacheStorage.delete(name)));
  }
  return registrations.length;
}

export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) {
    void clearDevServiceWorkers(navigator.serviceWorker, typeof caches === 'undefined' ? null : caches)
      .then((removed) => {
        // The page was served through the stale worker: load it again straight from the dev server.
        if (removed > 0 && navigator.serviceWorker.controller) window.location.reload();
      })
      .catch(() => undefined);
    return;
  }
  const container = navigator.serviceWorker;
  let reloading = false;
  const offer = (worker: ServiceWorker) =>
    onUpdate(() => {
      container.addEventListener('controllerchange', () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  container
    .register(serviceWorkerUrl(import.meta.url), { scope: './' })
    .then((registration) => {
      // A worker already waiting from an earlier visit.
      if (registration.waiting && container.controller) offer(registration.waiting);
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker?.addEventListener('statechange', () => {
          // Installed while another worker controls the page: an update, not the first install.
          if (worker.state === 'installed' && container.controller) offer(worker);
        });
      });
    })
    .catch(() => {
      // No offline support (private mode, blocked storage): the game still runs online.
    });
}
