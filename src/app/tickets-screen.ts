import type { AdminApi, AdminError, Ticket, TicketStatus, TriageStatus } from '../adapters/admin-api';
import { t } from '../i18n';
import { cursorList, type CursorList, type ListItem } from '../ui/cursor-list';
import { h } from '../ui/window';

/**
 * "Tickets": the admins' inbox of player reports. The server decides who gets
 * here (adapters/admin-api.ts) and refuses everyone else whatever this screen
 * does. All a player wrote is shown as text, never as markup.
 */

export type TicketFilter = TicketStatus | 'all';
export const TICKET_FILTERS: readonly TicketFilter[] = ['new', 'triaged', 'issue', 'closed', 'all'];

/** The tickets a filter and a search show, in the order they came. The search ignores case and looks at what the player wrote and the reference. */
export function visibleTickets(tickets: readonly Ticket[], filter: TicketFilter, query: string): Ticket[] {
  const needle = query.trim().toLowerCase();
  return tickets.filter((ticket) => {
    if (filter !== 'all' && ticket.status !== filter) return false;
    if (!needle) return true;
    return [ticket.ref, ticket.description, ticket.steps, ticket.expected, ticket.observed].some((field) => field.toLowerCase().includes(needle));
  });
}

/** One row of the list: the first line of the description, cut short. */
export function ticketSummary(ticket: Ticket, length = 48): string {
  const line = ticket.description.split('\n')[0]!.trim();
  return line.length > length ? `${line.slice(0, length - 1)}…` : line;
}

/** The technical snapshot as readable text, or '' when the player sent none. */
export function diagnosticsText(diagnostics: unknown): string {
  return diagnostics === null || diagnostics === undefined || diagnostics === '' ? '' : JSON.stringify(diagnostics, null, 2);
}

/** Who may see the entry: asks the server once per token, and forgets it when the token changes (log out, another account). */
export function adminAccess(deps: { token(): string | null; isAdmin(token: string): Promise<boolean> }): { known(): boolean; check(): Promise<boolean> } {
  let asked: string | null = null;
  let answer = false;
  const known = () => asked !== null && asked === deps.token() && answer;
  return {
    known,
    async check() {
      const token = deps.token();
      if (!token) return false;
      if (asked === token) return answer;
      const result = await deps.isAdmin(token);
      asked = token;
      answer = result;
      return known();
    },
  };
}

const STYLE = `
.tickets-window .md-window-body { max-height: calc(100dvh - 150px); overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--md-cursor) transparent; }
.tickets-window { width: min(720px, calc(100vw - 16px)); }
.tickets-window input.tickets-search { font: inherit; font-size: 16px; color: var(--md-cursor); background: var(--md-ink); border: 1px solid var(--md-ink); width: 100%; box-sizing: border-box; padding: 2px 6px; }
.tickets-window input.tickets-search:focus { outline: none; border-color: var(--md-cursor); }
.tickets-window .md-item.tickets-field { flex-wrap: wrap; }
.tickets-window .md-item.tickets-field .md-value { flex: 1 1 100%; padding-left: 1.2em; }
.tickets-window .tickets-ref { color: var(--md-cursor); letter-spacing: 0.1em; }
.tickets-window .tickets-text { white-space: pre-wrap; overflow-wrap: anywhere; margin: 0 0 8px; }
.tickets-window .tickets-label { margin: 8px 0 0; font-size: 14px; }
.tickets-window pre.tickets-text { font-size: 12px; }
html.touch .tickets-window { margin-top: 52px; }
`;

export interface TicketsWindowOptions {
  api: Pick<AdminApi, 'list' | 'setStatus'>;
  token(): string | null;
  onBack(): void;
}

const errorKey = (error: AdminError) => (error === 'denied' ? 'tickets.error.denied' : 'tickets.error.unavailable');

