import { t } from '../i18n';
import { h } from '../ui/window';
import { pixelIconSvg } from '../ui/pixel-icons';
import { hubStep, type HubButton, type HubDirection, type HubId } from './title-hub';

/**
 * The title hub on screen (odd/tasks/title-hub.md T4; .agents/DESIGN.md §3):
 * profile plate, logo and system buttons on top; the partner's services on
 * the left rail, the world's on the right; the partner on its altar in the
 * middle; news, JUGAR and small links at the bottom. Every control is a
 * real <button>; arrows (and the pad, which sends arrow keys) move focus
 * spatially, Enter or a click opens.
 */
export interface TitleHubOptions {
  buttons: readonly HubButton[];
  /** Opens a button's screen or window (never called for a locked one). */
  onPick(id: HubId): void;
  /** The partner's animated sprite, its name and its type badges. */
  partner: { portrait: HTMLElement; name: string; badges: HTMLElement[]; passive?: { name: string; description: string } } | null;
  /** Nickname (or "Caminante"), its small portrait and the record line. */
  profile: { name: string; portrait: HTMLElement | null; line: string };
  coins: number;
  /** The line under JUGAR (where it leads). */
  playLine: string;
  /** Latest release for the news card. */
  news: { version: string; line: string } | null;
  buildLabel: string;
  touch: boolean;
  /** Focus this control first (back from a window: the one that opened it). */
  initial?: HubId;
}

