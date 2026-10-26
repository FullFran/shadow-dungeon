import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import type { ApiResult, RemoteSave } from '../../src/adapters/account-api';
import { EMPTY_SAVE, SAVE_KEY, SAVE_VERSION, type SaveData } from '../../src/app/save';
import {
  createPusher,
  DEBOUNCE_MS,
  firstLoginDecision,
  isEmptySave,
  MAX_RETRY_MS,
  observeKey,
  readRemote,
  resumeDecision,
  saveSummary,
  type PushApi,
  type SyncLink,
  type Timers,
} from '../../src/app/cloud-sync';

const save = (patch: Partial<SaveData>): SaveData => ({ ...EMPTY_SAVE, ...patch });
const remote = (data: SaveData, rev = 1, id = 'save1'): RemoteSave => ({ id, rev, data });

/** Timers driven by hand: `advance(ms)` runs what came due, in order. */
function manualTimers(): Timers & { advance(ms: number): void; pending(): number[] } {
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
    pending: () => [...queue.values()].map((t) => t.at - now),
  };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('save emptiness and summaries', () => {
  it('a fresh save is empty; any coin, upgrade or Pokémon is not', () => {
    expect(isEmptySave(EMPTY_SAVE)).toBe(true);
    expect(isEmptySave(save({ coins: 1 }))).toBe(false);
    expect(isEmptySave(save({ upgrades: { vitality: 1 } }))).toBe(false);
    expect(isEmptySave(save({ owned: ['kadabra'] }))).toBe(false);
    expect(isEmptySave(save({ owned: [] }))).toBe(true);
  });

  it('summarizes coins and owned Pokémon', () => {
    expect(saveSummary(save({ coins: 250 }))).toEqual({ coins: 250, owned: 0 });
    expect(saveSummary(save({ coins: 3, owned: ['kadabra', 'luxio'] }))).toEqual({ coins: 3, owned: 2 });
  });

  it('reads cloud data like a local save (migrate + sanitize), hostile data as empty', () => {
    expect(readRemote({ version: 1, coins: 40, upgrades: {} })).toEqual(save({ coins: 40 }));
    expect(readRemote('nope')).toEqual(EMPTY_SAVE);
    expect(readRemote({ coins: -3 }).coins).toBe(0);
  });
});

describe('first login on a device', () => {
  const local = save({ coins: 100 });
  it('uploads the local save when the account has none', () => {
    expect(firstLoginDecision(local, null)).toBe('upload');
    expect(firstLoginDecision(EMPTY_SAVE, null)).toBe('upload');
  });
  it('uploads over an empty cloud save', () => {
    expect(firstLoginDecision(local, remote(EMPTY_SAVE))).toBe('upload');
  });
  it('takes the cloud save when this device has nothing', () => {
    expect(firstLoginDecision(EMPTY_SAVE, remote(save({ coins: 5 })))).toBe('download');
  });
  it('does nothing when both are the same', () => {
    expect(firstLoginDecision(local, remote(local))).toBe('same');
  });
  it('asks when both have progress and differ', () => {
    expect(firstLoginDecision(local, remote(save({ coins: 7 })))).toBe('ask');
  });
});

describe('resuming a linked session', () => {
  const local = save({ coins: 100 });
  const link: SyncLink = { saveId: 'save1', rev: 3 };
  it('adopts a newer cloud revision', () => {
    expect(resumeDecision(local, remote(save({ coins: 9 }), 4), link)).toBe('adopt');
  });
  it('pushes progress made offline on top of the known revision', () => {
    expect(resumeDecision(local, remote(save({ coins: 9 }), 3), link)).toBe('push');
  });
  it('does nothing when both agree', () => {
    expect(resumeDecision(local, remote(local, 3), link)).toBe('none');
  });
  it('uploads again when the cloud save is gone', () => {
    expect(resumeDecision(local, null, link)).toBe('upload');
  });
});

describe('observeKey', () => {
  it('reports writes of the observed key only, after they are stored', () => {
    const inner = memoryStore();
    const seen: string[] = [];
    const store = observeKey(inner, SAVE_KEY, () => seen.push(inner.get(SAVE_KEY) ?? ''));
    store.set('other', 'x');
    store.set(SAVE_KEY, '{"coins":1}');
    expect(seen).toEqual(['{"coins":1}']);
    expect(store.get('other')).toBe('x');
  });

  it('does not report a write the store refused (nothing new to push)', () => {
    let calls = 0;
    const store = observeKey({ get: () => null, set: () => { throw new Error('quota'); } }, SAVE_KEY, () => calls++);
    expect(() => store.set(SAVE_KEY, '{}')).toThrow();
    expect(calls).toBe(0);
  });
});

