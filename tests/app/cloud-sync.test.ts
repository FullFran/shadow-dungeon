import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import type { ApiResult, RemoteSave } from '../../src/adapters/account-api';
import { encodeCloud, type CloudData } from '../../src/app/cloud-payload';
import {
  createPusher,
  DEBOUNCE_MS,
  decideSync,
  decisionInput,
  EMPTY_SYNC,
  FIRST_RETRY_MS,
  MAX_RETRY_MS,
  observeKeys,
  parseSync,
  readSync,
  SYNC_KEY,
  writeSync,
  type DecisionInput,
  type PushApi,
  type SyncAction,
  type SyncState,
  type Timers,
} from '../../src/app/cloud-sync';
import { EMPTY_PROFILE, profileHash, PROFILE_KEYS, type Profile } from '../../src/app/profile';
import { EMPTY_SAVE, SAVE_KEY } from '../../src/app/save';
import { electLeader, HEARTBEAT_MS, LEASE_KEY, LEASE_MS, type LockManagerLike } from '../../src/app/sync-leader';

const profile = (coins: number): Profile => ({ ...EMPTY_PROFILE, save: { ...EMPTY_SAVE, coins } });

/** Timers driven by hand: `advance(ms)` runs what came due, in order. */
function manualTimers(): Timers & { advance(ms: number): void; now(): number } {
  let now = 0;
  let next = 1;
  const queue = new Map<number, { at: number; fn: () => void }>();
  return {
    set(fn, ms) {
      const id = next++;
      queue.set(id, { at: now + ms, fn });
      return id;
    },
    clear(id) {
      queue.delete(id as number);
    },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const due = [...queue.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        queue.delete(due[0]);
        now = due[1].at;
        due[1].fn();
      }
      now = end;
    },
    now: () => now,
  };
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('the decision table', () => {
  const H = { base: 'h-base', changed: 'h-local', cloud: 'h-cloud' };
  const OWNERS = ['none', 'same', 'other'] as const;
  const BASES = [null, { saveId: 's1', rev: 3, hash: H.base }] as const;
  const LOCALS = [
    { hash: H.base, empty: false },
    { hash: H.changed, empty: false },
    { hash: 'h-empty', empty: true },
  ] as const;
  const REMOTES = [
    null,
    { id: 's1', rev: 3, hash: 'h-empty', empty: true },
    // Same content as the local one (filled per case below).
    'equal',
    ...[2, 3, 4].flatMap((rev) => ['s1', 's2'].map((id) => ({ id, rev, hash: H.cloud, empty: false }))),
  ] as const;

  /** Every combination of owner, held, base, local and remote. */
  const cases: DecisionInput[] = [];
  for (const owner of OWNERS)
    for (const held of [false, true])
      for (const base of BASES)
        for (const local of LOCALS)
          for (const remote of REMOTES) {
            // A base or a held flag only exists for the same owner.
            if ((base || held) && owner !== 'same') continue;
            const r = remote === 'equal' ? { id: 's1', rev: 3, hash: local.hash, empty: local.empty } : remote;
            cases.push({ owner, held, base, local, remote: r });
          }

  const ACTIONS: SyncAction[] = ['none', 'push', 'pull', 'offer-download', 'diverged', 'foreign', 'held'];

  it(`answers every one of the ${cases.length} states with a known action`, () => {
    expect(cases.length).toBeGreaterThan(100);
    for (const c of cases) expect(ACTIONS).toContain(decideSync(c));
  });

  it('never loses progress: invariants over every state', () => {
    for (const c of cases) {
      const action = decideSync(c);
      const at = `${JSON.stringify(c)} -> ${action}`;
      const cloudHasProgress = c.remote !== null && !c.remote.empty;
      const seenRemote = c.base !== null && c.remote !== null && c.remote.id === c.base.saveId && c.remote.rev === c.base.rev;
      // Another account's progress is never mixed in silently.
      if (c.owner === 'other' && !c.local.empty) expect(action, at).toBe('foreign');
      // An empty device never pushes over cloud progress.
      if (c.local.empty && cloudHasProgress) expect(action, at).not.toBe('push');
      // A push only overwrites a cloud revision this device has seen (or no progress at all).
      if (action === 'push') expect(!cloudHasProgress || seenRemote, at).toBe(true);
      // A pull never throws local changes away.
      if (action === 'pull') expect(c.local.empty || c.local.hash === c.base?.hash, at).toBe(true);
      // Equal profiles need nothing.
      if (c.remote && c.remote.hash === c.local.hash && c.owner !== 'other') expect(action, at).toBe('none');
      // "Empezar de cero" holds everything that would move.
      if (c.held && cloudHasProgress && c.remote!.hash !== c.local.hash) expect(action, at).toBe('held');
      if (action === 'diverged') expect(c.local.empty, at).toBe(false);
      if (action === 'offer-download') expect(c.local.empty && cloudHasProgress, at).toBe(true);
    }
  });

  const base = { saveId: 's1', rev: 3, hash: H.base };
  const cloud = (rev: number, id = 's1') => ({ id, rev, hash: H.cloud, empty: false });
  const full = { hash: H.changed, empty: false };
  const unchanged = { hash: H.base, empty: false };
  const empty = { hash: 'h-empty', empty: true };
  const row = (owner: DecisionInput['owner'], b: DecisionInput['base'], local: DecisionInput['local'], remote: DecisionInput['remote'], held = false): DecisionInput => ({ owner, held, base: b, local, remote });

  it.each<[string, DecisionInput, SyncAction]>([
    ['guest progress, account without cloud save: upload', row('none', null, full, null), 'push'],
    ['guest progress, empty cloud save: upload', row('none', null, full, { id: 's1', rev: 1, hash: 'h-empty', empty: true }), 'push'],
    ['nothing anywhere', row('none', null, empty, null), 'none'],
    ['new browser, cloud progress: offer the download', row('none', null, empty, cloud(4)), 'offer-download'],
    ['guest progress meets different cloud progress: pick', row('none', null, full, cloud(4)), 'diverged'],
    ['same account, only the device moved (server rev == baseRev): push', row('same', base, full, cloud(3)), 'push'],
    ['same account, only the cloud moved: silent pull', row('same', base, unchanged, cloud(4)), 'pull'],
    ['same account, both moved: pick', row('same', base, full, cloud(4)), 'diverged'],
    ['same account, storage wiped under a known record: take it back', row('same', base, empty, cloud(4)), 'pull'],
    ['same account, record replaced (other id): pick', row('same', base, full, cloud(4, 's2')), 'diverged'],
    ['same account, cloud behind the base (restored server): pick', row('same', base, full, cloud(2)), 'diverged'],
    ['same account, unchanged device, cloud record unknown: pick', row('same', base, unchanged, cloud(9, 's2')), 'diverged'],
    ['another account\'s progress on this browser: ask', row('other', null, full, cloud(4)), 'foreign'],
    ['another account\'s progress, account without cloud save: still ask', row('other', null, full, null), 'foreign'],
    ['another account tag but nothing local: like a new browser', row('other', null, empty, cloud(4)), 'offer-download'],
    ['held ("Empezar de cero"): nothing moves', row('same', base, full, cloud(4), true), 'held'],
    ['held, cloud emptied meanwhile: push', row('same', base, full, null, true), 'push'],
  ])('%s', (_name, input, expected) => {
    expect(decideSync(input)).toBe(expected);
  });

  it('builds its input from the sync state, the local profile and the cloud record', () => {
    const state: SyncState = { ...EMPTY_SYNC, owner: 'u1', saveId: 's1', rev: 3, hash: profileHash(profile(5)) };
    const remote: RemoteSave = { id: 's1', rev: 4, data: encodeCloud(profile(9), { savedAt: 1 }) };
    const input = decisionInput(state, 'u1', profile(5), remote);
    expect(input.owner).toBe('same');
    expect(decideSync(input)).toBe('pull');
    expect(decisionInput(state, 'u2', profile(5), remote).owner).toBe('other');
    expect(decisionInput(state, 'u2', profile(5), remote).base).toBeNull();
    expect(decisionInput(EMPTY_SYNC, 'u1', profile(5), remote).owner).toBe('none');
  });
});

