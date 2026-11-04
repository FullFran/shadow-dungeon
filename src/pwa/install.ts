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
/**
 * `manual`: a browser with no install prompt (yet), on a PC or elsewhere (owner, 2026-11-02:
 * "y que en navegador tambien si es en pc"): the corner button still shows and explains how.
 */
export type InstallOffer = 'prompt' | 'ios' | 'manual' | 'none';

export function installOffer(state: { standalone: boolean; hasPrompt: boolean; iosSafari: boolean }): InstallOffer {
  if (state.standalone) return 'none';
  if (state.hasPrompt) return 'prompt';
  return state.iosSafari ? 'ios' : 'manual';
}

/** iOS / iPadOS Safari (iPadOS reports a Mac but has touch points); other iOS browsers are excluded. */
export function isIosSafari(userAgent: string, maxTouchPoints: number): boolean {
  const ios = /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
  return ios && /Safari\//.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(userAgent);
}

const BANNER_KEY = 'mazmorra-sombria.installBanner';

export function bannerVisible(store: KeyValueStore, offer: InstallOffer, shownThisPage: boolean): boolean {
  return (offer === 'prompt' || offer === 'ios') && !shownThisPage && store.get(BANNER_KEY) !== 'never';
}

export function neverShowBanner(store: KeyValueStore): void {
  store.set(BANNER_KEY, 'never');
}

/** What a button of the install card does (the card is presentation only; these are the old banner's three transitions). */
export type InstallAction = 'install' | 'later' | 'never';

export interface InstallChoice {
  action: InstallAction;
  /** i18n key of the label. */
  label: string;
}

/**
 * The install card's content (pure): one primary, at most one quiet choice and the small "never" link.
 * Where the browser has a prompt the primary installs; on iOS, which only has Share steps, it acknowledges.
 */
export interface InstallCard {
  titleKey: string;
  bodyKeys: string[];
  primary: InstallChoice;
  secondary?: InstallChoice;
  never: InstallChoice;
}

export function installCard(offer: InstallOffer): InstallCard | null {
  const never: InstallChoice = { action: 'never', label: 'pwa.never' };
  if (offer === 'prompt') {
    return {
      titleKey: 'pwa.card.title',
      bodyKeys: ['pwa.card.fullscreen', 'pwa.card.app'],
      primary: { action: 'install', label: 'pwa.installNow' },
      secondary: { action: 'later', label: 'pwa.later' },
      never,
    };
  }
  if (offer === 'ios') return { titleKey: 'pwa.card.title', bodyKeys: ['pwa.ios'], primary: { action: 'later', label: 'pwa.ok' }, never };
  return null;
}

/**
 * Applies an action to the stored state: "never" is the only one that writes (it silences the card for good);
 * "later" only closes it for this page (the page already counts it as shown). Every action closes the card.
 */
export function runInstallAction(action: InstallAction, store: KeyValueStore): { close: true; install: boolean } {
  if (action === 'never') neverShowBanner(store);
  return { close: true, install: action === 'install' };
}
