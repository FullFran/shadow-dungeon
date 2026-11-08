import { afterEach, describe, expect, it } from 'vitest';
import { request, DEFAULT_BACKOFF_MS } from '../../src/adapters/http';
import { reportError, subscribeErrors, subscribeReached } from '../../src/adapters/net-error';

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });

function script(...steps: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const step = steps[Math.min(calls.length - 1, steps.length - 1)]!;
    return step instanceof Error ? Promise.reject(step) : Promise.resolve(step);
  };
  return { fetchFn, calls };
}

const sleeps: number[] = [];
const sleep = (ms: number) => {
  sleeps.push(ms);
  return Promise.resolve();
};
afterEach(() => {
  sleeps.length = 0;
});

describe('request', () => {
  it('tells the listeners the server answered, refusals included, but not a call that never got a response', async () => {
    const seen: string[] = [];
    const off = subscribeReached((scope) => seen.push(scope));
    await request(script(json(200)).fetchFn, '/a', {}, { scope: 'ranking', sleep });
    await request(script(json(404)).fetchFn, '/b', {}, { scope: 'friends', sleep });
    await request(script(new TypeError('Failed to fetch')).fetchFn, '/c', {}, { scope: 'presence', sleep, backoffMs: [] });
    off();
    expect(seen).toEqual(['ranking', 'friends']);
  });

  it('answers the response of a good call', async () => {
    const { fetchFn } = script(json(200, { a: 1 }));
    const result = await request(fetchFn, 'https://x/y', { method: 'GET' }, { sleep });
    expect(result.ok).toBe(true);
  });

  it('retries a GET with growing backoff until it works', async () => {
    const { fetchFn, calls } = script(new TypeError('Failed to fetch'), json(503), json(200));
    const result = await request(fetchFn, 'https://x/y', { method: 'GET' }, { sleep });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(sleeps).toEqual([...DEFAULT_BACKOFF_MS]);
    expect(DEFAULT_BACKOFF_MS[1]).toBeGreaterThan(DEFAULT_BACKOFF_MS[0]!);
  });

  it('gives up after the backoff list and reports the last kind', async () => {
    const { fetchFn, calls } = script(json(503));
    const result = await request(fetchFn, 'https://x/y', { method: 'GET' }, { sleep });
    expect(calls).toHaveLength(DEFAULT_BACKOFF_MS.length + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('server');
      expect(result.response?.status).toBe(503);
    }
  });

  it('never retries a POST, a PATCH or a DELETE', async () => {
    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const { fetchFn, calls } = script(new TypeError('Failed to fetch'));
      const result = await request(fetchFn, 'https://x/y', { method }, { sleep });
      expect(calls, method).toHaveLength(1);
      expect(result.ok).toBe(false);
    }
    expect(sleeps).toEqual([]);
  });

  it('does not retry what a retry cannot fix (auth, rate limits, refusals)', async () => {
    for (const status of [401, 403, 429, 400, 404]) {
      const { fetchFn, calls } = script(json(status));
      await request(fetchFn, 'https://x/y', { method: 'GET' }, { sleep });
      expect(calls, String(status)).toHaveLength(1);
    }
  });

  it('classifies a timeout and gives every attempt its own timeout signal', async () => {
    const { fetchFn, calls } = script(new DOMException('t', 'TimeoutError'));
    const result = await request(fetchFn, 'https://x/y', { method: 'GET' }, { sleep, timeoutMs: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('timeout');
    const signals = calls.map((c) => c.init?.signal);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
    expect(new Set(signals).size).toBe(signals.length);
  });

  it('reports a failure once with its scope, but not a plain refusal', async () => {
    const seen: string[] = [];
    const off = subscribeErrors((e, scope) => seen.push(`${scope}:${e.kind}`));
    await request(script(json(503)).fetchFn, 'https://x/y', { method: 'GET' }, { sleep, scope: 'ranking' });
    await request(script(json(400)).fetchFn, 'https://x/y', { method: 'POST' }, { sleep, scope: 'friends' });
    await request(script(new TypeError('x')).fetchFn, 'https://x/y', { method: 'POST' }, { sleep, scope: 'report' });
    off();
    expect(seen).toEqual(['ranking:server', 'report:offline']);
    reportError({ kind: 'server', retryable: true }, 'noop');
  });

  it('reads the browser being offline as offline, whatever fetch threw', async () => {
    const result = await request(script(new Error('?')).fetchFn, 'https://x/y', { method: 'POST' }, { sleep, online: () => false });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe('offline');
  });
});
