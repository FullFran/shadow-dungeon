import { describe, expect, it } from 'vitest';
import type { AccountApi, ApiError, ApiResult, AuthSession, RemoteSave } from '../../src/adapters/account-api';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { ACCOUNT_ERRORS, ACCOUNT_KEY, createAccount, NOTICES, type Notice } from '../../src/app/account';
import { catalog, LANGUAGES } from '../../src/i18n';
import { DEBOUNCE_MS, observeKey, type Timers } from '../../src/app/cloud-sync';
import { EMPTY_SAVE, loadSave, SAVE_KEY, writeSave, type SaveData } from '../../src/app/save';

const save = (coins: number, patch: Partial<SaveData> = {}): SaveData => ({ ...EMPTY_SAVE, coins, ...patch });
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** An in-memory backend with the server's rules (users, one save per user, rev). */
function fakeBackend() {
  const users = new Map<string, { id: string; email: string; password: string }>();
  const saves = new Map<string, RemoteSave & { user: string }>();
  const tokens = new Map<string, string>();
  const calls: string[] = [];
  let down: ApiError['kind'] | null = null;
  let n = 0;
  const fail = <T>(kind: Exclude<ApiError['kind'], 'conflict'>): ApiResult<T> => ({ ok: false, error: { kind } as ApiError });
  const userOf = (token: string) => tokens.get(token);
  const issue = (userId: string): AuthSession => {
    const token = `tok${++n}`;
    tokens.set(token, userId);
    return { token, userId, email: [...users.values()].find((u) => u.id === userId)!.email };
  };
  const api: AccountApi = {
    async signUp(email, password) {
      calls.push('signUp');
      if (down) return fail(down as never);
      if ([...users.values()].some((u) => u.email === email) || password.length < 8) return fail('rejected');
      const id = `u${++n}`;
      users.set(id, { id, email, password });
      return { ok: true, value: undefined };
    },
    async logIn(email, password) {
      calls.push('logIn');
      if (down) return fail(down as never);
      const user = [...users.values()].find((u) => u.email === email && u.password === password);
      return user ? { ok: true, value: issue(user.id) } : fail('unauthorized');
    },
    async refresh(token) {
      calls.push('refresh');
      if (down) return fail(down as never);
      const id = userOf(token);
      if (!id) return fail('unauthorized');
      tokens.delete(token);
      return { ok: true, value: issue(id) };
    },
    async getSave(token, userId) {
      calls.push('getSave');
      if (down) return fail(down as never);
      if (userOf(token) !== userId) return fail('unauthorized');
      const found = [...saves.values()].find((s) => s.user === userId);
      return { ok: true, value: found ? { id: found.id, rev: found.rev, data: found.data } : null };
    },
    async createSave(token, userId, data) {
      calls.push('createSave');
      if (down) return fail(down as never);
      if (userOf(token) !== userId) return fail('unauthorized');
      const found = [...saves.values()].find((s) => s.user === userId);
      if (found) return { ok: false, error: { kind: 'conflict', current: { id: found.id, rev: found.rev, data: found.data } } };
      const record = { id: `s${++n}`, rev: 1, data, user: userId };
      saves.set(record.id, record);
      return { ok: true, value: { id: record.id, rev: 1, data } };
    },
    async updateSave(token, saveId, data, rev) {
      calls.push(`updateSave@${rev}`);
      if (down) return fail(down as never);
      const found = saves.get(saveId);
      if (!found || userOf(token) !== found.user) return fail('unauthorized');
      if (found.rev !== rev) return { ok: false, error: { kind: 'conflict', current: { id: found.id, rev: found.rev, data: found.data } } };
      found.rev += 1;
      found.data = data;
      return { ok: true, value: { id: found.id, rev: found.rev, data } };
    },
    async deleteAccount(token, userId) {
      calls.push('deleteAccount');
      if (down) return fail(down as never);
      if (userOf(token) !== userId) return fail('unauthorized');
      users.delete(userId);
      for (const [id, s] of saves) if (s.user === userId) saves.delete(id);
      return { ok: true, value: undefined };
    },
  };
  return {
    api,
    calls,
    setDown: (kind: ApiError['kind'] | null) => {
      down = kind;
    },
    addUser(email: string, password: string, cloud?: SaveData, rev = 1) {
      const id = `u${++n}`;
      users.set(id, { id, email, password });
      if (cloud) saves.set(`s${id}`, { id: `s${id}`, rev, data: cloud, user: id });
      return id;
    },
    cloudOf: (email: string) => {
      const user = [...users.values()].find((u) => u.email === email);
      const found = user && [...saves.values()].find((s) => s.user === user.id);
      return found ? { rev: found.rev, coins: (found.data as SaveData).coins } : null;
    },
    /** Another device writes the cloud save. */
    writeElsewhere(email: string, data: SaveData) {
      const user = [...users.values()].find((u) => u.email === email)!;
      const found = [...saves.values()].find((s) => s.user === user.id)!;
      found.rev += 1;
      found.data = data;
    },
    revoke: () => tokens.clear(),
    users,
  };
}

