import { describe, expect, it } from 'vitest';
import { httpAccountApi } from '../../src/adapters/account-api';

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

function fakeFetch(answers: { status: number; body?: unknown }[] | Error) {
  const seen: Seen[] = [];
  const fetchFn = async (input: string, init: RequestInit = {}): Promise<Response> => {
    seen.push({ url: input, method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) }, body: init.body ? JSON.parse(init.body as string) : undefined });
    if (answers instanceof Error) throw answers;
    const next = answers.shift() ?? { status: 500 };
    return new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: { 'Content-Type': 'application/json' } });
  };
  return { seen, fetchFn };
}

const BASE = 'https://api.test';
const session = { token: 'pb-token', record: { id: 'u1', email: 'ana@example.com' } };

describe('clerk session exchange', () => {
  it('posts the Clerk token as a Bearer header with no body and parses the usual auth shape', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: session }]);
    const result = await httpAccountApi(BASE, fetchFn).clerkSession('clerk.jwt.token');
    expect(result).toEqual({ ok: true, value: { token: 'pb-token', userId: 'u1', email: 'ana@example.com' } });
    expect(seen[0]).toMatchObject({ url: `${BASE}/api/sd/clerk/session`, method: 'POST', headers: { Authorization: 'Bearer clerk.jwt.token' } });
    expect(seen[0]!.body).toBeUndefined();
  });

  it('401 is unauthorized, 503 (Clerk unset on the server) is a server error, no network is offline', async () => {
    const api = httpAccountApi(BASE, fakeFetch([{ status: 401 }, { status: 503 }]).fetchFn);
    expect(await api.clerkSession('t')).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(await api.clerkSession('t')).toEqual({ ok: false, error: { kind: 'server' } });
    expect(await httpAccountApi(BASE, fakeFetch(new Error('down')).fetchFn).clerkSession('t')).toEqual({ ok: false, error: { kind: 'offline' } });
  });

  it('an answer that is not an auth session is a server error', async () => {
    const { fetchFn } = fakeFetch([{ status: 200, body: { token: '' } }]);
    expect(await httpAccountApi(BASE, fetchFn).clerkSession('t')).toEqual({ ok: false, error: { kind: 'server' } });
  });

  it('never calls with an empty token', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: session }]);
    expect(await httpAccountApi(BASE, fetchFn).clerkSession('')).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(seen).toHaveLength(0);
  });
});
