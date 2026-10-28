import { describe, expect, it } from 'vitest';
import { apiBaseUrl, DEFAULT_API_URL, httpAccountApi } from '../../src/adapters/account-api';
import { EMPTY_SAVE } from '../../src/app/save';

interface Seen {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** A fetch that records each request and answers from a queue (no network). */
function fakeFetch(answers: { status: number; body?: unknown }[] | Error) {
  const seen: Seen[] = [];
  const fetchFn = async (input: string, init: RequestInit = {}): Promise<Response> => {
    seen.push({ url: input, method: init.method ?? 'GET', headers: { ...(init.headers as Record<string, string>) }, body: init.body ? JSON.parse(init.body as string) : undefined });
    if (answers instanceof Error) throw answers;
    const next = answers.shift() ?? { status: 500 };
    return new Response(next.status === 204 ? null : JSON.stringify(next.body ?? {}), { status: next.status, headers: { 'Content-Type': 'application/json' } });
  };
  return { seen, fetchFn };
}

const BASE = 'https://api.test';

describe('base URL', () => {
  it('defaults to the production API and trims a trailing slash', () => {
    expect(apiBaseUrl(undefined)).toBe(DEFAULT_API_URL);
    expect(apiBaseUrl('')).toBe(DEFAULT_API_URL);
    expect(apiBaseUrl('http://127.0.0.1:8090/')).toBe('http://127.0.0.1:8090');
    expect(DEFAULT_API_URL).toBe('https://sd-api.fullfran.com');
  });
});

describe('http account API', () => {
  it('signs up with the password twice and no token', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: { id: 'u1' } }]);
    const result = await httpAccountApi(BASE, fetchFn).signUp('a@b.es', 'secret123');
    expect(result).toEqual({ ok: true, value: undefined });
    expect(seen[0]).toMatchObject({ url: `${BASE}/api/collections/users/records`, method: 'POST', body: { email: 'a@b.es', password: 'secret123', passwordConfirm: 'secret123' } });
    expect(seen[0]!.headers.Authorization).toBeUndefined();
  });

  it('logs in and reads the token, the user id and the email', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: { token: 'T1', record: { id: 'u1', email: 'a@b.es' } } }]);
    expect(await httpAccountApi(BASE, fetchFn).logIn('a@b.es', 'secret123')).toEqual({ ok: true, value: { token: 'T1', userId: 'u1', email: 'a@b.es' } });
    expect(seen[0]).toMatchObject({ url: `${BASE}/api/collections/users/auth-with-password`, method: 'POST', body: { identity: 'a@b.es', password: 'secret123' } });
  });

  it('wrong credentials (PocketBase answers 400) read as unauthorized', async () => {
    const { fetchFn } = fakeFetch([{ status: 400, body: { message: 'Failed to authenticate.' } }]);
    expect(await httpAccountApi(BASE, fetchFn).logIn('a@b.es', 'nope')).toEqual({ ok: false, error: { kind: 'unauthorized' } });
  });

  it('sends the token as is (no Bearer) when refreshing', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: { token: 'T2', record: { id: 'u1', email: 'a@b.es' } } }]);
    expect(await httpAccountApi(BASE, fetchFn).refresh('T1')).toEqual({ ok: true, value: { token: 'T2', userId: 'u1', email: 'a@b.es' } });
    expect(seen[0]).toMatchObject({ url: `${BASE}/api/collections/users/auth-refresh`, method: 'POST' });
    expect(seen[0]!.headers.Authorization).toBe('T1');
  });

  it('gets the save by user filter; none is null', async () => {
    const { seen, fetchFn } = fakeFetch([
      { status: 200, body: { items: [{ id: 's1', rev: 3, data: { version: 3, coins: 5 } }] } },
      { status: 200, body: { items: [] } },
    ]);
    const api = httpAccountApi(BASE, fetchFn);
    expect(await api.getSave('T', 'u1')).toEqual({ ok: true, value: { id: 's1', rev: 3, data: { version: 3, coins: 5 } } });
    expect(await api.getSave('T', 'u1')).toEqual({ ok: true, value: null });
    const url = new URL(seen[0]!.url);
    expect(url.pathname).toBe('/api/collections/saves/records');
    expect(url.searchParams.get('filter')).toBe("(user='u1')");
  });

  it('refuses to build a filter from a malformed user id', async () => {
    const { seen, fetchFn } = fakeFetch([]);
    expect(await httpAccountApi(BASE, fetchFn).getSave('T', "x' || 1=1")).toEqual({ ok: false, error: { kind: 'rejected' } });
    expect(seen).toEqual([]);
  });

  it('creates the first save at rev 0 and updates with the known rev', async () => {
    const { seen, fetchFn } = fakeFetch([
      { status: 200, body: { id: 's1', rev: 1, data: EMPTY_SAVE } },
      { status: 200, body: { id: 's1', rev: 2, data: EMPTY_SAVE } },
    ]);
    const api = httpAccountApi(BASE, fetchFn);
    expect(await api.createSave('T', 'u1', EMPTY_SAVE)).toEqual({ ok: true, value: { id: 's1', rev: 1, data: EMPTY_SAVE } });
    expect(await api.updateSave('T', 's1', EMPTY_SAVE, 1)).toMatchObject({ ok: true, value: { rev: 2 } });
    expect(seen[0]).toMatchObject({ method: 'POST', url: `${BASE}/api/collections/saves/records`, body: { user: 'u1', data: EMPTY_SAVE, version: EMPTY_SAVE.version, rev: 0 } });
    expect(seen[1]).toMatchObject({ method: 'PATCH', url: `${BASE}/api/collections/saves/records/s1`, body: { data: EMPTY_SAVE, version: EMPTY_SAVE.version, rev: 1 } });
  });

  it('a 409 carries the stored save', async () => {
    const current = { id: 's1', rev: 4, data: { version: 3, coins: 9 } };
    const { fetchFn } = fakeFetch([{ status: 409, body: { status: 409, message: '...', data: { current } } }]);
    expect(await httpAccountApi(BASE, fetchFn).updateSave('T', 's1', EMPTY_SAVE, 2)).toEqual({ ok: false, error: { kind: 'conflict', current } });
  });

  it('deletes the account', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 204 }]);
    expect(await httpAccountApi(BASE, fetchFn).deleteAccount('T', 'u1')).toEqual({ ok: true, value: undefined });
    expect(seen[0]).toMatchObject({ method: 'DELETE', url: `${BASE}/api/collections/users/records/u1` });
  });

  it('maps failures: network, 401, 429, 5xx', async () => {
    expect(await httpAccountApi(BASE, fakeFetch(new TypeError('Failed to fetch')).fetchFn).refresh('T')).toEqual({ ok: false, error: { kind: 'offline' } });
    const { fetchFn } = fakeFetch([{ status: 401 }, { status: 429 }, { status: 503 }, { status: 400 }]);
    const api = httpAccountApi(BASE, fetchFn);
    expect(await api.refresh('T')).toEqual({ ok: false, error: { kind: 'unauthorized' } });
    expect(await api.signUp('a@b.es', 'x')).toEqual({ ok: false, error: { kind: 'rate-limited' } });
    expect(await api.getSave('T', 'u1')).toEqual({ ok: false, error: { kind: 'server' } });
    expect(await api.signUp('a@b.es', 'x')).toEqual({ ok: false, error: { kind: 'rejected' } });
  });

  it('a 2xx with a malformed body reads as a server failure', async () => {
    const { fetchFn } = fakeFetch([{ status: 200, body: { nope: true } }]);
    expect(await httpAccountApi(BASE, fetchFn).logIn('a@b.es', 'secret123')).toEqual({ ok: false, error: { kind: 'server' } });
  });
});

