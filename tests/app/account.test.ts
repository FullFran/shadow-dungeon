import { describe, expect, it } from 'vitest';
import type { AccountApi, ApiError, ApiResult, AuthSession, RemoteSave } from '../../src/adapters/account-api';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { ACCOUNT_ERRORS, ACCOUNT_KEY, createAccount, NOTICES, type Notice } from '../../src/app/account';
import { catalog, LANGUAGES } from '../../src/i18n';
import { backupProfile } from '../../src/app/backups';
import { decodeCloud, encodeCloud } from '../../src/app/cloud-payload';
import { DEBOUNCE_MS, observeKeys, readSync, SYNC_KEY, type Timers } from '../../src/app/cloud-sync';
import { EMPTY_PROFILE, isEmptyProfile, PROFILE_KEYS, readProfile, writeProfile, type Profile } from '../../src/app/profile';
import { EMPTY_SAVE, loadSave, SAVE_KEY, writeSave, type SaveData } from '../../src/app/save';
import { readRecords, RECORDS_KEY, saveRun } from '../../src/town/records';
import { recordHerald } from '../../src/town/bestiary';
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
    async requestPasswordReset(email) {
      calls.push(`reset:${email}`);
      if (down) return fail(down as never);
      return { ok: true, value: undefined };
    },
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
    async ranking(tier) {
      calls.push('ranking');
      if (down) return fail(down as never);
      return { ok: true, value: { tier, entries: [] } };
    },
    async getProfile() {
      calls.push('getProfile');
      return { ok: true, value: null };
    },
    async createProfile(_token, _userId, fields) {
      calls.push('createProfile');
      return { ok: true, value: { id: 'p1', ...fields } };
    },
    async updateProfile(_token, profileId, fields) {
      calls.push('updateProfile');
      return { ok: true, value: { id: profileId, ...fields } };
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
    /** The cloud record of an account, as stored. */
    dataOf(email: string): unknown {
      const user = [...users.values()].find((u) => u.email === email);
      return user && [...saves.values()].find((s) => s.user === user.id)?.data;
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

/** A profile with some progress beyond the save. */
const withRecords = (coins: number, floor: number, extra: Partial<SaveData> = {}): Profile => ({
  ...EMPTY_PROFILE,
  save: save(coins, extra),
  records: { runs: floor, victories: 0, bestLevel: 3, lastSpecies: 'mimikyu', dungeons: { 'crypt-of-the-sword-king': { bestFloor: floor } } },
});
const cloudOf = (profile: Profile) => encodeCloud(profile, { savedAt: 1000 });

/** One tab: its storage (shared between tabs of one browser), its game store (observed like main.ts does) and its account. */
function device(backend: ReturnType<typeof fakeBackend>, storage: KeyValueStore = memoryStore(), options: { leader?: boolean } = {}) {
  const notices: { notice: Notice; undo?: string }[] = [];
  const timers = manualTimers();
  let replaced = 0;
  const synced: string[] = [];
  const account = createAccount({
    api: backend.api,
    store: storage,
    timers,
    now: () => 1_000_000,
    isLeader: () => options.leader ?? true,
    onNotice: (notice, undo) => notices.push(undo ? { notice, undo } : { notice }),
    onChange: () => {},
    onReplaced: () => replaced++,
    onSynced: (session) => synced.push(session.userId),
  });
  const game = observeKeys(storage, PROFILE_KEYS, () => account.saveChanged());
  return {
    account,
    game,
    storage,
    timers,
    notices,
    names: () => notices.map((n) => n.notice),
    replaced: () => replaced,
    synced,
    local: () => loadSave(storage),
    profile: () => readProfile(storage),
    /** Lets the debounce and pending requests run. */
    async idle() {
      timers.runAll();
      await settle();
    },
  };
}

describe('guest play', () => {
  it('a guest makes no request at start or when saving', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    await d.account.start();
    writeSave(d.game, save(50));
    await d.idle();
    expect(backend.calls).toEqual([]);
    expect(d.account.state()).toEqual({ kind: 'guest' });
  });
});

describe('the synced session (public profile)', () => {
  it('is reported after a sign-in and after each push, never for a guest', async () => {
    const backend = fakeBackend();
    const guest = device(backend);
    await guest.account.start();
    writeSave(guest.game, save(5));
    await guest.idle();
    expect(guest.synced).toEqual([]);

    const d = device(backend);
    writeSave(d.game, save(100));
    await d.account.register('ana@example.com', 'password1');
    await d.idle();
    expect(d.synced.length).toBeGreaterThan(0);
    const before = d.synced.length;
    writeSave(d.game, save(120));
    await d.idle();
    expect(d.synced.length).toBeGreaterThan(before);
    expect(new Set(d.synced).size).toBe(1);
  });
});

describe('first login on a browser', () => {
  it('registers and uploads the whole local profile when the account has none', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    writeProfile(d.game, withRecords(120, 3));
    expect(await d.account.register('ana@example.com', 'password1')).toEqual({ ok: true });
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 120 });
    const cloud = decodeCloud(backend.dataOf('ana@example.com')).profile;
    expect(cloud.records.dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(3);
    expect(readSync(d.storage)).toMatchObject({ saveId: expect.any(String), rev: 1, status: 'synced' });
    expect(d.account.syncInfo()).toEqual({ status: 'synced', syncedAt: 1_000_000 });
  });

  it('an empty browser is told about the cloud progress and downloads it on "Descargar"', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', cloudOf(withRecords(300, 6, { owned: ['kadabra'], achievements: { 'coop-clear': '2026-10-01' } })));
    const d = device(backend);
    await d.account.logIn('ana@example.com', 'password1');
    // Nothing moved yet: a notice with the summary.
    expect(d.local().coins).toBe(0);
    expect(d.account.pendingChoice()).toEqual({ kind: 'offer', cloud: { coins: 300, owned: 1, achievements: 1, bestFloor: 6, bestSima: 0, savedAt: 1000 } });
    await d.account.answer('download');
    await d.idle();
    expect(d.local().coins).toBe(300);
    expect(readRecords(d.storage).dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(6);
    expect(d.names()).toContain('cloud-loaded');
    expect(d.account.pendingChoice()).toBeNull();
    // Equal on both sides: nothing to push.
    expect(backend.calls.filter((c) => c.startsWith('updateSave'))).toEqual([]);
  });

  it('"Empezar de cero" keeps the cloud untouched until the player overwrites it on purpose', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', cloudOf(withRecords(300, 6)));
    const d = device(backend);
    await d.account.logIn('ana@example.com', 'password1');
    await d.account.answer('fresh');
    writeSave(d.game, save(15));
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 300 });
    expect(d.account.pendingChoice()).toMatchObject({ kind: 'held', device: { coins: 15 }, cloud: { coins: 300 } });
    expect(d.account.syncInfo().status).toBe('held');
    // A reload keeps it held.
    const again = device(backend, d.storage);
    await again.account.start();
    await again.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 300 });
    expect(again.account.pendingChoice()?.kind).toBe('held');
    await again.account.answer('overwrite');
    await again.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 15 });
    // The overwritten cloud profile is kept locally, and records merged.
    expect(again.account.backups().map((b) => backupProfile(b).save.coins)).toContain(300);
    expect(readRecords(again.storage).dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(6);
  });

  it('two different profiles: cards for each side; "La nube" keeps its economy and merges the rest', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', cloudOf(withRecords(300, 2, { owned: ['kadabra'], achievements: { 'coop-clear': '2026-10-01' } })));
    const d = device(backend);
    writeProfile(d.game, withRecords(40, 9, { achievements: { 'gacha-first-pull': '2026-10-03' } }));
    await d.account.logIn('ana@example.com', 'password1');
    expect(d.account.pendingChoice()).toMatchObject({ kind: 'diverged', device: { coins: 40, bestFloor: 9 }, cloud: { coins: 300, owned: 1, bestFloor: 2 } });
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 300 });
    await d.account.answer('cloud');
    await d.idle();
    const p = d.profile();
    expect(p.save.coins).toBe(300);
    expect(p.save.owned).toEqual(['kadabra']);
    expect(Object.keys(p.save.achievements ?? {}).sort()).toEqual(['coop-clear', 'gacha-first-pull']);
    expect(p.records.dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(9);
    // The merged records go up; the economy is the cloud's.
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 300 });
    expect(decodeCloud(backend.dataOf('ana@example.com')).profile.records.dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(9);
    // "Deshacer" brings the device's profile back (and it goes up).
    const resolved = d.notices.find((n) => n.notice === 'resolved');
    expect(resolved?.undo).toBeDefined();
    expect(d.account.syncInfo().status).toBe('resolved');
    expect(d.account.restore(resolved!.undo!)).toBe(true);
    await d.idle();
    expect(d.local().coins).toBe(40);
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 3, coins: 40 });
  });

  it('"Este dispositivo" overwrites the cloud economy and keeps the cloud profile as a backup', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1', cloudOf(withRecords(300, 2)), 5);
    const d = device(backend);
    writeProfile(d.game, withRecords(40, 1));
    await d.account.logIn('ana@example.com', 'password1');
    await d.account.answer('device');
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 6, coins: 40 });
    expect(d.local().coins).toBe(40);
    expect(readRecords(d.storage).dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(2);
    expect(d.account.backups().map((b) => backupProfile(b).save.coins)).toContain(300);
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

describe('a linked browser', () => {
  async function linked() {
    const backend = fakeBackend();
    const d = device(backend);
    writeSave(d.game, save(100));
    await d.account.register('ana@example.com', 'password1');
    await d.idle();
    return { backend, d, storage: d.storage };
  }

  it('pushes every progress write after the debounce, with the baseRev', async () => {
    const { backend, d } = await linked();
    writeSave(d.game, save(150));
    saveRun(d.game, { dungeon: 'crypt-of-the-sword-king', floor: 2, level: 4, species: 'mimikyu', victory: false });
    expect(d.account.syncInfo().status).toBe('pending');
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 100 });
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 150 });
    expect(backend.calls.at(-1)).toBe('updateSave@1');
    expect(decodeCloud(backend.dataOf('ana@example.com')).profile.records.runs).toBe(1);
    expect(DEBOUNCE_MS).toBe(2000);
  });

  it('only the cloud moved: a reload pulls it silently, says so and offers "Deshacer"', async () => {
    const { backend, storage } = await linked();
    backend.writeElsewhere('ana@example.com', cloudOf(withRecords(777, 4)) as SaveData);
    const again = device(backend, storage);
    await again.account.start();
    expect(again.local().coins).toBe(777);
    expect(again.names()).toEqual(['cloud-loaded']);
    expect(again.notices[0]!.undo).toBeDefined();
    expect(again.replaced()).toBeGreaterThan(0);
    expect(backend.calls).toContain('refresh');
  });

  it('both moved: a 409 asks instead of overwriting either side', async () => {
    const { backend, d } = await linked();
    backend.writeElsewhere('ana@example.com', cloudOf(withRecords(999, 1)) as SaveData);
    writeSave(d.game, save(101));
    d.account.flush();
    await settle();
    expect(d.local().coins).toBe(101);
    expect(d.names()).toContain('choose');
    expect(d.account.pendingChoice()).toMatchObject({ kind: 'diverged', device: { coins: 101 }, cloud: { coins: 999 } });
    // Nothing is pushed while the choice is open.
    writeSave(d.game, save(102));
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 999 });
  });

  it('the cloud moved and the device only in what merges (a run record): merged without asking', async () => {
    const { backend, d } = await linked();
    backend.writeElsewhere('ana@example.com', cloudOf(withRecords(999, 1)) as SaveData);
    saveRun(d.game, { dungeon: 'flooded-caves', floor: 3, level: 4, species: 'mimikyu', victory: false });
    d.account.flush();
    await d.idle();
    expect(d.account.pendingChoice()).toBeNull();
    expect(d.local().coins).toBe(999);
    expect(readRecords(d.storage).dungeons['flooded-caves']?.bestFloor).toBe(3);
    // The merged profile goes up over the newer revision.
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 3, coins: 999 });
    expect(decodeCloud(backend.dataOf('ana@example.com')).profile.records.dungeons['flooded-caves']?.bestFloor).toBe(3);
  });

  it('a reload pushes progress made while offline', async () => {
    const { backend, d, storage } = await linked();
    backend.setDown('offline');
    writeSave(d.game, save(130));
    d.account.flush();
    await settle();
    expect(d.account.syncInfo().status).toBe('offline');
    backend.setDown(null);
    const again = device(backend, storage);
    await again.account.start();
    await again.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 130 });
  });

  it('a wiped profile under a live session takes the cloud back instead of pushing nothing over it', async () => {
    const { backend, storage } = await linked();
    writeProfile(storage, EMPTY_PROFILE);
    const again = device(backend, storage);
    await again.account.start();
    await again.idle();
    expect(again.local().coins).toBe(100);
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 100 });
  });

  it('an expired session at start signs out but keeps the local save', async () => {
    const { backend, storage } = await linked();
    backend.revoke();
    const again = device(backend, storage);
    await again.account.start();
    expect(again.account.state()).toEqual({ kind: 'guest' });
    expect(again.names()).toEqual(['expired']);
    expect(again.local().coins).toBe(100);
    expect(storage.get(ACCOUNT_KEY) ?? '').toBe('');
  });

  it('starting offline keeps the session and play', async () => {
    const { backend, storage } = await linked();
    backend.setDown('offline');
    const again = device(backend, storage);
    await again.account.start();
    expect(again.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
    expect(again.account.syncInfo().status).toBe('offline');
  });

  it('log out keeps the local data, tagged with its account; logging back in just syncs', async () => {
    const { backend, d, storage } = await linked();
    d.account.logOut();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(storage.get(ACCOUNT_KEY) ?? '').toBe('');
    expect(d.local().coins).toBe(100);
    expect(readSync(storage).owner).toBe([...backend.users.values()][0]!.id);
    writeSave(d.game, save(140));
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 1, coins: 100 });
    await d.account.logIn('ana@example.com', 'password1');
    await d.idle();
    expect(d.account.pendingChoice()).toBeNull();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 140 });
  });

  it('delete account removes it on the server, signs out and keeps the local data as guest progress', async () => {
    const { backend, d } = await linked();
    expect(await d.account.deleteAccount()).toEqual({ ok: true });
    expect(backend.users.size).toBe(0);
    expect(backend.cloudOf('ana@example.com')).toBeNull();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(d.local().coins).toBe(100);
    expect(readSync(d.storage).owner).toBeNull();
  });

  it('a failed delete keeps the account', async () => {
    const { backend, d } = await linked();
    backend.setDown('offline');
    expect(await d.account.deleteAccount()).toEqual({ ok: false, error: 'offline' });
    expect(d.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
  });

  it('"Borrar datos de este dispositivo" signs out and erases progress, sync state and backups; the cloud stays', async () => {
    const { backend, d } = await linked();
    d.account.importProfile(withRecords(5, 1));
    expect(d.account.backups().length).toBeGreaterThan(0);
    d.account.wipeDevice();
    await d.idle();
    expect(d.account.state()).toEqual({ kind: 'guest' });
    expect(isEmptyProfile(d.profile())).toBe(true);
    expect(d.account.backups()).toEqual([]);
    expect(readSync(d.storage).owner).toBeNull();
    expect(backend.cloudOf('ana@example.com')?.coins).toBeGreaterThan(0);
  });
});