/** Timers run by hand: `runAll()` fires everything due, as if time passed. */
function manualTimers(): Timers & { runAll(): void } {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    set(fn) {
      queue.set(next, fn);
      return next++;
    },
    clear(id) {
      queue.delete(id as number);
    },
    runAll() {
      const due = [...queue.entries()];
      queue.clear();
      for (const [, fn] of due) fn();
    },
  };
}

/** One device: its storage, its game store (observed like main.ts does) and its account. */
function device(backend: ReturnType<typeof fakeBackend>, storage: KeyValueStore = memoryStore()) {
  const notices: Notice[] = [];
  const timers = manualTimers();
  const account = createAccount({ api: backend.api, store: storage, timers, onNotice: (n) => notices.push(n), onChange: () => {} });
  const game = observeKey(storage, SAVE_KEY, () => account.saveChanged());
  return { account, game, storage, notices, timers, local: () => loadSave(storage) };
}

describe('guest play', () => {
  it('a guest makes no request at start or when saving', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    await d.account.start();
    writeSave(d.game, save(50));
    d.timers.runAll();
    await settle();
    expect(backend.calls).toEqual([]);
    expect(d.account.state()).toEqual({ kind: 'guest' });
  });
});

describe('first login on a device', () => {
  it('registers, logs in and uploads the local save when the account has none', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    writeSave(d.game, save(120));
    expect(await d.account.register('ana@example.com', 'password1')).toEqual({ ok: true });
    await settle();
    expect(d.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 120 });
    expect(d.storage.get(ACCOUNT_KEY)).toContain('ana@example.com');
  });

  it('an empty device takes the cloud save', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', save(300));
    const d = device(backend);
    expect(await d.account.logIn('ana@example.com', 'password1')).toEqual({ ok: true });
    expect(d.local().coins).toBe(300);
    expect(d.notices).toEqual(['cloud-loaded']);
  });

  it('two different saves ask the player; "La nube" keeps the cloud one', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', save(300, { owned: ['kadabra'] }));
    const d = device(backend);
    writeSave(d.game, save(40));
    const outcome = await d.account.logIn('ana@example.com', 'password1');
    expect(outcome).toEqual({ ok: true, choose: { device: { coins: 40, owned: 0 }, cloud: { coins: 300, owned: 1 } } });
    // Nothing is pushed while the choice is open.
    d.timers.runAll();
    await settle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 300 });
    d.account.choose('cloud');
    await settle();
    expect(d.local().coins).toBe(300);
    expect(d.account.pendingChoice()).toBeNull();
  });

  it('"Este dispositivo" overwrites the cloud save with the local one', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', save(300), 5);
    const d = device(backend);
    writeSave(d.game, save(40));
    await d.account.logIn('ana@example.com', 'password1');
    d.account.choose('device');
    await settle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 6, coins: 40 });
    expect(d.local().coins).toBe(40);
  });

  it('wrong credentials leave the player a guest', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1');
    const d = device(backend);
    expect(await d.account.logIn('ana@example.com', 'wrong-one')).toEqual({ ok: false, error: 'unauthorized' });
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(d.storage.get(ACCOUNT_KEY) ?? '').toBe('');
  });

  it('a taken email or short password is refused at sign-up', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1');
    const d = device(backend);
    expect(await d.account.register('ana@example.com', 'password2')).toEqual({ ok: false, error: 'rejected' });
    expect(await d.account.register('bea@example.com', 'short')).toEqual({ ok: false, error: 'too-short' });
    expect(backend.calls.filter((c) => c === 'signUp')).toHaveLength(1);
  });

  it('offline login fails cleanly and play goes on', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1');
    backend.setDown('offline');
    const d = device(backend);
    writeSave(d.game, save(10));
    expect(await d.account.logIn('ana@example.com', 'password1')).toEqual({ ok: false, error: 'offline' });
    expect(d.local().coins).toBe(10);
  });
});