describe('Sima global ranking', () => {
  const row = { rank: 1, nickname: 'Ana', avatarSpecies: 'zorua', floor: 9, clockMs: 500, species: 'zorua', level: 14, mode: 'daily', date: '2026-10-25' };

  it('asks for a tier without a token and reads its rows', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: { tier: 'hard', entries: [row] } }]);
    expect(await httpAccountApi(BASE, fetchFn).ranking('hard')).toEqual({ ok: true, value: { tier: 'hard', entries: [row] } });
    expect(seen[0]).toMatchObject({ url: `${BASE}/api/sd/ranking/sima?tier=hard`, method: 'GET' });
    expect(seen[0]!.headers.Authorization).toBeUndefined();
  });

  it('drops malformed rows and keeps only the public fields', async () => {
    const { fetchFn } = fakeFetch([
      {
        status: 200,
        body: { tier: 'easy', entries: [{ ...row, email: 'a@b.es', extra: 1 }, { ...row, floor: '9' }, { ...row, mode: 'ranked' }, { ...row, nickname: 7 }, 'nope', { ...row, avatarSpecies: undefined, rank: 2 }] },
      },
    ]);
    const result = await httpAccountApi(BASE, fetchFn).ranking('easy');
    expect(result).toEqual({ ok: true, value: { tier: 'easy', entries: [row, { ...row, avatarSpecies: '', rank: 2 }] } });
  });

  it('an unknown tier never leaves the client; failures read like the other calls', async () => {
    const { seen, fetchFn } = fakeFetch([{ status: 200, body: { nope: true } }, { status: 503 }]);
    const api = httpAccountApi(BASE, fetchFn);
    expect(await api.ranking('legend' as never)).toEqual({ ok: false, error: { kind: 'rejected' } });
    expect(seen).toHaveLength(0);
    expect(await api.ranking('easy')).toEqual({ ok: false, error: { kind: 'server' } });
    expect(await api.ranking('easy')).toEqual({ ok: false, error: { kind: 'server' } });
    expect(await httpAccountApi(BASE, fakeFetch(new TypeError('Failed to fetch')).fetchFn).ranking('easy')).toEqual({ ok: false, error: { kind: 'offline' } });
  });
});
