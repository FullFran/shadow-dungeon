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

export function registerServiceWorker(onUpdate: (apply: () => void) => void): void {
  if (import.meta.env.DEV || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
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
