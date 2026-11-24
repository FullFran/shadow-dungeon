import { describe, expect, it } from 'vitest';
import { createIceCache, fetchIceServers, ICE_CACHE_MS, parseIceServers } from '../../src/adapters/turn';

const answer = {
  iceServers: [
    { urls: ['stun:stun.cloudflare.com:3478'] },
    { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'u1', credential: 'c1' },
  ],
};

const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });

describe('TURN relay servers', () => {
  it('keeps the ICE entries of the answer, with their credentials', () => {
    expect(parseIceServers(answer)).toEqual(answer.iceServers);
  });

  it('drops malformed entries and URLs, and reads a single URL string', () => {
    const body = { iceServers: [{ urls: 'turn:t.example:3478', username: 'u', credential: 'c' }, { urls: ['http://evil', 42] }, null, 'x', { urls: [] }] };
    expect(parseIceServers(body)).toEqual([{ urls: ['turn:t.example:3478'], username: 'u', credential: 'c' }]);
    expect(parseIceServers(null)).toEqual([]);
    expect(parseIceServers({ iceServers: {} })).toEqual([]);
  });

  it('asks the API route and returns its servers', async () => {
    let asked = '';
    const servers = await fetchIceServers('https://api.example', async (url) => {
      asked = url;
      return respond(200, answer)();
    });
    expect(asked).toBe('https://api.example/api/sd/turn');
    expect(servers).toEqual(answer.iceServers);
  });

  it('goes on without a relay when the API fails, answers garbage or is too slow', async () => {
    expect(await fetchIceServers('https://api.example', respond(500, answer))).toEqual([]);
    expect(await fetchIceServers('https://api.example', async () => new Response('not json', { status: 200 }))).toEqual([]);
    expect(await fetchIceServers('https://api.example', async () => Promise.reject(new TypeError('offline')))).toEqual([]);
    const hang = (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    expect(await fetchIceServers('https://api.example', hang, 20)).toEqual([]);
  });
});

describe('TURN credentials fetched ahead (issue #51: joining is sometimes slow)', () => {
  const servers = parseIceServers(answer);
  const counting = (result: () => Promise<ReturnType<typeof parseIceServers>>) => {
    const fetcher = Object.assign(() => (fetcher.calls++, result()), { calls: 0 });
    return fetcher;
  };

  it('a fetch started while the online screen is open is the one the room uses', async () => {
    const fetcher = counting(async () => servers);
    const cache = createIceCache(fetcher, () => 0);
    cache.prefetch();
    cache.prefetch();
    expect(fetcher.calls).toBe(1);
    expect(await cache.get()).toEqual(servers);
    expect(fetcher.calls).toBe(1);
  });

  it('without a prefetch the room fetches them itself', async () => {
    const fetcher = counting(async () => servers);
    const cache = createIceCache(fetcher, () => 0);
    expect(await cache.get()).toEqual(servers);
    expect(fetcher.calls).toBe(1);
  });

  it('no relay from a failed fetch is kept: the next room asks again', async () => {
    const answers = [[] as typeof servers, servers];
    const fetcher = counting(async () => answers.shift()!);
    const cache = createIceCache(fetcher, () => 0);
    cache.prefetch();
    expect(await cache.get()).toEqual([]);
    expect(await cache.get()).toEqual(servers);
    expect(fetcher.calls).toBe(2);
  });

  it('credentials older than the cache window are fetched again (they expire on the server)', async () => {
    let now = 0;
    const fetcher = counting(async () => servers);
    const cache = createIceCache(fetcher, () => now);
    await cache.get();
    now = ICE_CACHE_MS - 1;
    await cache.get();
    expect(fetcher.calls).toBe(1);
    now = ICE_CACHE_MS;
    await cache.get();
    expect(fetcher.calls).toBe(2);
  });
});
