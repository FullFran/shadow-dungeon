import { describe, expect, it } from 'vitest';
import { httpAdminApi } from '../../src/adapters/admin-api';

const raw = { ref: 'SD-AAAAAA', created: '2026-10-30 10:00:00.000Z', category: 'bug', status: 'new', description: 'broke', steps: '', expected: '', observed: '', version: 'v1', device: 'x', diagnostics: null, githubIssue: '' };
const reply = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('asking who is an admin', () => {
  it('is yes only when the server says so', async () => {
    expect(await httpAdminApi('', reply(200, { admin: true })).isAdmin('t')).toBe(true);
    expect(await httpAdminApi('', reply(200, { admin: false })).isAdmin('t')).toBe(false);
    expect(await httpAdminApi('', reply(200, {})).isAdmin('t')).toBe(false);
    expect(await httpAdminApi('', reply(403, {})).isAdmin('t')).toBe(false);
    expect(await httpAdminApi('', reply(500, {})).isAdmin('t')).toBe(false);
  });
  it('is no when the network fails', async () => {
    const offline = async () => {
      throw new Error('offline');
    };
    expect(await httpAdminApi('', offline).isAdmin('t')).toBe(false);
  });
});

describe('the inbox calls', () => {
  it('sends the token to the base only, without cookies', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = httpAdminApi('https://api.test', async (url, init) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ items: [raw], total: 1 }), { status: 200 });
    });
    await api.list('secret');
    expect(calls[0]![0]).toBe('https://api.test/api/sd/admin/reports');
    expect(calls[0]![1]!.headers).toEqual({ Authorization: 'secret' });
    expect(calls[0]![1]!.credentials).toBe('omit');
  });
  it('reads the tickets, dropping any it cannot read', async () => {
    const result = await httpAdminApi('', reply(200, { items: [raw, { ref: 'SD-BBBBBB', status: 'odd' }, 7], total: 3 })).list('t');
    expect(result).toEqual({ ok: true, value: { tickets: [raw], total: 3 } });
  });
  it('tells a refusal from a failure', async () => {
    expect(await httpAdminApi('', reply(401, {})).list('t')).toEqual({ ok: false, error: 'denied' });
    expect(await httpAdminApi('', reply(403, {})).list('t')).toEqual({ ok: false, error: 'denied' });
    expect(await httpAdminApi('', reply(500, {})).list('t')).toEqual({ ok: false, error: 'unavailable' });
    expect(await httpAdminApi('', reply(200, { nope: 1 })).list('t')).toEqual({ ok: false, error: 'unavailable' });
  });
  it('patches only the status of a well-formed reference', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const api = httpAdminApi('', async (url, init) => {
      calls.push([url, init]);
      return new Response(JSON.stringify({ ...raw, status: 'closed' }), { status: 200 });
    });
    expect(await api.setStatus('t', 'SD-AAAAAA', 'closed')).toEqual({ ok: true, value: { ...raw, status: 'closed' } });
    expect(calls[0]![0]).toBe('/api/sd/admin/reports/SD-AAAAAA');
    expect(calls[0]![1]!.method).toBe('PATCH');
    expect(calls[0]![1]!.body).toBe('{"status":"closed"}');
    expect(await api.setStatus('t', '../users', 'closed')).toEqual({ ok: false, error: 'unavailable' });
    expect(calls).toHaveLength(1);
  });
});
