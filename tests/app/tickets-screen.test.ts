import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TICKET_STATUSES, type Ticket } from '../../src/adapters/admin-api';
import { adminAccess, diagnosticsText, TICKET_FILTERS, ticketSummary, visibleTickets } from '../../src/app/tickets-screen';
import { catalog, LANGUAGES } from '../../src/i18n';

const ticket = (o: Partial<Ticket>): Ticket => ({ ref: 'SD-AAAAAA', created: '', category: 'bug', status: 'new', description: '', steps: '', expected: '', observed: '', version: '', device: '', diagnostics: null, githubIssue: '', ...o });

describe('the inbox filter and search', () => {
  const list = [ticket({ ref: 'SD-AAAAAA', description: 'El jefe se congela' }), ticket({ ref: 'SD-BBBBBB', status: 'closed', steps: 'Entrar al piso 3' }), ticket({ ref: 'SD-CCCCCC', status: 'triaged', description: 'otra cosa' })];
  it('filters by status, or none with all', () => {
    expect(visibleTickets(list, 'new', '').map((x) => x.ref)).toEqual(['SD-AAAAAA']);
    expect(visibleTickets(list, 'all', '').map((x) => x.ref)).toEqual(['SD-AAAAAA', 'SD-BBBBBB', 'SD-CCCCCC']);
  });
  it('searches what the player wrote and the reference, ignoring case, inside the filter', () => {
    expect(visibleTickets(list, 'all', ' JEFE ').map((x) => x.ref)).toEqual(['SD-AAAAAA']);
    expect(visibleTickets(list, 'all', 'piso').map((x) => x.ref)).toEqual(['SD-BBBBBB']);
    expect(visibleTickets(list, 'all', 'sd-ccc').map((x) => x.ref)).toEqual(['SD-CCCCCC']);
    expect(visibleTickets(list, 'new', 'piso')).toEqual([]);
  });
  it('offers every status as a filter', () => {
    for (const status of TICKET_STATUSES) expect(TICKET_FILTERS).toContain(status);
  });
});

describe('ticket text', () => {
  it('summarizes with the first line, cut short', () => {
    expect(ticketSummary(ticket({ description: 'una línea\notra' }))).toBe('una línea');
    expect(ticketSummary(ticket({ description: 'x'.repeat(100) }), 10)).toBe(`${'x'.repeat(9)}…`);
  });
  it('shows no technical data when the player sent none', () => {
    expect(diagnosticsText(null)).toBe('');
    expect(diagnosticsText({ a: 1 })).toContain('"a": 1');
  });
});

describe('who sees the entry', () => {
  it('nobody until the server says yes, and a guest never asks', async () => {
    let token: string | null = null;
    let asked = 0;
    const access = adminAccess({ token: () => token, isAdmin: async () => (asked++, true) });
    expect(await access.check()).toBe(false);
    expect(asked).toBe(0);
    token = 'a';
    expect(access.known()).toBe(false);
    expect(await access.check()).toBe(true);
    expect(access.known()).toBe(true);
  });
  it('asks once per token and forgets on logout or another account', async () => {
    let token: string | null = 'admin';
    let asked = 0;
    const access = adminAccess({ token: () => token, isAdmin: async (value) => (asked++, value === 'admin') });
    await access.check();
    await access.check();
    expect(asked).toBe(1);
    token = null;
    expect(access.known()).toBe(false);
    token = 'player';
    expect(access.known()).toBe(false);
    expect(await access.check()).toBe(false);
    expect(access.known()).toBe(false);
  });
});

describe('the tickets screen wiring', () => {
  const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');
  it('has every string in every language', () => {
    const keys = ['title.tickets', 'options.about.tickets', 'tickets.title', 'tickets.filter', 'tickets.filter.all', 'tickets.search', 'tickets.count', 'tickets.count.more', 'tickets.reload', 'tickets.loading', 'tickets.saving', 'tickets.saved', 'tickets.mark.triaged', 'tickets.mark.closed', 'tickets.mark.new', 'tickets.version', 'tickets.device', 'tickets.issue', 'tickets.technical', 'tickets.error.denied', 'tickets.error.unavailable', ...TICKET_STATUSES.map((s) => `tickets.status.${s}`)];
    for (const language of LANGUAGES) for (const key of keys) expect(catalog(language)[key as never], `${language} ${key}`).toBeTruthy();
  });
  it('never renders what a player wrote as markup', () => {
    expect(read('src/app/tickets-screen.ts')).not.toMatch(/innerHTML|insertAdjacentHTML|outerHTML/);
  });
  it('shows the entry in Options only to a known admin', () => {
    expect(read('src/app/main.ts')).toMatch(/ticketAdmin\.known\(\) \? \[\{ label: t\('title\.tickets'\)/);
  });
  it('carries no list of admins and no email in the client', () => {
    const sources = read('src/app/tickets-screen.ts') + read('src/adapters/admin-api.ts');
    expect(sources).not.toMatch(/@[a-z]+\.[a-z]+/);
  });
});