describe('sync state', () => {
  it('round-trips and tags local data with its account', () => {
    const store = memoryStore();
    const state: SyncState = { owner: 'u1', saveId: 's1', rev: 7, hash: 'abc:1', syncedAt: 100, held: true, status: 'held' };
    writeSync(store, state);
    expect(readSync(store)).toEqual(state);
  });

  it('broken, hostile or ownerless state reads as never synced', () => {
    expect(parseSync('{')).toEqual(EMPTY_SYNC);
    expect(parseSync(JSON.stringify({ owner: 'bad id!', saveId: 's1', rev: 3 }))).toEqual(EMPTY_SYNC);
    expect(parseSync(JSON.stringify({ owner: 'u1', rev: -1, status: 'weird', hash: 5 }))).toEqual({ ...EMPTY_SYNC, owner: 'u1' });
  });

  it('a failing store does not throw', () => {
    const broken: KeyValueStore = {
      get: () => {
        throw new Error('x');
      },
      set: () => {
        throw new Error('x');
      },
    };
    expect(readSync(broken)).toEqual(EMPTY_SYNC);
    expect(() => writeSync(broken, EMPTY_SYNC)).not.toThrow();
  });
});

describe('observed profile keys', () => {
  it('reports writes of every profile key and nothing else', () => {
    const seen: string[] = [];
    const store = observeKeys(memoryStore(), PROFILE_KEYS, (k) => seen.push(k));
    for (const key of PROFILE_KEYS) store.set(key, '1');
    store.set('mazmorra-sombria.settings', '{}');
    expect(seen).toEqual([...PROFILE_KEYS]);
  });
});

