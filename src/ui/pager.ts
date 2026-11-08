import { t } from '../i18n';
import { clampPage, fitGrid, pageCount, pageOf, pageRange } from './pager-model';
import { h } from './window';
import '../styles/pager.css';

/**
 * Phone paging (odd/tasks/mobile-pass.md T6; owner 2026-11-08: "en móvil debe verse todo sin hacer scroll").
 * A grid or list whose items do not fit its box shows one page of them, with relic buttons and "2/5" below
 * instead of a scrollbar. Only on a phone (touch and a short screen); on desktop the host keeps its own layout.
 * The host must be a box of fixed size (flex: 1, min-height: 0) whose children are the items, all alike in size.
 */

/** A touch screen short enough to be a phone held on its side. */
export const isPhone = (): boolean => document.documentElement.classList.contains('touch') && !!window.matchMedia?.('(max-height: 560px)').matches;

export interface PagerOptions {
  /** Where the page controls go; by default right after the host. */
  nav?: HTMLElement;
  enabled?(): boolean;
  /** A page was shown (also after a refresh). */
  onPage?(page: number, count: number): void;
}

export interface Pager {
  readonly nav: HTMLElement;
  page(): number;
  pages(): number;
  /** Items shown per page (all of them while the pager is idle). */
  perPage(): number;
  /** Items changed or the box resized: measure again, keep the page of the first shown item. */
  refresh(): void;
  /** Back to the first page (the items were replaced). */
  reset(): void;
  go(page: number): void;
  /** Turns to the page holding the item (a node or its index). */
  reveal(item: Element | number): void;
  /** Reveals, then focuses. */
  focusItem(item: HTMLElement): void;
  /** The items on the shown page. */
  visible(): HTMLElement[];
  dispose(): void;
}

const arrow = (side: 'prev' | 'next'): HTMLButtonElement => {
  const b = h('button', { type: 'button', className: `pg-btn pg-${side}` }) as HTMLButtonElement;
  b.append(h('span', { className: 'pg-arrow' }));
  return b;
};

export function attachPager(host: HTMLElement, options: PagerOptions = {}): Pager {
  const prev = arrow('prev');
  const next = arrow('next');
  const label = h('span', { className: 'pg-count' });
  label.setAttribute('aria-live', 'polite');
  const nav = options.nav ?? h('div', { className: 'pg-nav' });
  nav.classList.add('pg-nav');
  nav.append(prev, label, next);
  nav.hidden = true;
  if (!options.nav) host.after(nav);
  const enabled = options.enabled ?? isPhone;

  let page = 0;
  let per = Number.POSITIVE_INFINITY;
  let count = 1;
  const items = (): HTMLElement[] => [...host.children].filter((c): c is HTMLElement => c instanceof HTMLElement);

  const apply = (): void => {
    const all = items();
    const [from, to] = pageRange(page, per, all.length);
    all.forEach((el, i) => el.classList.toggle('pg-off', i < from || i >= to));
    label.textContent = `${page + 1}/${count}`;
    const words = t('pager.page').replace('{n}', String(page + 1)).replace('{total}', String(count));
    nav.setAttribute('aria-label', words);
    prev.setAttribute('aria-label', t('pager.prev'));
    next.setAttribute('aria-label', t('pager.next'));
    prev.disabled = page <= 0;
    next.disabled = page >= count - 1;
    options.onPage?.(page, count);
  };

  const refresh = (): void => {
    const all = items();
    const firstShown = Math.max(0, all.findIndex((el) => !el.classList.contains('pg-off')));
    const keep = Number.isFinite(per) ? firstShown : 0;
    all.forEach((el) => el.classList.remove('pg-off'));
    host.classList.toggle('pg-host', enabled());
    nav.hidden = true;
    per = Number.POSITIVE_INFINITY;
    count = 1;
    page = 0;
    if (!enabled() || all.length < 2) return void options.onPage?.(0, 1);
    const overflows = (): boolean => host.scrollHeight > host.clientHeight + 1;
    if (!overflows()) return void options.onPage?.(0, 1);
    nav.hidden = false; // the controls take their room first, then the box is measured
    const first = all[0]!.getBoundingClientRect();
    const style = getComputedStyle(host);
    const gap = Number.parseFloat(style.rowGap) || 0;
    const pad = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    const cols = Math.max(1, all.filter((el) => Math.abs(el.getBoundingClientRect().top - first.top) < 2).length);
    const fit = fitGrid({ width: first.width, height: host.clientHeight - pad, itemWidth: first.width, itemHeight: first.height, gap });
    per = fit.rows * cols;
    count = pageCount(all.length, per);
    page = clampPage(pageOf(keep, per), count);
    apply();
  };

  const go = (target: number): void => {
    if (!Number.isFinite(per)) return;
    page = clampPage(target, count);
    apply();
  };
  prev.addEventListener('click', () => go(page - 1));
  next.addEventListener('click', () => go(page + 1));

  // A swipe along the box turns the page.
  let startX: number | null = null;
  const onStart = (e: TouchEvent): void => { startX = e.touches[0]?.clientX ?? null; };
  const onEnd = (e: TouchEvent): void => {
    const x = e.changedTouches[0]?.clientX;
    if (startX !== null && x !== undefined && Math.abs(x - startX) > 56) go(page + (x < startX ? 1 : -1));
    startX = null;
  };
  host.addEventListener('touchstart', onStart, { passive: true });
  host.addEventListener('touchend', onEnd, { passive: true });

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => refresh()) : null;
  observer?.observe(host);

  const reveal = (item: Element | number): void => {
    const index = typeof item === 'number' ? item : items().indexOf(item as HTMLElement);
    if (index >= 0 && Number.isFinite(per)) go(pageOf(index, per));
  };
  return {
    nav,
    page: () => page,
    pages: () => count,
    perPage: () => per,
    refresh,
    reset: () => { page = 0; refresh(); },
    go,
    reveal,
    focusItem: (item) => { reveal(item); item.focus({ preventScroll: true }); },
    visible: () => items().filter((el) => !el.classList.contains('pg-off')),
    dispose: () => {
      observer?.disconnect();
      host.removeEventListener('touchstart', onStart);
      host.removeEventListener('touchend', onEnd);
      nav.remove();
    },
  };
}