export function titleHub(options: TitleHubOptions): { element: HTMLElement; focus(id?: HubId): void; dispose(): void } {
  const byId = new Map<HubId, HTMLButtonElement>();
  const status = h('p', { className: 'hub-status' });
  status.setAttribute('role', 'status');
  let statusTimer = 0;

  const say = (text: string) => {
    status.textContent = text;
    status.classList.add('is-on');
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => status.classList.remove('is-on'), 3200);
  };

  const pick = (b: HubButton) => {
    if (b.locked) {
      say(t(b.lockKey ?? 'hub.locked.town'));
      return;
    }
    options.onPick(b.id);
  };

  /** A relic button: icon slab and label; `compact` keeps only the icon (the label becomes its tooltip). */
  const relic = (b: HubButton, kind: 'rail' | 'system' | 'link'): HTMLButtonElement => {
    const label = t(b.labelKey);
    const el = h('button', { className: `hub-btn hub-btn-${kind}${b.locked ? ' is-locked' : ''}${b.badge ? ' has-badge' : ''}`, type: 'button' }, [
      h('span', { className: 'hub-slab' }, [pixelIconSvg(b.icon), ...(b.locked ? [pixelIconSvg('lock', 'px-icon hub-lock')] : []), ...(b.badge ? [h('span', { className: 'hub-badge' })] : [])]),
      h('span', { className: 'hub-label', textContent: label }),
    ]);
    el.dataset.hub = b.id;
    el.setAttribute('aria-label', b.locked ? `${label}. ${t(b.lockKey ?? 'hub.locked.town')}` : label);
    if (kind !== 'rail') el.title = label;
    el.addEventListener('click', () => pick(b));
    byId.set(b.id, el);
    return el;
  };

  const zone = (z: HubButton['zone']) => options.buttons.filter((b) => b.zone === z);
  const play = zone('play')[0];
  const online = zone('online')[0];

  const playButton = play
    ? (() => {
        const el = h('button', { className: 'hub-play', type: 'button' }, [
          pixelIconSvg('play', 'px-icon hub-play-icon'),
          h('span', { className: 'hub-play-text' }, [h('span', { className: 'hub-play-name', textContent: t(play.labelKey) }), h('small', { textContent: options.playLine })]),
        ]);
        el.dataset.hub = play.id;
        el.addEventListener('click', () => pick(play));
        byId.set(play.id, el);
        return el;
      })()
    : null;

  const onlineButton = online
    ? (() => {
        const el = h('button', { className: 'hub-online', type: 'button' }, [pixelIconSvg('online'), h('span', { className: 'hub-online-text' }, [h('span', { textContent: t(online.labelKey) }), h('small', { textContent: t('hub.online.sub') })])]);
        el.dataset.hub = online.id;
        el.addEventListener('click', () => pick(online));
        byId.set(online.id, el);
        return el;
      })()
    : null;

  const rail = (z: 'left' | 'right', heading: string) => {
    const nav = h('nav', { className: `hub-rail hub-rail-${z}` }, [h('p', { className: 'hub-rail-title', textContent: heading }), ...zone(z).map((b) => relic(b, 'rail'))]);
    nav.setAttribute('aria-label', heading);
    return nav;
  };

  const coinChip = h('div', { className: 'hub-chip', title: t('hub.coins') }, [pixelIconSvg('coin'), h('span', { className: 'hub-chip-value', textContent: options.coins.toLocaleString() })]);
  coinChip.setAttribute('aria-label', `${t('hub.coins')}: ${options.coins}`);

  const partner = options.partner
    ? (() => {
        const change = h('button', { className: 'hub-altar-change', type: 'button', textContent: t('hub.partner.change') });
        const pokemon = options.buttons.find((b) => b.id === 'pokemon');
        if (pokemon) {
          change.dataset.hub = 'partner';
          change.addEventListener('click', () => pick(pokemon));
        }
        const p = options.partner;
        if (pokemon && !pokemon.locked) change.prepend(pixelIconSvg('pokemon'));
        // A relic nameplate under the partner (owner: "Presenta mejor el caminante que usas"): name, types, passive, change.
        const plate = h('div', { className: 'hub-plate' }, [
          h('p', { className: 'hub-altar-kicker', textContent: t('hub.partner') }),
          h('h2', { className: 'hub-altar-name', textContent: p.name }),
          h('div', { className: 'hub-altar-types' }, p.badges),
          ...(p.passive ? [h('p', { className: 'hub-plate-passive', title: p.passive.description }, [h('span', { className: 'hub-plate-gem' }), h('span', { textContent: p.passive.name })])] : []),
          ...(pokemon && !pokemon.locked ? [change] : []),
        ]);
        return h('section', { className: 'hub-altar' }, [
          h('div', { className: 'hub-altar-stage' }, [h('div', { className: 'hub-altar-glow' }), h('div', { className: 'hub-altar-sprite' }, [p.portrait]), h('div', { className: 'hub-altar-stone' })]),
          plate,
        ]);
      })()
    : h('section', { className: 'hub-altar is-empty' }, [h('div', { className: 'hub-altar-stage' }, [h('div', { className: 'hub-altar-glow' }), h('div', { className: 'hub-altar-stone' })])]);

  const newsButton = options.buttons.find((b) => b.id === 'news');
  const newsCard = options.news && newsButton
    ? (() => {
        const el = h('button', { className: `hub-news${newsButton.badge ? ' has-badge' : ''}`, type: 'button' }, [
          pixelIconSvg('news'),
          h('span', { className: 'hub-news-text' }, [h('small', { textContent: `${t('hub.news')} · v${options.news.version}` }), h('span', { textContent: options.news.line })]),
        ]);
        el.dataset.hub = 'news-card';
        el.addEventListener('click', () => pick(newsButton));
        return el;
      })()
    : h('div');

  const profile = h('div', { className: 'hub-profile' }, [
    h('div', { className: 'hub-profile-face' }, options.profile.portrait ? [options.profile.portrait] : []),
    h('div', { className: 'hub-profile-text' }, [h('strong', { textContent: options.profile.name }), h('small', { textContent: options.profile.line })]),
  ]);

  const element = h('div', { className: `hub${options.touch ? ' is-touch' : ''}` }, [
    h('header', { className: 'hub-top' }, [
      profile,
      h('div', { className: 'hub-logo' }, [h('h1', { textContent: t('app.title') }), h('p', { className: 'title-alt', textContent: t('title.alt') })]),
      h('div', { className: 'hub-system' }, [coinChip, ...zone('system').map((b) => relic(b, 'system'))]),
    ]),
    rail('left', t('hub.rail.partner')),
    partner,
    rail('right', t('hub.rail.world')),
    h('footer', { className: 'hub-bottom' }, [
      newsCard,
      h('div', { className: 'hub-cta' }, [...(playButton ? [playButton] : []), ...(onlineButton ? [onlineButton] : [])]),
      h('div', { className: 'hub-links' }, zone('links').map((b) => relic(b, 'link'))),
    ]),
    h('p', { className: 'hub-hint', textContent: t(options.touch ? 'hub.hint.touch' : 'hub.hint') }),
    h('p', { className: 'build-label', textContent: options.buildLabel }),
    status,
  ]);

  const controls = (): HTMLElement[] => [...element.querySelectorAll<HTMLElement>('[data-hub]')].filter((el) => el.offsetParent !== null);

  const KEYS: Record<string, HubDirection> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
  const onKey = (e: KeyboardEvent) => {
    // The page moved on (show() replaced the hub): the listener leaves with it.
    if (!element.isConnected) {
      window.removeEventListener('keydown', onKey);
      return;
    }
    if (document.querySelector('.town-shop')) return;
    const dir = KEYS[e.code];
    if (!dir) return;
    const list = controls();
    if (list.length === 0) return;
    e.preventDefault();
    const current = list.includes(document.activeElement as HTMLElement) ? (document.activeElement as HTMLElement) : null;
    if (!current) {
      (byId.get('play') ?? list[0])!.focus();
      return;
    }
    const points = list.map((el, i) => {
      const r = el.getBoundingClientRect();
      return { id: String(i), x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const next = hubStep(points, String(list.indexOf(current)), dir);
    list[Number(next)]?.focus();
  };
  window.addEventListener('keydown', onKey);

  const focus = (id?: HubId) => {
    const el = (id && byId.get(id)) || byId.get('play');
    el?.focus({ preventScroll: true });
  };
  queueMicrotask(() => focus(options.initial));

  return {
    element,
    focus,
    dispose() {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(statusTimer);
    },
  };
}
