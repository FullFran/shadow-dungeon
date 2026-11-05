import '../styles/system-notice.css';
import { ACH_NEWS_ICONS } from './icons/achievements-news-icons';
import { INSTALL_ICON, UPDATE_ICON } from './icons/install-icons';
import { createNoticeQueue, noticeKey, noticeMotion, veilDismissible, type NoticeAction, type NoticeKind, type NoticeQueue, type NoticeSpec } from './notice-model';
import { PIXEL_ICONS, pixelSvgOf, type PixelIcon } from './pixel-icons';
import { h } from './window';

/**
 * The system notice view (.agents/DESIGN.md §4 "System notice"; owner 2026-11-04: "con el fondo blur oscurecido, arriba y más grande"):
 * a blurred, darkened veil over the whole viewport and one large relic card at the top centre. The same component serves the
 * update, install and news notices (src/pwa/notices.ts); the queue (notice-model.ts) shows one at a time, by priority, only on
 * the hub. Focus is trapped in the card, the page behind is `inert`, Enter is the primary and Esc the secondary.
 */

/** Another module (the first-run welcome) holds notices back with this event; `detail` is the new state. */
export const NOTICES_BLOCKED_EVENT = 'sd:notices-blocked';

/** Hides or releases every system notice: `setNoticesBlocked(true)` while the welcome gate is up. */
export function setNoticesBlocked(blocked: boolean): void {
  window.dispatchEvent(new CustomEvent<boolean>(NOTICES_BLOCKED_EVENT, { detail: blocked }));
}

const HEAD_ICON: Record<NoticeKind, PixelIcon> = { install: INSTALL_ICON, update: UPDATE_ICON, news: PIXEL_ICONS.news };

const lineIcon = (key: string): PixelIcon => (key === 'update' ? UPDATE_ICON : key === 'install' ? INSTALL_ICON : ACH_NEWS_ICONS[key] ?? PIXEL_ICONS[key as keyof typeof PIXEL_ICONS] ?? PIXEL_ICONS.star);

/** The hub is on screen and nothing sits over it: a run, the town, a service window or the drawer all make notices wait. */
function onTheHub(): boolean {
  return document.querySelector('.hub') !== null && document.querySelector('.town-shop, .drawer-veil, .pwa-ios, canvas.game, canvas.town') === null;
}

const FOCUSABLE = 'button:not([disabled])';

function present(spec: NoticeSpec, done: () => void): void {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = noticeMotion(reduced);
  const app = document.getElementById('app');
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const veil = h('div', { className: 'sys-notice-veil' });
  veil.dataset.kind = spec.kind;
  veil.style.setProperty('--notice-veil-ms', `${motion.veilMs}ms`);
  veil.style.setProperty('--notice-card-ms', `${motion.cardMs}ms`);
  veil.style.setProperty('--notice-drop', `${-motion.dropPx}px`);

  const titleId = `sys-notice-title-${spec.kind}`;
  const card = h('section', { className: 'sys-notice' });
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-labelledby', titleId);

  const buttons: HTMLButtonElement[] = [];
  const button = (action: NoticeAction, className: string, which: 'primary' | 'secondary' | 'tertiary'): HTMLButtonElement => {
    const b = h('button', { className, type: 'button', textContent: action.label });
    b.dataset.notice = which;
    b.addEventListener('click', () => choose(action));
    buttons.push(b);
    return b;
  };

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    veil.remove();
    if (app) app.inert = false;
    if (before?.isConnected) before.focus({ preventScroll: true });
    done();
  };
  const choose = (action: NoticeAction): void => {
    if (closed) return;
    if (action.run() === 'close') close();
    else {
      // The update reloads the page: keep the card up and the buttons quiet so nothing is pressed twice.
      card.setAttribute('aria-busy', 'true');
      for (const b of buttons) b.disabled = true;
    }
  };

  const primary = button(spec.primary, 'sys-notice-primary', 'primary');
  const secondary = spec.secondary ? button(spec.secondary, 'sys-notice-quiet', 'secondary') : null;
  const tertiary = spec.tertiary ? button(spec.tertiary, 'sys-notice-link', 'tertiary') : null;

  card.append(
    h('div', { className: 'sys-notice-head' }, [
      pixelSvgOf(HEAD_ICON[spec.kind], 'px-icon sys-notice-icon'),
      h('h2', { className: 'sys-notice-title', id: titleId, textContent: spec.title }),
    ]),
    h('ul', { className: 'sys-notice-lines' }, spec.lines.slice(0, 3).map((line) => h('li', { className: 'sys-notice-line' }, [pixelSvgOf(lineIcon(line.icon), 'px-icon sys-notice-line-icon'), h('span', { textContent: line.text })]))),
    h('div', { className: 'sys-notice-actions' }, [primary, ...(secondary ? [secondary] : [])]),
    ...(tertiary ? [h('div', { className: 'sys-notice-foot' }, [tertiary])] : []),
  );
  veil.append(card);

  const onKey = (e: KeyboardEvent): void => {
    if (!veil.isConnected) return;
    // The notice owns the keyboard: nothing reaches the hub behind it.
    e.stopPropagation();
    if (e.key === 'Tab') {
      const order = [...card.querySelectorAll<HTMLButtonElement>(FOCUSABLE)];
      if (order.length === 0) return e.preventDefault();
      const at = order.indexOf(document.activeElement as HTMLButtonElement);
      const next = e.shiftKey ? (at <= 0 ? order.length - 1 : at - 1) : at === order.length - 1 ? 0 : at + 1;
      e.preventDefault();
      order[next]!.focus();
      return;
    }
    const onButton = document.activeElement instanceof HTMLButtonElement && card.contains(document.activeElement);
    const key = noticeKey(e.key, spec, onButton);
    if (!key) return;
    e.preventDefault();
    choose(key === 'primary' ? spec.primary : spec.secondary ?? spec.primary);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (veil.isConnected) e.stopPropagation();
  };
  veil.addEventListener('pointerdown', (e) => {
    if (e.target === veil) veil.dataset.press = '1';
    else delete veil.dataset.press;
  });
  veil.addEventListener('click', (e) => {
    const pressed = veil.dataset.press === '1';
    delete veil.dataset.press;
    // Only a press that starts and ends on the veil, and only for notices that are safe to put off.
    if (e.target === veil && pressed && veilDismissible(spec.kind) && spec.secondary) choose(spec.secondary);
  });

  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  if (app) app.inert = true;
  document.body.append(veil);
  primary.focus({ preventScroll: true });
}

const queue: NoticeQueue = createNoticeQueue({ ready: onTheHub, show: present });
window.addEventListener(NOTICES_BLOCKED_EVENT, (e) => queue.setBlocked((e as CustomEvent<boolean>).detail === true));

/** The page's one notice queue: the update, install and news notices go through it. */
export const notices = queue;

/** True while another module holds notices back. */
export function noticesBlocked(): boolean {
  return queue.blocked();
}