describe('the push loop', () => {
  function rig(start: Partial<SyncState> = {}) {
    const timers = manualTimers();
    let state: SyncState = { ...EMPTY_SYNC, owner: 'u1', saveId: 's1', rev: 1, hash: profileHash(profile(1)), ...start };
    let local = profile(1);
    const calls: { saveId: string | null; rev: number; coins: number }[] = [];
    const events: string[] = [];
    let answer: (data: CloudData, rev: number) => ApiResult<RemoteSave> = (data, rev) => ({ ok: true, value: { id: 's1', rev: rev + 1, data } });
    const api: PushApi = {
      async create(data) {
        calls.push({ saveId: null, rev: 0, coins: data.coins });
        return answer(data, 0);
      },
      async update(saveId, data, rev) {
        calls.push({ saveId, rev, coins: data.coins });
        return answer(data, rev);
      },
    };
    const pusher = createPusher({
      api,
      timers,
      state: () => state,
      readLocal: () => local,
      encode: (p) => encodeCloud(p, { savedAt: 0 }),
      pushed: (remote, hash) => {
        state = { ...state, saveId: remote.id, rev: remote.rev, hash };
        events.push(`pushed@${remote.rev}`);
      },
      conflict: (current) => events.push(`conflict@${current.rev}`),
      onAuthLost: () => events.push('auth'),
      status: (s) => events.push(s),
    });
    return {
      timers,
      pusher,
      calls,
      events,
      setLocal: (p: Profile) => (local = p),
      setState: (patch: Partial<SyncState>) => (state = { ...state, ...patch }),
      state: () => state,
      answer: (fn: typeof answer) => (answer = fn),
    };
  }

  it('debounces writes into one push with the baseRev', async () => {
    const r = rig();
    r.setLocal(profile(2));
    r.pusher.changed();
    r.setLocal(profile(3));
    r.pusher.changed();
    r.timers.advance(DEBOUNCE_MS - 1);
    expect(r.calls).toEqual([]);
    r.timers.advance(1);
    await settle();
    expect(r.calls).toEqual([{ saveId: 's1', rev: 1, coins: 3 }]);
    expect(r.state().rev).toBe(2);
  });

  it('creates the record when the device has none', async () => {
    const r = rig({ saveId: null, rev: 0, hash: null });
    r.setLocal(profile(5));
    r.pusher.flush();
    await settle();
    expect(r.calls).toEqual([{ saveId: null, rev: 0, coins: 5 }]);
  });

  it('pushes nothing when the local profile equals the base', async () => {
    const r = rig();
    r.pusher.flush();
    await settle();
    expect(r.calls).toEqual([]);
  });

  it('never pushes while held or while a choice is open, nor an empty profile over a known record', async () => {
    const r = rig({ held: true });
    r.setLocal(profile(9));
    r.pusher.flush();
    r.setState({ held: false, status: 'choice' });
    r.pusher.flush();
    r.setState({ status: 'synced' });
    r.setLocal(EMPTY_PROFILE);
    r.pusher.flush();
    await settle();
    expect(r.calls).toEqual([]);
  });

  it('a 409 goes back to the caller instead of overwriting', async () => {
    const r = rig();
    r.answer(() => ({ ok: false, error: { kind: 'conflict', current: { id: 's1', rev: 5, data: {} } } }));
    r.setLocal(profile(2));
    r.pusher.flush();
    await settle();
    expect(r.events).toContain('conflict@5');
    expect(r.calls).toHaveLength(1);
  });

  it('offline: keeps the latest and retries with backoff up to the cap', async () => {
    const r = rig();
    r.answer(() => ({ ok: false, error: { kind: 'offline' } }));
    r.setLocal(profile(2));
    r.pusher.flush();
    await settle();
    expect(r.events).toContain('offline');
    let wait = FIRST_RETRY_MS;
    for (let i = 0; i < 6; i++) {
      r.timers.advance(wait);
      await settle();
      wait = Math.min(wait * 2, MAX_RETRY_MS);
    }
    expect(r.calls.length).toBe(7);
    r.answer((data, rev) => ({ ok: true, value: { id: 's1', rev: rev + 1, data } }));
    r.timers.advance(MAX_RETRY_MS);
    await settle();
    expect(r.state().rev).toBe(2);
  });

  it('an expired session stops and reports; a stopped loop sends nothing', async () => {
    const r = rig();
    r.answer(() => ({ ok: false, error: { kind: 'unauthorized' } }));
    r.setLocal(profile(2));
    r.pusher.flush();
    await settle();
    expect(r.events).toContain('auth');
    r.pusher.stop();
    r.pusher.changed();
    r.timers.advance(DEBOUNCE_MS);
    await settle();
    expect(r.calls).toHaveLength(1);
  });
});

