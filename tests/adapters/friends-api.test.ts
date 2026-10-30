import { describe, expect, it } from 'vitest';
import { FRIEND_CODE_LENGTH, httpFriendsApi, normalizeFriendCode } from '../../src/adapters/friends-api';

const ID = 'abcdefghij12345';
const respond = (status: number, body: unknown = {}) => new Response(status === 204 ? null : JSON.stringify(body), { status });

function client(status: number, body: unknown = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const api = httpFriendsApi('https://api.example', (url, init = {}) => {
    calls.push({ url, init });
    return Promise.resolve(respond(status, body));
  });
  return { api, calls };
}

describe('friend codes as typed', () => {
  it('normalizes case, spaces and dashes', () => {
    expect(normalizeFriendCode(' acde-fhjk ')).toBe('ACDEFHJK');
  });
  it('refuses another length and lookalike characters', () => {
    expect(normalizeFriendCode('ACDE')).toBeNull();
    expect(normalizeFriendCode('ACDEFHJKM')).toBeNull();
    expect(normalizeFriendCode('ACDEFHJ0')).toBeNull();
    expect(FRIEND_CODE_LENGTH).toBe(8);
  });
});

describe('what goes over the wire', () => {
  it('sends the token only in the header, to the API base, without cookies', async () => {
    const { api, calls } = client(200, { status: 'pending' });
    await api.send('tok', 'ACDEFHJK');
    expect(calls[0]!.url).toBe('https://api.example/api/sd/friends/requests');
    expect(calls[0]!.init.method).toBe('POST');
    expect(calls[0]!.init.credentials).toBe('omit');
    expect(calls[0]!.init.cache).toBe('no-store');
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe('tok');
    expect(calls[0]!.init.body).toBe('{"code":"ACDEFHJK"}');
  });
  it('an id that is not one never reaches a path', async () => {
    const { api, calls } = client(200, { status: 'friends' });
    expect(await api.accept('tok', '../../admin')).toEqual({ ok: false, error: 'refused' });
    expect(await api.remove('tok', 'a/b')).toEqual({ ok: false, error: 'refused' });
    expect(calls).toHaveLength(0);
  });
  it('accepts and removes by id', async () => {
    const accept = client(200, { status: 'friends' });
    expect(await accept.api.accept('tok', ID)).toEqual({ ok: true, value: 'friends' });
    expect(accept.calls[0]!.url).toBe(`https://api.example/api/sd/friends/requests/${ID}/accept`);
    const remove = client(204);
    expect(await remove.api.remove('tok', ID)).toEqual({ ok: true, value: true });
    expect(remove.calls[0]!.init.method).toBe('DELETE');
  });
  it('a heartbeat carries the room or null, and nothing malformed', async () => {
    const { api, calls } = client(204);
    expect(await api.presence('tok', 'K7M3A')).toEqual({ ok: true, value: true });
    expect(calls[0]!.init.body).toBe('{"room":"K7M3A"}');
    await api.presence('tok', null);
    expect(calls[1]!.init.body).toBe('{"room":null}');
    expect(await api.presence('tok', 'nope')).toEqual({ ok: false, error: 'unavailable' });
    expect(calls).toHaveLength(2);
  });
});

describe('how the answers read', () => {
  const body = {
    code: 'ACDEFHJK',
    friends: [
      { id: ID, nickname: ' Ana​ ', state: 'room', room: 'K7M3A' },
      { id: ID, nickname: '', state: 'online' },
      { id: ID, nickname: 'Cris', state: 'offline' },
    ],
    incoming: [{ id: ID, nickname: '<b>Dani</b>' }],
    outgoing: [{ id: ID, code: 'MNPRTUWX' }],
  };
  it('reads an overview and sanitises the nicknames, keeping markup as plain text', async () => {
    const result = await client(200, body).api.overview('tok');
    expect(result).toEqual({
      ok: true,
      value: {
        code: 'ACDEFHJK',
        friends: [
          { id: ID, nickname: 'Ana', state: 'room', room: 'K7M3A' },
          { id: ID, nickname: '', state: 'online', room: null },
          { id: ID, nickname: 'Cris', state: 'offline', room: null },
        ],
        incoming: [{ id: ID, nickname: '<b>Dani</b>' }],
        outgoing: [{ id: ID, code: 'MNPRTUWX' }],
      },
    });
  });
  it('a room code the server should not have sent is no room', async () => {
    for (const room of ['K7M2Q', 'nope', 12, null, undefined, '../x']) {
      const result = await client(200, { ...body, friends: [{ id: ID, nickname: 'Ana', state: 'room', room }] }).api.overview('tok');
      expect(result.ok && result.value.friends[0], String(room)).toEqual({ id: ID, nickname: 'Ana', state: 'online', room: null });
    }
  });
  it('a room with no room state shows no room', async () => {
    const result = await client(200, { ...body, friends: [{ id: ID, nickname: 'Ana', state: 'online', room: 'K7M3A' }] }).api.overview('tok');
    expect(result.ok && result.value.friends[0]!.room).toBeNull();
  });
  it('drops rows it cannot read', async () => {
    const result = await client(200, { ...body, friends: [{ id: '../x', state: 'online' }, { id: ID, state: 'dancing' }, 'x'], incoming: [{ id: 5 }], outgoing: [{ id: ID, code: 'bad' }] }).api.overview('tok');
    expect(result.ok && [result.value.friends, result.value.incoming, result.value.outgoing]).toEqual([[], [], []]);
  });
  it('fails closed on a body it cannot read', async () => {
    for (const bad of [null, [], 'x', { code: 'nope', friends: [], incoming: [], outgoing: [] }, { code: 'ACDEFHJK', friends: 'x', incoming: [], outgoing: [] }, { code: 'ACDEFHJK' }]) {
      expect(await client(200, bad).api.overview('tok'), JSON.stringify(bad)).toEqual({ ok: false, error: 'unavailable' });
    }
    expect(await client(200, { status: 'dancing' }).api.send('tok', 'ACDEFHJK')).toEqual({ ok: false, error: 'unavailable' });
  });
  it('names each refusal', async () => {
    const cases: [number, unknown, string][] = [
      [401, {}, 'denied'],
      [403, {}, 'denied'],
      [404, { error: 'refused' }, 'refused'],
      [400, { error: 'self' }, 'self'],
      [400, { error: 'other' }, 'unavailable'],
      [409, { error: 'limit' }, 'limit'],
      [429, {}, 'rate-limited'],
      [500, {}, 'unavailable'],
    ];
    for (const [status, answer, error] of cases) expect(await client(status, answer).api.send('tok', 'ACDEFHJK'), String(status)).toEqual({ ok: false, error });
  });
  it('a missing network is one more answer', async () => {
    const api = httpFriendsApi('https://api.example', () => Promise.reject(new Error('offline')));
    expect(await api.overview('tok')).toEqual({ ok: false, error: 'unavailable' });
  });
});
