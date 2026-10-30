/**
 * The admins' calls to the game API (`/api/sd/admin`, server/README.md "Bug
 * reports"). The server decides who is an admin; this only asks. The token
 * goes only to `base`, in the `Authorization` header, as PocketBase expects it.
 */

export const TICKET_STATUSES = ['new', 'triaged', 'issue', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
/** What an admin can set from the game; "issue" goes with a link the owner sets by hand. */
export const TRIAGE_STATUSES = ['new', 'triaged', 'closed'] as const satisfies readonly TicketStatus[];
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export interface Ticket {
  ref: string;
  created: string;
  category: string;
  status: TicketStatus;
  description: string;
  steps: string;
  expected: string;
  observed: string;
  version: string;
  device: string;
  /** The session snapshot the player attached, or null. */
  diagnostics: unknown;
  githubIssue: string;
}

export type AdminError = 'denied' | 'unavailable';
export type AdminResult<T> = { ok: true; value: T } | { ok: false; error: AdminError };

export interface AdminApi {
  /** False on anything but the server saying yes, so a failure hides the panel. */
  isAdmin(token: string): Promise<boolean>;
  list(token: string): Promise<AdminResult<{ tickets: Ticket[]; total: number }>>;
  setStatus(token: string, ref: string, status: TriageStatus): Promise<AdminResult<Ticket>>;
}

const TIMEOUT_MS = 15_000;
const REF = /^SD-[A-Z0-9]{6}$/;

type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

function ticket(raw: unknown): Ticket | null {
  if (!isObject(raw) || typeof raw.ref !== 'string' || !TICKET_STATUSES.includes(raw.status as TicketStatus)) return null;
  return {
    ref: raw.ref,
    created: text(raw.created),
    category: text(raw.category),
    status: raw.status as TicketStatus,
    description: text(raw.description),
    steps: text(raw.steps),
    expected: text(raw.expected),
    observed: text(raw.observed),
    version: text(raw.version),
    device: text(raw.device),
    diagnostics: raw.diagnostics ?? null,
    githubIssue: text(raw.githubIssue),
  };
}

export function httpAdminApi(base: string, fetchFn: FetchFn = (input, init) => globalThis.fetch(input, init)): AdminApi {
  async function call<T>(token: string, method: string, path: string, body: unknown, read: (body: unknown) => T | null): Promise<AdminResult<T>> {
    try {
      const headers: Record<string, string> = { Authorization: token };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetchFn(`${base}${path}`, {
        method,
        headers,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        credentials: 'omit',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.status === 401 || response.status === 403) return { ok: false, error: 'denied' };
      if (!response.ok) return { ok: false, error: 'unavailable' };
      const value = read(await response.json());
      return value === null ? { ok: false, error: 'unavailable' } : { ok: true, value };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  return {
    async isAdmin(token) {
      const result = await call(token, 'GET', '/api/sd/admin/me', undefined, (body) => (isObject(body) && body.admin === true ? true : null));
      return result.ok;
    },
    list: (token) =>
      call(token, 'GET', '/api/sd/admin/reports', undefined, (body) => {
        if (!isObject(body) || !Array.isArray(body.items)) return null;
        const tickets = body.items.flatMap((item) => ticket(item) ?? []);
        return { tickets, total: typeof body.total === 'number' ? body.total : tickets.length };
      }),
    async setStatus(token, ref, status) {
      // A ref only ever comes from the server; anything else never reaches a path.
      if (!REF.test(ref)) return { ok: false, error: 'unavailable' };
      return call(token, 'PATCH', `/api/sd/admin/reports/${ref}`, { status }, ticket);
    },
  };
}
