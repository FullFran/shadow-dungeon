import { describe, expect, it } from 'vitest';
import { createConnectivity } from '../../src/app/connectivity';
import { appError } from '../../src/adapters/net-error';

function env(initial = true) {
  let online = initial;
  const listeners = new Map<string, () => void>();
  const c = createConnectivity({
    isOnline: () => online,
    listen: (type, fn) => {
      listeners.set(type, fn);
      return () => void listeners.delete(type);
    },
  });
  return {
    c,
    go(next: boolean) {
      online = next;
      listeners.get(next ? 'online' : 'offline')?.();
    },
  };
}

describe('connectivity', () => {
  it('a request that reached the server clears an offline its failure set, while the browser never went offline', () => {
    const { c } = env();
    const seen: boolean[] = [];
    let runs = 0;
    c.subscribe((online) => seen.push(online));
    c.noteError(appError('offline'));
    c.retryWhenBack(() => (runs += 1));
    expect(c.online()).toBe(false);
    c.noteReached();
    expect(c.online()).toBe(true);
    expect(seen).toEqual([false, true]);
    expect(runs).toBe(1);
  });

  it('follows the browser going offline and back, telling subscribers', () => {
    const { c, go } = env();
    const seen: boolean[] = [];
    c.subscribe((online) => seen.push(online));
    go(false);
    expect(c.online()).toBe(false);
    go(true);
    expect(c.online()).toBe(true);
    expect(seen).toEqual([false, true]);
  });

  it('runs the registered retries once when the connection comes back, then forgets them', () => {
    const { c, go } = env(false);
    let runs = 0;
    c.retryWhenBack(() => (runs += 1));
    expect(runs).toBe(0);
    go(true);
    go(false);
    go(true);
    expect(runs).toBe(1);
  });

  it('a retry that was cancelled does not run', () => {
    const { c, go } = env(false);
    let runs = 0;
    const cancel = c.retryWhenBack(() => (runs += 1));
    cancel();
    go(true);
    expect(runs).toBe(0);
  });

  it('a failure of the offline kind marks the game offline even if the browser claims otherwise; any other kind does not', () => {
    const { c } = env(true);
    c.noteError(appError('server'));
    expect(c.online()).toBe(true);
    c.noteError(appError('offline'));
    expect(c.online()).toBe(false);
  });

  it('the browser saying online again clears a suspected outage', () => {
    const { c, go } = env(true);
    c.noteError(appError('offline'));
    go(true);
    expect(c.online()).toBe(true);
  });

  it('stops listening on dispose', () => {
    const { c, go } = env();
    const seen: boolean[] = [];
    c.subscribe((o) => seen.push(o));
    c.dispose();
    go(false);
    expect(seen).toEqual([]);
  });
});
