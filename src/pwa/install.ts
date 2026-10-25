import type { KeyValueStore } from '../adapters/storage';

/**
 * Install invitation rules (pure). Chrome, Edge and Android fire
 * `beforeinstallprompt`, which the page keeps to show its own "Instalar
 * juego" entry and banner; iOS Safari has no such API, so it gets the
 * Share -> Add to Home Screen instructions instead. Nothing is offered once
 * the game already runs installed (standalone / fullscreen display mode).
 * The banner shows at most once per page load and never again after
 * "No volver a mostrar"; the title menu entry stays while there is an offer.
 */
export type InstallOffer = 'prompt' | 'ios' | 'none';

export function installOffer(state: { standalone: boolean; hasPrompt: boolean; iosSafari: boolean }): InstallOffer {
  if (state.standalone) return 'none';
  if (state.hasPrompt) return 'prompt';
  return state.iosSafari ? 'ios' : 'none';
}

/** iOS / iPadOS Safari (iPadOS reports a Mac but has touch points); other iOS browsers are excluded. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
}

const BANNER_KEY = 'mazmorra-sombria.installBanner';

export function bannerVisible(store: KeyValueStore, offer: InstallOffer, shownThisPage: boolean): boolean {
  return offer !== 'none' && !shownThisPage && store.get(BANNER_KEY) !== 'never';
}

export function neverShowBanner(store: KeyValueStore): void {
  store.set(BANNER_KEY, 'never');
}
