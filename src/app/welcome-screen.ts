import { t } from '../i18n';
import { ACCOUNT_ICONS } from '../ui/icons/account-icons';
import { ONBOARDING_ICONS } from '../ui/icons/onboarding-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { GUEST_CONS, GUEST_PROS } from './account-drawer-model';
import '../styles/relic-controls.css';
import '../styles/onboarding.css';

/**
 * The welcome gate (owner, 2026-11-04): the first thing a profile with no walker sees, over the eclipse backdrop and
 * never the hub. The logo, one sober line of lore and two equal relic cards: sign in or create an account (opens the
 * account drawer) or play as a guest, each with the facts the drawer already states (its strings, at most three per
 * side). A quiet link under them only when this device already holds a game. Hick: two primary choices. Keys: arrows
 * move, Enter acts, 1 and 2 pick, the pad sends the same keys.
 */
export interface WelcomeOptions {
  /** This device already holds a game: shows "Ya tengo partida en este dispositivo". */
  hasLocalSave: boolean;
  touch: boolean;
  onAccount(): void;
  onGuest(): void;
  onDevice(): void;
}

export function welcomeScreen(options: WelcomeOptions): { element: HTMLElement; focus(): void; dispose(): void } {
  const facts = (head: string, keys: readonly string[]): HTMLElement[] => [h('p', { className: 'ob-facts-head', textContent: head }), h('ul', { className: 'ob-facts' }, keys.map((key) => h('li', { textContent: t(key) })))];

  const card = (kind: 'account' | 'guest', title: string, cta: string, headFacts: HTMLElement[], run: () => void): HTMLButtonElement => {
    const el = h('button', { type: 'button', className: `ob-card ob-slab is-${kind}` }, [
      h('div', { className: 'ob-card-head' }, [pixelSvgOf(ACCOUNT_ICONS[kind === 'account' ? 'cloud' : 'guest'], 'px-icon'), h('h2', { textContent: title })]),
      ...headFacts,
      h('span', { className: 'ob-card-cta', textContent: cta }),
    ]);
    el.dataset.ob = kind;
    el.addEventListener('click', run);
    return el;
  };

  const account = card('account', t('onb.welcome.account.title'), t('onb.welcome.account.cta'), facts(t('account.drawer.guest.pros'), GUEST_PROS), options.onAccount);
  const guest = card('guest', t('account.drawer.guest.title'), t('onb.welcome.guest.cta'), facts(t('account.drawer.guest.cons'), GUEST_CONS), options.onGuest);
  const device = options.hasLocalSave
    ? (() => {
        const el = h('button', { type: 'button', className: 'ob-device' }, [pixelSvgOf(ONBOARDING_ICONS.device, 'px-icon'), h('span', { textContent: t('onb.welcome.device') })]);
        el.dataset.ob = 'device';
        el.addEventListener('click', options.onDevice);
        return el;
      })()
    : null;

  const choices = h('div', { className: 'ob-choices' }, [account, guest]);
  choices.setAttribute('role', 'group');
  choices.setAttribute('aria-label', t('onb.welcome.choices'));

  const element = h('div', { className: 'ob ob-welcome' }, [
    h('header', { className: 'ob-logo' }, [h('h1', { textContent: t('app.title') }), h('p', { className: 'title-alt', textContent: t('title.alt') })]),
    h('p', { className: 'ob-lore', textContent: t('onb.welcome.lore') }),
    choices,
    ...(device ? [device] : []),
    h('p', { className: 'ob-hint', textContent: t('onb.welcome.hint') }),
  ]);

  const order = (): HTMLElement[] => [account, guest, ...(device ? [device] : [])];

  function onKey(e: KeyboardEvent): void {
    // The page moved on (the drawer, the next screen): the listener leaves with it.
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    // The account drawer on top owns the keys while it is open.
    if (document.querySelector('.drawer-veil, .rc-veil')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const list = order();
    const at = list.indexOf(document.activeElement as HTMLElement);
    if (e.code === 'Digit1' || e.code === 'Numpad1') return void account.click();
    if (e.code === 'Digit2' || e.code === 'Numpad2') return void guest.click();
    if (e.key === 'Enter' || e.key === ' ') {
      // A pad sends synthetic keys, which never click on their own.
      if (at >= 0) {
        e.preventDefault();
        list[at]!.click();
      }
      return;
    }
    const delta = e.code === 'ArrowRight' || e.code === 'ArrowDown' || e.code === 'KeyD' || e.code === 'KeyS' ? 1 : e.code === 'ArrowLeft' || e.code === 'ArrowUp' || e.code === 'KeyA' || e.code === 'KeyW' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    list[at < 0 ? (delta === 1 ? 0 : list.length - 1) : (at + delta + list.length) % list.length]!.focus({ preventScroll: true });
  }
  window.addEventListener('keydown', onKey);

  const focus = (): void => account.focus({ preventScroll: true });
  queueMicrotask(focus);

  return { element, focus, dispose: () => window.removeEventListener('keydown', onKey) };
}