describe('local data of another account', () => {
  async function anaThenBea(beaCloud: Profile | null) {
    const backend = fakeBackend();
    backend.addUser('bea@example.com', 'password1', beaCloud ? cloudOf(beaCloud) : undefined);
    const d = device(backend);
    writeProfile(d.game, withRecords(70, 5));
    await d.account.register('ana@example.com', 'password1');
    await d.idle();
    d.account.logOut();
    await d.account.logIn('bea@example.com', 'password1');
    return { backend, d };
  }

  it('is never merged silently: the player is asked', async () => {
    const { backend, d } = await anaThenBea(withRecords(900, 1));
    expect(d.account.pendingChoice()).toEqual({ kind: 'foreign', device: expect.objectContaining({ coins: 70 }) });
    await d.idle();
    expect(backend.cloudOf('bea@example.com')).toEqual({ rev: 1, coins: 900 });
  });

  it('"Guardar como copia": kept in the backups, then the new account is offered its cloud progress', async () => {
    const { d } = await anaThenBea(withRecords(900, 1));
    await d.account.answer('keep-backup');
    expect(d.account.backups()[0]).toMatchObject({ reason: 'other-account' });
    expect(backupProfile(d.account.backups()[0]!).save.coins).toBe(70);
    expect(d.account.pendingChoice()?.kind).toBe('offer');
    await d.account.answer('download');
    expect(d.local().coins).toBe(900);
  });

  it('"Descartar": the local data goes (the backup ring still holds it)', async () => {
    const { d } = await anaThenBea(null);
    await d.account.answer('discard');
    expect(isEmptyProfile(d.profile())).toBe(true);
    expect(d.account.backups()[0]).toMatchObject({ reason: 'discard' });
  });

  it('"Usar en esta cuenta": becomes this account\'s progress and goes up', async () => {
    const { backend, d } = await anaThenBea(null);
    await d.account.answer('adopt');
    await d.idle();
    expect(backend.cloudOf('bea@example.com')).toEqual({ rev: 1, coins: 70 });
    expect(readSync(d.storage).owner).not.toBe(readSync(d.storage).saveId);
  });
});

