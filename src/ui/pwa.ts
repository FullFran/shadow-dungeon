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

  function iosInstructions(parent: HTMLElement): void {
    const overlay = h('div', { className: 'overlay pwa-ios' });
    const close = () => {
      list.dispose();
      overlay.remove();
    };
    const list = cursorList({ items: [{ label: t('pwa.ok'), onConfirm: close }], onBack: close });
    overlay.append(mdWindow({ title: t('pwa.install'), className: 'narrow' }, [h('p', { textContent: t('pwa.ios') }), list.element]));
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

  return { offer, install, banner };
}
