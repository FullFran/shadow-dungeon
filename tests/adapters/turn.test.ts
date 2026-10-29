import { describe, expect, it } from 'vitest';
import { fetchIceServers, parseIceServers } from '../../src/adapters/turn';

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