/** A fake save endpoint with a revision counter and switchable failures. */
function fakeApi(initial: RemoteSave | null = null) {
  let current = initial;
  const calls: { kind: 'create' | 'update'; rev: number; coins: number }[] = [];
  let failure: 'offline' | 'unauthorized' | 'rejected' | null = null;
  const api: PushApi & { calls: typeof calls; fail(kind: typeof failure): void; bump(data: SaveData): void; current(): RemoteSave | null } = {
    calls,
    fail: (kind) => {
      failure = kind;
    },
    bump: (data) => {
      current = { id: current?.id ?? 'save1', rev: (current?.rev ?? 0) + 1, data };
    },
    current: () => current,
    async create(data) {
      calls.push({ kind: 'create', rev: 0, coins: data.coins });
      return answer(0, data);
    },
    async update(_id, data, rev) {
      calls.push({ kind: 'update', rev, coins: data.coins });
      return answer(rev, data);
    },
  };
  function answer(rev: number, data: SaveData): ApiResult<RemoteSave> {
    if (failure) return { ok: false, error: { kind: failure } };
    if ((current?.rev ?? 0) !== rev) return { ok: false, error: { kind: 'conflict', current: current! } };
    current = { id: current?.id ?? 'save1', rev: rev + 1, data };
    return { ok: true, value: current };
  }
  return api;
}

function harness(initialRemote: RemoteSave | null, link: SyncLink) {
  const api = fakeApi(initialRemote);
  const timers = manualTimers();
  let local = save({ coins: 10 });
  const events: string[] = [];
  let stored = link;
  const pusher = createPusher({
    api,
    timers,
    link: () => stored,
    setLink: (next) => {
      stored = next;
    },
    readLocal: () => local,
    adopt: (data) => {
      local = data;
      events.push(`adopt:${data.coins}`);
    },
    onAuthLost: () => events.push('auth-lost'),
  });
  return {
    api,
    timers,
    pusher,
    events,
    link: () => stored,
    setLocal: (coins: number) => {
      local = save({ coins });
    },
  };
}

describe('push loop', () => {
  it('debounces bursts of writes into one push with the known revision', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.setLocal(20);
    h.pusher.changed();
    h.timers.advance(DEBOUNCE_MS - 1);
    h.setLocal(30);
    h.pusher.changed();
    h.timers.advance(DEBOUNCE_MS - 1);
    expect(h.api.calls).toEqual([]);
    h.timers.advance(1);
    await settle();
    expect(h.api.calls).toEqual([{ kind: 'update', rev: 1, coins: 30 }]);
    expect(h.link()).toEqual({ saveId: 'save1', rev: 2 });
  });

  it('flushes at once (the tab is being hidden)', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.setLocal(15);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.api.calls).toHaveLength(1);
    expect(h.timers.pending()).toEqual([]);
  });

  it('creates the cloud save when none is linked yet', async () => {
    const h = harness(null, { saveId: null, rev: 0 });
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.api.calls).toEqual([{ kind: 'create', rev: 0, coins: 10 }]);
    expect(h.link()).toEqual({ saveId: 'save1', rev: 1 });
  });

  it('skips a push when nothing changed since the last one', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.setLocal(11);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.api.calls).toHaveLength(1);
  });

  it('on 409 adopts the newer cloud save, takes its revision and reports it', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.api.bump(save({ coins: 999 })); // another device wrote rev 2
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.events).toEqual(['adopt:999']);
    expect(h.link()).toEqual({ saveId: 'save1', rev: 2 });
    // The next local change goes on top of rev 2.
    h.setLocal(1000);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.api.calls.at(-1)).toEqual({ kind: 'update', rev: 2, coins: 1000 });
  });

  it('offline: keeps the latest save and retries later with a growing delay', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.api.fail('offline');
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    const first = h.timers.pending();
    expect(first).toHaveLength(1);
    h.timers.advance(first[0]!);
    await settle();
    expect(h.timers.pending()[0]).toBeGreaterThan(first[0]!);
    expect(h.timers.pending()[0]).toBeLessThanOrEqual(MAX_RETRY_MS);
    h.setLocal(25); // played on while offline
    h.api.fail(null);
    h.pusher.flush(); // back online
    await settle();
    expect(h.api.calls.at(-1)).toEqual({ kind: 'update', rev: 1, coins: 25 });
    expect(h.link().rev).toBe(2);
    expect(h.timers.pending()).toEqual([]);
  });

  it('a write during a push is sent after it, on the new revision', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.flush();
    h.setLocal(30);
    h.pusher.changed();
    h.pusher.flush(); // in flight: waits
    await settle();
    h.timers.advance(DEBOUNCE_MS);
    await settle();
    expect(h.api.calls.map((c) => [c.rev, c.coins])).toEqual([
      [1, 20],
      [2, 30],
    ]);
  });

  it('an expired session stops pushing and says so', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.api.fail('unauthorized');
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.events).toEqual(['auth-lost']);
    expect(h.timers.pending()).toEqual([]);
  });

  it('a rejected save is dropped, not retried forever', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.api.fail('rejected');
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(h.timers.pending()).toEqual([]);
  });

  it('stop() cancels the pending push', async () => {
    const h = harness(remote(save({ coins: 10 }), 1), { saveId: 'save1', rev: 1 });
    h.setLocal(20);
    h.pusher.changed();
    h.pusher.stop();
    h.timers.advance(DEBOUNCE_MS * 10);
    await settle();
    expect(h.api.calls).toEqual([]);
  });

  it('payloads are sanitized at the current version', async () => {
    const h = harness(null, { saveId: null, rev: 0 });
    let sent: SaveData | null = null;
    const create = h.api.create;
    h.api.create = async (data) => {
      sent = data;
      return create(data);
    };
    h.pusher.changed();
    h.pusher.flush();
    await settle();
    expect(sent).toMatchObject({ version: SAVE_VERSION, coins: 10 });
  });
});