describe('a linked device', () => {
  async function linked() {
    const backend = fakeBackend();
    const storage = memoryStore();
    const d = device(backend, storage);
    writeSave(d.game, save(100));
    await d.account.register('ana@example.com', 'password1');
    await settle();
    return { backend, d, storage };
  }

  it('pushes every save write after the debounce, with the known rev', async () => {
    const { backend, d } = await linked();
    writeSave(d.game, save(150));
    writeSave(d.game, save(160));
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 100 });
    d.timers.runAll();
    await settle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 160 });
    expect(backend.calls.at(-1)).toBe('updateSave@1');
    expect(DEBOUNCE_MS).toBe(2000);
  });

  it('on 409 adopts the newer cloud save and tells the player', async () => {
    const { backend, d } = await linked();
    backend.writeElsewhere('ana@example.com', save(999));
    writeSave(d.game, save(101));
    d.account.flush();
    await settle();
    expect(d.local().coins).toBe(999);
    expect(d.notices).toContain('adopted');
  });

  it('a reload refreshes the token and adopts what another device saved', async () => {
    const { backend, storage } = await linked();
    backend.writeElsewhere('ana@example.com', save(777));
    const again = device(backend, storage);
    await again.account.start();
    expect(again.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
    expect(again.local().coins).toBe(777);
    expect(again.notices).toEqual(['adopted']);
    expect(backend.calls).toContain('refresh');
  });

  it('a reload pushes progress made while offline', async () => {
    const { backend, d, storage } = await linked();
    backend.setDown('offline');
    writeSave(d.game, save(130));
    d.account.flush();
    await settle();
    backend.setDown(null);
    const again = device(backend, storage);
    await again.account.start();
    await settle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 130 });
  });

  it('an expired session at start signs out but keeps the local save', async () => {
    const { backend, storage } = await linked();
    backend.revoke();
    const again = device(backend, storage);
    await again.account.start();
    expect(again.account.state()).toEqual({ kind: 'guest' });
    expect(again.notices).toEqual(['expired']);
    expect(again.local().coins).toBe(100);
    expect(storage.get(ACCOUNT_KEY) ?? '').toBe('');
  });

  it('starting offline keeps the session and play', async () => {
    const { backend, storage } = await linked();
    backend.setDown('offline');
    const again = device(backend, storage);
    await again.account.start();
    expect(again.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
  });

  it('log out forgets the session and keeps the local save', async () => {
    const { d, storage } = await linked();
    d.account.logOut();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(storage.get(ACCOUNT_KEY) ?? '').toBe('');
    expect(d.local().coins).toBe(100);
  });

  it('delete account removes it on the server and signs out', async () => {
    const { backend, d } = await linked();
    expect(await d.account.deleteAccount()).toEqual({ ok: true });
    expect(backend.users.size).toBe(0);
    expect(backend.cloudOf('ana@example.com')).toBeNull();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(d.local().coins).toBe(100);
  });

  it('a failed delete keeps the account', async () => {
    const { backend, d } = await linked();
    backend.setDown('offline');
    expect(await d.account.deleteAccount()).toEqual({ ok: false, error: 'offline' });
    expect(d.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
  });
});

describe('storage that fails', () => {
  it('accounts still work for the page when localStorage throws', async () => {
    const backend = fakeBackend();
    const throwing: KeyValueStore = {
      get: () => {
        throw new Error('blocked');
      },
      set: () => {
        throw new Error('quota');
      },
    };
    const d = device(backend, throwing);
    await expect(d.account.start()).resolves.toBeUndefined();
    expect(await d.account.register('ana@example.com', 'password1')).toEqual({ ok: true });
    expect(d.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
    expect(() => d.account.logOut()).not.toThrow();
  });

  it('a corrupted stored session reads as a guest', async () => {
    const backend = fakeBackend();
    const storage = memoryStore();
    storage.set(ACCOUNT_KEY, '{"token":5}');
    const d = device(backend, storage);
    await d.account.start();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(backend.calls).toEqual([]);
  });
});

describe('account strings', () => {
  it('every notice and error has a line in each language, without em dashes', () => {
    const keys = [...NOTICES.map((n) => `account.notice.${n}`), ...ACCOUNT_ERRORS.map((e) => `account.error.${e}`), 'account.forgot', 'account.privacy', 'title.account'];
    for (const language of LANGUAGES) {
      const lines = catalog(language);
      expect(keys.filter((key) => !lines[key])).toEqual([]);
      expect(Object.entries(lines).filter(([key, text]) => (key.startsWith('account.') || key === 'title.account') && text.includes('—'))).toEqual([]);
    }
    expect(catalog('es')['account.notice.adopted']).toBe('Se cargó una partida más reciente de tu cuenta.');
    expect(catalog('es')['account.forgot']).toContain('Si olvidas la contraseña, escríbenos');
  });
});