describe('several tabs', () => {
  it('only the leader tab talks to the server; it pushes what a follower tab writes', async () => {
    const backend = fakeBackend();
    const storage = memoryStore();
    const leader = device(backend, storage);
    writeSave(leader.game, save(10));
    await leader.account.register('ana@example.com', 'password1');
    await leader.idle();
    const follower = device(backend, storage, { leader: false });
    const before = backend.calls.length;
    await follower.account.start();
    writeSave(follower.game, save(55));
    await follower.idle();
    expect(backend.calls.length).toBe(before);
    expect(follower.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
    // The browser tells the leader with a storage event.
    leader.account.external(SAVE_KEY);
    await leader.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 55 });
  });

  it('a sign-out in one tab signs the others out; a follower that becomes leader resumes', async () => {
    const backend = fakeBackend();
    const storage = memoryStore();
    const a = device(backend, storage);
    writeSave(a.game, save(10));
    await a.account.register('ana@example.com', 'password1');
    await a.idle();
    let leads = false;
    const b = createAccount({ api: backend.api, store: storage, timers: manualTimers(), now: () => 1, isLeader: () => leads, onNotice: () => {}, onChange: () => {}, onReplaced: () => {} });
    await b.start();
    backend.writeElsewhere('ana@example.com', cloudOf(withRecords(444, 1)) as SaveData);
    leads = true;
    b.lead();
    await settle();
    expect(loadSave(storage).coins).toBe(444);
    b.logOut();
    a.account.external(ACCOUNT_KEY);
    expect(a.account.state()).toEqual({ kind: 'guest' });
  });

  it('a follower reloads its state when the leader settles a choice', async () => {
    const backend = fakeBackend();
    const storage = memoryStore();
    const a = device(backend, storage);
    writeSave(a.game, save(10));
    await a.account.register('ana@example.com', 'password1');
    await a.idle();
    const b = device(backend, storage, { leader: false });
    await b.account.start();
    b.account.external(SYNC_KEY);
    b.account.external(RECORDS_KEY);
    expect(b.account.syncInfo().status).toBe('synced');
    expect(b.replaced()).toBe(1);
  });
});