export function ticketsWindow(options: TicketsWindowOptions): { element: HTMLElement; dispose(): void } {
  const status = h('p', { className: 'lobby-error' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const title = h('h2', { className: 'md-window-title', textContent: t('tickets.title') });
  const body = h('div', { className: 'md-window-body' });
  const element = h('section', { className: 'md-window shop tickets-window' }, [h('style', { textContent: STYLE }), title, body]);
  let list: CursorList | null = null;
  let disposed = false;
  let tickets: Ticket[] = [];
  let total = 0;
  let filter: TicketFilter = 'new';
  let query = '';

  const setList = (items: ListItem[], onBack: () => void): CursorList => {
    list?.dispose();
    list = cursorList({ items, onBack, label: t('tickets.title'), className: 'shop-list' });
    return list;
  };
  const statusName = (value: TicketStatus) => t(`tickets.status.${value}`);
  const categoryName = (value: string) => t(`report.category.${value}`);

  const filterValue = h('span');
  const counts = h('p', { className: 'dim' });
  let inbox: CursorList | null = null;

  const rows = (): ListItem[] =>
    visibleTickets(tickets, filter, query).map((ticket) => ({
      label: h('span', {}, [h('span', { className: 'tickets-ref', textContent: ticket.ref }), ` ${ticketSummary(ticket)}`]),
      value: categoryName(ticket.category),
      onConfirm: () => detail(ticket),
    }));

  function paintInbox(): void {
    filterValue.textContent = filter === 'all' ? t('tickets.filter.all') : statusName(filter);
    const shown = visibleTickets(tickets, filter, query).length;
    counts.textContent = total > tickets.length ? t('tickets.count.more').replaceAll('{shown}', String(shown)).replaceAll('{total}', String(total)) : t('tickets.count').replaceAll('{shown}', String(shown));
    inbox?.setItems([...head(), ...rows(), { label: t('tickets.reload'), onConfirm: () => void load() }, { label: t('menu.back'), onConfirm: options.onBack }]);
  }

  const cycle = (delta: -1 | 1) => {
    const i = TICKET_FILTERS.indexOf(filter);
    filter = TICKET_FILTERS[(i + delta + TICKET_FILTERS.length) % TICKET_FILTERS.length]!;
    paintInbox();
  };
  const search = h('input', { className: 'tickets-search', type: 'search' });
  search.placeholder = t('tickets.search');
  search.setAttribute('aria-label', t('tickets.search'));
  // A click on the box focuses it; it must not also confirm the row behind it.
  search.addEventListener('click', (e) => e.stopPropagation());
  search.addEventListener('input', () => {
    query = search.value;
    paintInbox();
    search.focus();
  });
  const head = (): ListItem[] => [
    { label: t('tickets.filter'), value: filterValue, onAdjust: cycle, onConfirm: () => cycle(1) },
    { label: t('tickets.search'), value: search, className: 'tickets-field', onConfirm: () => search.focus() },
  ];

  function showInbox(): void {
    title.textContent = t('tickets.title');
    inbox = setList([], options.onBack);
    body.replaceChildren(inbox.element, counts, status);
    paintInbox();
  }

  function detail(ticket: Ticket): void {
    inbox = null;
    title.textContent = ticket.ref;
    const back = () => {
      status.textContent = '';
      showInbox();
    };
    const move = (next: TriageStatus) => async () => {
      const token = options.token();
      status.textContent = t('tickets.saving');
      const result = token ? await options.api.setStatus(token, ticket.ref, next) : ({ ok: false, error: 'denied' } as const);
      if (disposed) return;
      if (!result.ok) {
        status.textContent = t(errorKey(result.error));
        return;
      }
      tickets = tickets.map((other) => (other.ref === ticket.ref ? result.value : other));
      status.textContent = t('tickets.saved');
      detail(result.value);
    };
    const field = (label: string, value: string) => (value ? [h('p', { className: 'dim tickets-label', textContent: label }), h('p', { className: 'tickets-text', textContent: value })] : []);
    const diagnostics = diagnosticsText(ticket.diagnostics);
    const actions: ListItem[] = [
      ...(ticket.status === 'triaged' ? [] : [{ label: t('tickets.mark.triaged'), onConfirm: () => void move('triaged')() }]),
      ...(ticket.status === 'closed' ? [] : [{ label: t('tickets.mark.closed'), onConfirm: () => void move('closed')() }]),
      ...(ticket.status === 'new' ? [] : [{ label: t('tickets.mark.new'), onConfirm: () => void move('new')() }]),
      { label: t('menu.back'), onConfirm: back },
    ];
    const actionList = setList(actions, back);
    body.replaceChildren(
      h('p', { textContent: `${categoryName(ticket.category)} · ${statusName(ticket.status)} · ${ticket.created.slice(0, 16)}` }),
      ...field(t('report.description'), ticket.description),
      ...field(t('report.steps'), ticket.steps),
      ...field(t('report.expected'), ticket.expected),
      ...field(t('report.observed'), ticket.observed),
      ...field(t('tickets.version'), ticket.version),
      ...field(t('tickets.device'), ticket.device),
      ...field(t('tickets.issue'), ticket.githubIssue),
      ...(diagnostics ? [h('p', { className: 'dim tickets-label', textContent: t('tickets.technical') }), h('pre', { className: 'tickets-text', textContent: diagnostics })] : []),
      actionList.element,
      status,
    );
  }

  async function load(): Promise<void> {
    const token = options.token();
    status.textContent = t('tickets.loading');
    const result = token ? await options.api.list(token) : ({ ok: false, error: 'denied' } as const);
    if (disposed) return;
    if (!result.ok) {
      status.textContent = t(errorKey(result.error));
      return;
    }
    tickets = result.value.tickets;
    total = result.value.total;
    status.textContent = '';
    showInbox();
  }

  showInbox();
  void load();
  return {
    element,
    dispose: () => {
      disposed = true;
      list?.dispose();
      list = null;
    },
  };
}
