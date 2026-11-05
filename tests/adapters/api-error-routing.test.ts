import { afterEach, describe, expect, it } from 'vitest';
import { accountErrorKind, httpAccountApi } from '../../src/adapters/account-api';
import { adminErrorKind, httpAdminApi } from '../../src/adapters/admin-api';
import { friendsErrorKind, httpFriendsApi } from '../../src/adapters/friends-api';
import { reportErrorKind, sendReport, type ReportPayload } from '../../src/adapters/report-api';
import { subscribeErrors, type ErrorKind } from '../../src/adapters/net-error';
import { setBackoffForTests } from '../../src/adapters/http';

/**
 * Parity: every API adapter sends its network calls through the shared request
 * (adapters/http.ts), so an offline, a timeout, a 5xx and an expired session
 * reach the error model with the adapter's scope, and each adapter can say
 * which kind its own failure result means.
 */
const REPORT: ReportPayload = { category: 'bug', description: 'x', steps: '', expected: '', observed: '', version: '1', device: '' };
const TOKEN = 'tok';
const ID = 'abcdefghij12345';

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
interface Probe {
  /** A call that goes over the wire; resolves to the adapter's own failure result mapped to a kind (null when it succeeded). */
  call: (fetchFn: Fetch) => Promise<ErrorKind | null>;
  method: 'GET' | 'POST';
}

const kindIfFailed = <E>(result: { ok: boolean; error?: E }, map: (e: E) => ErrorKind): ErrorKind | null => (result.ok ? null : map(result.error as E));

const ADAPTERS: Record<string, Probe[]> = {
  account: [
    { method: 'GET', call: async (f) => kindIfFailed(await httpAccountApi('https://api', f).ranking('easy'), accountErrorKind) },
    { method: 'POST', call: async (f) => kindIfFailed(await httpAccountApi('https://api', f).logIn('a@b.c', 'pw'), accountErrorKind) },
  ],
  friends: [
    { method: 'GET', call: async (f) => kindIfFailed(await httpFriendsApi('https://api', f).overview(TOKEN), friendsErrorKind) },
    { method: 'POST', call: async (f) => kindIfFailed(await httpFriendsApi('https://api', f).send(TOKEN, 'ACDEFHJK'), friendsErrorKind) },
  ],
  admin: [
    { method: 'GET', call: async (f) => kindIfFailed(await httpAdminApi('https://api', f).list(TOKEN), adminErrorKind) },
    { method: 'POST', call: async (f) => kindIfFailed(await httpAdminApi('https://api', f).setStatus(TOKEN, 'SD-ABC123', 'closed'), adminErrorKind) },
  ],
  report: [{ method: 'POST', call: async (f) => { const r = await sendReport('https://api', REPORT, f); return r.kind === 'ok' ? null : reportErrorKind(r); } }],
};

function run(fetchBehaviour: () => Promise<Response>) {
  let count = 0;
  const f: Fetch = () => {
    count += 1;
    return fetchBehaviour();
  };
  return { f, count: () => count };
}

let off: () => void = () => undefined;
afterEach(() => off());
setBackoffForTests([0, 0]);

const CASES: [string, () => Promise<Response>, ErrorKind][] = [
  ['the network gone', () => Promise.reject(new TypeError('Failed to fetch')), 'offline'],
  ['a timeout', () => Promise.reject(new DOMException('t', 'TimeoutError')), 'timeout'],
  ['a 503', () => Promise.resolve(new Response('{}', { status: 503 })), 'server'],
  ['an expired session', () => Promise.resolve(new Response('{}', { status: 401 })), 'auth'],
];

describe('every adapter routes failures through the error model', () => {
  for (const [name, probes] of Object.entries(ADAPTERS)) {
    for (const [what, behaviour, kind] of CASES) {
      it(`${name}: ${what} reports "${kind}" with its scope`, async () => {
        for (const probe of probes) {
          const seen: string[] = [];
          off = subscribeErrors((e, scope) => seen.push(`${scope}:${e.kind}`));
          const { f } = run(behaviour);
          const mapped = await probe.call(f);
          off();
          expect(seen, `${name} ${probe.method}`).toEqual([`${name}:${kind}`]);
          expect(mapped, `${name} ${probe.method} result`).not.toBeNull();
        }
      });
    }

    it(`${name}: retries only its GETs`, async () => {
      for (const probe of probes) {
        const { f, count } = run(() => Promise.reject(new TypeError('Failed to fetch')));
        await probe.call(f);
        expect(count(), `${name} ${probe.method}`).toBe(probe.method === 'GET' ? 3 : 1);
      }
    });
  }

  it('maps each adapter failure to the shared kinds', () => {
    expect(accountErrorKind({ kind: 'unauthorized' })).toBe('auth');
    expect(accountErrorKind({ kind: 'rate-limited' })).toBe('rate-limited');
    expect(accountErrorKind({ kind: 'server' })).toBe('server');
    expect(accountErrorKind({ kind: 'offline' })).toBe('offline');
    expect(accountErrorKind({ kind: 'rejected' })).toBe('unexpected');
    expect(friendsErrorKind('denied')).toBe('auth');
    expect(friendsErrorKind('unavailable')).toBe('server');
    expect(friendsErrorKind('rate-limited')).toBe('rate-limited');
    expect(adminErrorKind('denied')).toBe('auth');
    expect(adminErrorKind('unavailable')).toBe('server');
    expect(reportErrorKind({ kind: 'unavailable' })).toBe('server');
    expect(reportErrorKind({ kind: 'rate-limited' })).toBe('rate-limited');
  });
});
