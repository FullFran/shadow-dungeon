import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { bannerVisible, installOffer, isIosSafari, neverShowBanner, type InstallOffer } from '../pwa/install';
import { registerServiceWorker } from '../pwa/register';
import { cursorList } from './cursor-list';
import { h, mdWindow } from './window';

/**
 * PWA glue for the pages: keeps the browser's install prompt, offers it from
 * the title menu ("Instalar juego") and a one-time dismissible banner, shows
 * the iOS Share -> Add to Home Screen instructions where there is no prompt,
 * and the "Nueva versión disponible — Actualizar" toast when a new service
 * worker waits (index.html CSS hides the toast during a run).
 */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface Pwa {
  offer(): InstallOffer;
  /** The title menu entry: the browser prompt, or the iOS instructions. */
  install(parent: HTMLElement): void;
  /** Appends the invitation banner to `parent` when it is due (once per page, unless "never"). */
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
    document.querySelector('.pwa-banner')?.remove();
    document.querySelector('.pwa-corner')?.remove();
    options.onOfferChange();
  });

  registerServiceWorker((apply) => {
    if (document.querySelector('.pwa-toast')) return;
    const button = h('button', { type: 'button', className: 'pwa-toast-action', textContent: t('pwa.reload') });
    button.addEventListener('click', () => {
      button.disabled = true;
      apply();
    });
    const toast = h('div', { className: 'pwa-toast md-window still' }, [h('span', { textContent: t('pwa.update') }), button]);
    toast.setAttribute('role', 'status');
    document.body.append(toast);
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
    const current = offer();
    if (!bannerVisible(options.store, current, bannerShown)) return;
    bannerShown = true;
    const node = h('div', { className: 'pwa-banner' });
    const close = () => {
      list.dispose();
      node.remove();
    };
    const list = cursorList({
      layout: 'horizontal',
      keyboard: false,
      items: [
        current === 'prompt'
          ? {
              label: t('pwa.installNow'),
              onConfirm: () => {
                close();
                install(parent);
              },
            }
          : { label: t('pwa.ok'), onConfirm: close },
        ...(current === 'prompt' ? [{ label: t('pwa.later'), onConfirm: close }] : []),
        {
          label: t('pwa.never'),
          onConfirm: () => {
            neverShowBanner(options.store);
            close();
          },
        },
      ],
    });
    node.append(mdWindow({ className: 'still' }, [h('p', { textContent: t(current === 'prompt' ? 'pwa.banner' : 'pwa.ios') }), list.element]));
    parent.append(node);
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