describe('sessions from before profile sync', () => {
  it('their cloud link becomes the base: a newer cloud is pulled, records kept', async () => {
    const backend = fakeBackend();
    const id = backend.addUser('ana@example.com', 'password1', save(500), 3);
    const login = await backend.api.logIn('ana@example.com', 'password1');
    const storage = memoryStore();
    storage.set(ACCOUNT_KEY, JSON.stringify({ token: login.ok ? login.value.token : '', userId: id, email: 'ana@example.com', link: { saveId: `s${id}`, rev: 2 } }));
    writeProfile(storage, withRecords(100, 7));
    const d = device(backend, storage);
    await d.account.start();
    await d.idle();
    expect(d.account.pendingChoice()).toBeNull();
    expect(d.local().coins).toBe(500);
    expect(readRecords(storage).dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(7);
    // The merged records went up as a full profile.
    expect(decodeCloud(backend.dataOf('ana@example.com')).profile.records.runs).toBe(7);
  });
});

describe('backups from the account screen', () => {
  it('import and restore keep the replaced profile and push when signed in', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    writeSave(d.game, save(100));
    await d.account.register('ana@example.com', 'password1');
    await d.idle();
    d.account.importProfile(withRecords(42, 2));
    await d.idle();
    expect(d.local().coins).toBe(42);
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 2, coins: 42 });
    const older = d.account.backups().find((b) => backupProfile(b).save.coins === 100)!;
    expect(d.account.restore(older.id)).toBe(true);
    await d.idle();
    expect(backend.cloudOf('ana@example.com')).toEqual({ rev: 3, coins: 100 });
    expect(d.names()).toEqual(['imported', 'restored']);
    expect(d.account.restore('missing')).toBe(false);
  });

  it('a restore brings the backup economy back but never loses records made since', () => {
    const backend = fakeBackend();
    const d = device(backend);
    writeProfile(d.game, withRecords(10, 2));
    d.account.importProfile(withRecords(500, 1));
    saveRun(d.game, { dungeon: 'flooded-caves', floor: 6, level: 4, species: 'mimikyu', victory: false });
    const before = d.account.backups().find((b) => backupProfile(b).save.coins === 10)!;
    d.account.restore(before.id);
    expect(d.local().coins).toBe(10);
    expect(readRecords(d.storage).dungeons['flooded-caves']?.bestFloor).toBe(6);
    expect(readRecords(d.storage).dungeons['crypt-of-the-sword-king']?.bestFloor).toBe(2);
  });

  it('works for a guest too, without any request', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    writeSave(d.game, save(9));
    recordHerald(d.game, { seed: 1, name: 'Umbra' });
    d.account.importProfile(withRecords(1, 1));
    expect(d.account.restore(d.account.backups()[0]!.id)).toBe(true);
    expect(d.profile().bestiary).toEqual([{ seed: 1, name: 'Umbra' }]);
    expect(backend.calls).toEqual([]);
  });
});

