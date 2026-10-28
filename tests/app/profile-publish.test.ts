import { describe, expect, it } from 'vitest';
import type { AccountApi, ApiResult, PublicProfile } from '../../src/adapters/account-api';
import { profilePublisher } from '../../src/app/profile-publish';

const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** An in-memory `profiles` collection with the server's rules (one per user, owner only). */
function fakeProfiles(options: { down?: boolean } = {}) {
  const rows = new Map<string, PublicProfile & { user: string }>();
  const calls: string[] = [];
  let n = 0;
  const offline = <T>(): ApiResult<T> => ({ ok: false, error: { kind: 'offline' } });
  const api: Pick<AccountApi, 'getProfile' | 'createProfile' | 'updateProfile'> = {
    async getProfile(token, userId) {
      calls.push('get');
      if (options.down) return offline();
      if (token !== `tok-${userId}`) return { ok: false, error: { kind: 'unauthorized' } };
      const found = [...rows.values()].find((r) => r.user === userId);
      return { ok: true, value: found ? { id: found.id, nickname: found.nickname, avatarSpecies: found.avatarSpecies } : null };
    },
    async createProfile(token, userId, fields) {
      calls.push(`create:${fields.nickname}:${fields.avatarSpecies}`);
      if (options.down) return offline();
      if (token !== `tok-${userId}` || [...rows.values()].some((r) => r.user === userId)) return { ok: false, error: { kind: 'rejected' } };
      const id = `p${++n}`;
      rows.set(id, { id, user: userId, ...fields });
      return { ok: true, value: { id, ...fields } };
    },
    async updateProfile(token, profileId, fields) {
      calls.push(`update:${fields.nickname}:${fields.avatarSpecies}`);
      if (options.down) return offline();
      const row = rows.get(profileId);
      if (!row || token !== `tok-${row.user}`) return { ok: false, error: { kind: 'unauthorized' } };
      Object.assign(row, fields);
      return { ok: true, value: { id: row.id, ...fields } };
    },
  };
  return { api, calls, rows };
}

const session = (userId: string) => ({ token: `tok-${userId}`, userId });

describe('public profile publisher', () => {
  it('creates the profile once, then does nothing while nothing changed', async () => {
    const backend = fakeProfiles();
    let nickname = 'Ana';
    const publisher = profilePublisher({ api: backend.api, nickname: () => nickname, species: () => 'zorua' });
    publisher.synced(session('u1'));
    await settle();
    expect(backend.calls).toEqual(['get', 'create:Ana:zorua']);
    publisher.synced(session('u1'));
    publisher.changed();
    await settle();
    expect(backend.calls).toHaveLength(2);
    nickname = 'Bea';
    publisher.changed();
    await settle();
    expect(backend.calls.slice(2)).toEqual(['update:Bea:zorua']);
    expect([...backend.rows.values()]).toEqual([{ id: 'p1', user: 'u1', nickname: 'Bea', avatarSpecies: 'zorua' }]);
  });

  it('updates a profile that already exists on the server instead of creating one', async () => {
    const backend = fakeProfiles();
    backend.rows.set('p9', { id: 'p9', user: 'u1', nickname: 'Old', avatarSpecies: 'gastly' });
    const publisher = profilePublisher({ api: backend.api, nickname: () => 'Ana', species: () => 'zorua' });
    publisher.synced(session('u1'));
    await settle();
    expect(backend.calls).toEqual(['get', 'update:Ana:zorua']);
    // Already as wanted on the server: no write.
    const again = profilePublisher({ api: backend.api, nickname: () => 'Ana', species: () => 'zorua' });
    again.synced(session('u1'));
    await settle();
    expect(backend.calls.slice(2)).toEqual(['get']);
  });

  it('writes nothing without a valid nickname or a session', async () => {
    const backend = fakeProfiles();
    let nickname = '';
    const publisher = profilePublisher({ api: backend.api, nickname: () => nickname, species: () => 'zorua' });
    publisher.changed();
    publisher.synced(session('u1'));
    nickname = ' padded ';
    publisher.changed();
    await settle();
    expect(backend.calls).toEqual([]);
    publisher.synced(null);
    nickname = 'Ana';
    publisher.changed();
    await settle();
    expect(backend.calls).toEqual([]);
  });

  it('sends no avatar for a species the server would refuse', async () => {
    const backend = fakeProfiles();
    const publisher = profilePublisher({ api: backend.api, nickname: () => 'Ana', species: () => 'Not A Species!' });
    publisher.synced(session('u1'));
    await settle();
    expect(backend.calls).toEqual(['get', 'create:Ana:']);
  });

  it('a failure never throws and is retried on the next sync', async () => {
    const down = fakeProfiles({ down: true });
    const publisher = profilePublisher({ api: down.api, nickname: () => 'Ana', species: () => 'zorua' });
    publisher.synced(session('u1'));
    await settle();
    publisher.synced(session('u1'));
    await settle();
    expect(down.calls).toEqual(['get', 'get']);
    const throwing = profilePublisher({
      api: {
        getProfile: () => {
          throw new Error('boom');
        },
        createProfile: () => Promise.reject(new Error('boom')),
        updateProfile: () => Promise.reject(new Error('boom')),
      },
      nickname: () => 'Ana',
      species: () => 'zorua',
    });
    expect(() => throwing.synced(session('u1'))).not.toThrow();
    await settle();
  });

  it('another account on this browser gets its own profile', async () => {
    const backend = fakeProfiles();
    const publisher = profilePublisher({ api: backend.api, nickname: () => 'Ana', species: () => 'zorua' });
    publisher.synced(session('u1'));
    await settle();
    publisher.synced(session('u2'));
    await settle();
    expect([...backend.rows.values()].map((r) => r.user)).toEqual(['u1', 'u2']);
  });
});