describe('one tab pushes', () => {
  /** A fake Web Locks manager: one holder at a time, the next in line gets it on release. */
  function fakeLocks(): LockManagerLike {
    const queue: (() => void)[] = [];
    let held = false;
    const next = () => {
      const run = queue.shift();
      if (run) run();
    };
    return {
      request(_name, _options, callback) {
        return new Promise((resolve) => {
          const run = () => {
            held = true;
            void callback(null).then(() => {
              held = false;
              resolve(undefined);
              next();
            });
          };
          if (held) queue.push(run);
          else run();
        });
      },
    };
  }

  it('Web Locks: the first tab leads; the next takes over when it closes', async () => {
    const locks = fakeLocks();
    const store = memoryStore();
    const timers = manualTimers();
    const led: string[] = [];
    const tab = (id: string) => electLeader({ locks, store, timers, now: timers.now, id, onLeader: () => led.push(id), onLost: () => led.push(`lost ${id}`) });
    const a = tab('a');
    const b = tab('b');
    await settle();
    expect([a.isLeader(), b.isLeader()]).toEqual([true, false]);
    a.stop();
    await settle();
    expect([a.isLeader(), b.isLeader()]).toEqual([false, true]);
    expect(led).toEqual(['a', 'b']);
  });

  it('lease fallback: one leader; a closed or frozen leader is replaced after the lease', () => {
    const store = memoryStore();
    const timers = manualTimers();
    const led: string[] = [];
    const tab = (id: string) => electLeader({ locks: null, store, timers, now: timers.now, id, onLeader: () => led.push(id), onLost: () => led.push(`lost ${id}`) });
    const a = tab('a');
    const b = tab('b');
    timers.advance(HEARTBEAT_MS * 3);
    expect([a.isLeader(), b.isLeader()]).toEqual([true, false]);
    a.stop();
    timers.advance(HEARTBEAT_MS);
    expect(b.isLeader()).toBe(true);
    // b freezes (no heartbeat) and c claims the expired lease; when b wakes up it steps down.
    const c = electLeader({ locks: null, store, timers: manualTimers(), now: () => timers.now() + LEASE_MS + 1, id: 'c', onLeader: () => led.push('c'), onLost: () => led.push('lost c') });
    expect(c.isLeader()).toBe(true);
    timers.advance(HEARTBEAT_MS);
    expect(b.isLeader()).toBe(false);
    expect(led).toEqual(['a', 'b', 'c', 'lost b']);
    expect(JSON.parse(store.get(LEASE_KEY)!).id).toBe('c');
  });

  it('lease fallback without storage: the tab leads itself', () => {
    const silent: KeyValueStore = { get: () => null, set: () => {} };
    const timers = manualTimers();
    const tab = electLeader({ locks: null, store: silent, timers, now: timers.now, id: 'a', onLeader: () => {}, onLost: () => {} });
    expect(tab.isLeader()).toBe(true);
  });

  it('keeps no sync key collision with the profile or the lease', () => {
    expect(PROFILE_KEYS).not.toContain(SYNC_KEY);
    expect([SYNC_KEY, LEASE_KEY, SAVE_KEY].length).toBe(new Set([SYNC_KEY, LEASE_KEY, SAVE_KEY]).size);
  });
});
