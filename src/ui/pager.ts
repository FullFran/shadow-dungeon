import { t } from '../i18n';
import { clampPage, packRows, pageIndexOf } from './pager-model';
import { h } from './window';
import '../styles/pager.css';

/**
 * Phone paging (odd/tasks/mobile-pass.md T6; owner 2026-11-08: "en móvil debe verse todo sin hacer scroll").
 * A grid or list whose items do not fit its box shows one page of them, with relic buttons and "2/5" below
 * instead of a scrollbar. Only on a phone (touch and a short screen); on desktop the host keeps its own layout.
 * The host must be a box of fixed size (flex: 1, min-height: 0) whose children are the items; rows of items may differ in height.
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
  /** Items on the first page (all of them while the pager is idle). */
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
  /** Index of the item that opens each page; null while the pager is idle (everything shows). */
  let starts: number[] | null = null;
  let count = 1;
  const items = (): HTMLElement[] => [...host.children].filter((c): c is HTMLElement => c instanceof HTMLElement);

  const apply = (): void => {
    const all = items();
    const from = starts?.[page] ?? 0;
    const to = starts?.[page + 1] ?? all.length;
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
    const keep = starts ? firstShown : 0;
    all.forEach((el) => el.classList.remove('pg-off'));
    host.classList.toggle('pg-host', enabled());
    nav.hidden = true;
    starts = null;
    count = 1;
    page = 0;
    if (!enabled() || all.length < 2) return void options.onPage?.(0, 1);
    const overflows = (): boolean => host.scrollHeight > host.clientHeight + 1;
    if (!overflows()) {
      if (checks === 0) settle();
      return void options.onPage?.(0, 1);
    }
    nav.hidden = false; // the controls take their room first, then the box is measured
    const style = getComputedStyle(host);
    const gap = Number.parseFloat(style.rowGap) || 0;
    const pad = (Number.parseFloat(style.paddingTop) || 0) + (Number.parseFloat(style.paddingBottom) || 0);
    // Rows: items that share a top. A page takes whole rows while the next one still fits the box.
    const rows: { first: number; height: number }[] = [];
    let rowTop = Number.NaN;
    // Layout sizes, not the painted box: a window still scaling in (md-open) would report shrunken rows and let one too many in.
    all.forEach((el, i) => {
      const top = el.offsetTop;
      const height = el.offsetHeight;
      if (rows.length === 0 || Math.abs(top - rowTop) > 2) {
        rows.push({ first: i, height });
        rowTop = top;
      } else rows[rows.length - 1]!.height = Math.max(rows[rows.length - 1]!.height, height);
    });
    const opens = packRows(rows.map((r) => r.height), host.clientHeight - pad, gap);
    starts = opens.map((row) => rows[row]!.first);
    count = starts.length;
    page = clampPage(pageIndexOf(keep, starts), count);
    apply();
    if (checks === 0) settle();
  };

  const go = (target: number): void => {
    if (!starts) return;
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
  // A measure taken before the pixel font or the rows around the box settled can leave a page that does not fit: check it
  // again on the next frame (a few times at most) and once the fonts are ready.
  let checks = 0;
  const verify = (): void => {
    if (!host.isConnected || !enabled() || checks > 3) return;
    if (host.scrollHeight > host.clientHeight + 1) {
      checks += 1;
      refresh();
    }
  };
  const settle = (): void => {
    checks = 0;
    requestAnimationFrame(() => requestAnimationFrame(verify));
  };
  if (typeof document !== 'undefined') void document.fonts?.ready.then(() => host.isConnected && refresh());

  const reveal = (item: Element | number): void => {
    const index = typeof item === 'number' ? item : items().indexOf(item as HTMLElement);
    if (index >= 0 && starts) go(pageIndexOf(index, starts));
  };
  return {
    nav,
    page: () => page,
    pages: () => count,
    perPage: () => (starts ? (starts[1] ?? items().length) : items().length),
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
