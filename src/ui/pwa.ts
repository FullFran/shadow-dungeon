import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { bannerVisible, installOffer, isIosSafari, type InstallOffer } from '../pwa/install';
import { installNotice, updateNotice } from '../pwa/notices';
import { notices } from './notice';
import { registerServiceWorker } from '../pwa/register';
import { cursorList } from './cursor-list';
import { h, mdWindow } from './window';

/**
 * PWA glue for the pages: keeps the browser's install prompt, offers it from
 * the title menu ("Instalar juego") and a one-time dismissible system notice, shows
 * the iOS Share -> Add to Home Screen instructions where there is no prompt,
 * and the "Nueva versión disponible" notice when a new service worker waits.
 * Notices share one queue and view (src/ui/notice.ts): one at a time, only on the hub.
 */
const UPDATE_SNOOZE_MS = 10 * 60 * 1000;

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface Pwa {
  offer(): InstallOffer;
  /** The title menu entry: the browser prompt, or the iOS instructions. */
  install(parent: HTMLElement): void;
  /** Queues the install notice when it is due (once per page, unless "never") and lets waiting notices show; call it whenever the hub is drawn. */
  banner(parent: HTMLElement): void;
  /** The "Instalar" button in the top right corner of `parent`, while the game can be installed (owner, 2026-11-02). */
  corner(parent: HTMLElement): void;
}

function standalone(): boolean {
  const media = (query: string) => typeof matchMedia === 'function' && matchMedia(query).matches;
  return media('(display-mode: standalone)') || media('(display-mode: fullscreen)') || (navigator as { standalone?: boolean }).standalone === true;
}

export function setupPwa(options: { store: KeyValueStore; onOfferChange(): void }): Pwa {
  let deferred: InstallPromptEvent | null = null;
  let installed = false;
  let bannerShown = false;
  const iosSafari = isIosSafari(navigator.userAgent, navigator.maxTouchPoints ?? 0);
  const offer = (): InstallOffer => (installed ? 'none' : installOffer({ standalone: standalone(), hasPrompt: deferred !== null, iosSafari }));

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    options.onOfferChange();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferred = null;
    document.querySelector('.pwa-corner')?.remove();
    options.onOfferChange();
  });

  /** An update waits for the player: it is a system notice (never a silent reload), put off for a while by "Más tarde". */
  let applyUpdate: (() => void) | null = null;
  let snoozedUntil = 0;
  const offerUpdate = (): void => {
    if (!applyUpdate || Date.now() < snoozedUntil) return;
    notices.enqueue(updateNotice(applyUpdate, () => (snoozedUntil = Date.now() + UPDATE_SNOOZE_MS)));
  };
  registerServiceWorker((apply) => {
    applyUpdate = apply;
    offerUpdate();
  });

  /** How to install where the browser offers no prompt: iOS Safari's share sheet, or a desktop browser's own menu. */
  function iosInstructions(parent: HTMLElement, key = 'pwa.ios'): void {
    const overlay = h('div', { className: 'overlay pwa-ios' });
    const close = () => {
      list.dispose();
      overlay.remove();
    };
    const list = cursorList({ items: [{ label: t('pwa.ok'), onConfirm: close }], onBack: close });
    overlay.append(mdWindow({ title: t('pwa.install'), className: 'narrow' }, [h('p', { textContent: t(key) }), list.element]));
    parent.append(overlay);
  }

  function install(parent: HTMLElement): void {
    if (deferred) {
      const event = deferred;
      deferred = null;
      void event
        .prompt()
        .then(() => event.userChoice)
        .catch(() => undefined)
        .finally(() => options.onOfferChange());
    } else if (offer() === 'ios') iosInstructions(parent);
    else if (offer() === 'manual') iosInstructions(parent, 'pwa.desktop');
  }

  function banner(parent: HTMLElement): void {
    offerUpdate();
    const current = offer();
    if (bannerVisible(options.store, current, bannerShown)) {
      bannerShown = true;
      const notice = installNotice(current, options.store, () => install(parent));
      if (notice) notices.enqueue(notice);
    }
    // The hub is drawn: whatever waited for it (an update that arrived mid-run, the news) may show now.
    notices.pump();
  }

  function corner(parent: HTMLElement): void {
    parent.querySelector('.pwa-corner')?.remove();
    if (offer() === 'none') return;
    const ns = 'http://www.w3.org/2000/svg';
    const icon = document.createElementNS(ns, 'svg');
    icon.setAttribute('viewBox', '0 0 16 16');
    icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    // An arrow down into a tray: install.
    path.setAttribute('d', 'M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 11v2.5h11V11');
    icon.append(path);
    const button = h('button', { className: 'pwa-corner', type: 'button', title: t('pwa.install') }, [icon, h('span', { textContent: t('pwa.install') })]);
    button.addEventListener('click', () => install(parent));
    parent.append(button);
  }

  return { offer, install, banner, corner };
}