describe('a forgotten or changed password', () => {
  const resets = (backend: ReturnType<typeof fakeBackend>) => backend.calls.filter((c) => c.startsWith('reset:'));

  it('a guest asks for the email they type, trimmed, and stays a guest', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    expect(await d.account.requestPasswordReset('  ana@example.com ')).toEqual({ ok: true });
    expect(resets(backend)).toEqual(['reset:ana@example.com']);
    expect(d.account.state()).toEqual({ kind: 'guest' });
  });
  it('a malformed or missing email never reaches the server', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    expect(await d.account.requestPasswordReset('nope')).toEqual({ ok: false, error: 'invalid-email' });
    expect(await d.account.requestPasswordReset()).toEqual({ ok: false, error: 'invalid-email' });
    expect(resets(backend)).toEqual([]);
  });
  it('signed in, it goes to the account email, whatever is passed, and the session stays', async () => {
    const backend = fakeBackend();
    backend.addUser('ana@example.com', 'password1');
    const d = device(backend);
    await d.account.logIn('ana@example.com', 'password1');
    expect(await d.account.requestPasswordReset('other@example.com')).toEqual({ ok: true });
    expect(resets(backend)).toEqual(['reset:ana@example.com']);
    expect(d.account.state()).toEqual({ kind: 'signed-in', email: 'ana@example.com' });
  });
  it('says what went wrong', async () => {
    const backend = fakeBackend();
    const d = device(backend);
    backend.setDown('rate-limited');
    expect(await d.account.requestPasswordReset('ana@example.com')).toEqual({ ok: false, error: 'rate-limited' });
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
    expect(() => d.account.wipeDevice()).not.toThrow();
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
    const keys = [...NOTICES.map((n) => `account.notice.${n}`), ...ACCOUNT_ERRORS.map((e) => `account.error.${e}`), 'account.forgot', 'account.changePassword', 'account.resetSent', 'account.resetSentOwn', 'account.privacy', 'title.account'];
    for (const language of LANGUAGES) {
      const lines = catalog(language);
      expect(keys.filter((key) => !lines[key])).toEqual([]);
      expect(Object.entries(lines).filter(([key, text]) => (key.startsWith('account.') || key.startsWith('sync.') || key === 'title.account') && text.includes('—'))).toEqual([]);
    }
    expect(catalog('es')['account.notice.cloud-loaded']).toBe('Datos de la nube cargados.');
    expect(catalog('es')['account.forgot']).toBe('He olvidado mi contraseña');
    for (const language of LANGUAGES) expect(catalog(language)['account.privacy']).not.toMatch(/escr[ií]b|write to us/i);
  });
});
