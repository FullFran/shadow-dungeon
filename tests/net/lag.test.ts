import { describe, expect, it } from 'vitest';
import { LagTransport, parseLagParams } from '../../src/net/lag';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';

type Msg = { n: number };

function pair(lag: { lagMs: number; jitterMs: number; loss: number }, randoms: number[]) {
  const scheduler = createFakeScheduler();
  const hub = createMemoryHub<Msg>();
  let i = 0;
  const random = () => randoms[i++ % randoms.length]!;
  const a = new LagTransport(hub.connect('a'), { ...lag, scheduler, random });
  const b = hub.connect('b');
  const got: Array<{ n: number; at: number }> = [];
  b.onMessage((_from, msg) => got.push({ n: msg.n, at: scheduler.now() }));
  return { a, b, scheduler, got };
}

describe('lag transport', () => {
  it('delays every message by lag + jitter', () => {
    // random 0.5 -> jitter offset 0.
    const { a, scheduler, got } = pair({ lagMs: 100, jitterMs: 30, loss: 0 }, [0.5]);
    a.send({ n: 1 }, false);
    scheduler.advance(99);
    expect(got).toEqual([]);
    scheduler.advance(1);
    expect(got).toEqual([{ n: 1, at: 100 }]);
  });

  it('jitter can reorder unreliable messages', () => {
    // First message gets +30 (random 1), second -30 (random 0).
    const { a, scheduler, got } = pair({ lagMs: 100, jitterMs: 30, loss: 0 }, [1, 0]);
    a.send({ n: 1 }, false);
    scheduler.advance(10);
    a.send({ n: 2 }, false);
    scheduler.advance(500);
    expect(got.map((g) => g.n)).toEqual([2, 1]);
  });

  it('reliable messages keep their order (delayed, never reordered)', () => {
    const { a, scheduler, got } = pair({ lagMs: 100, jitterMs: 30, loss: 0 }, [1, 0, 0.5]);
    a.send({ n: 1 }, true);
    scheduler.advance(10);
    a.send({ n: 2 }, true);
    a.send({ n: 3 }, true);
    scheduler.advance(500);
    expect(got.map((g) => g.n)).toEqual([1, 2, 3]);
    expect(got[0]!.at).toBe(130);
    expect(got[1]!.at).toBeGreaterThanOrEqual(130);
  });

  it('loss drops only unreliable messages', () => {
    // Every draw is 0.1 < loss 0.5: unreliable ones are dropped, reliable ones still arrive.
    const { a, scheduler, got } = pair({ lagMs: 0, jitterMs: 0, loss: 0.5 }, [0.1]);
    a.send({ n: 1 }, false);
    a.send({ n: 2 }, true);
    scheduler.advance(1);
    expect(got.map((g) => g.n)).toEqual([2]);
  });

  it('parses ?lag=ms&jitter=ms&loss=0..1 and clamps nonsense', () => {
    expect(parseLagParams('?lag=150&jitter=30&loss=0.1')).toEqual({ lagMs: 150, jitterMs: 30, loss: 0.1 });
    expect(parseLagParams('?lag=-5&loss=7')).toEqual({ lagMs: 0, jitterMs: 0, loss: 1 });
    expect(parseLagParams('')).toBeNull();
  });
});

describe('memory hub', () => {
  it('announces peers and delivers to everyone but the sender', () => {
    const hub = createMemoryHub<Msg>();
    const a = hub.connect('a');
    const joined: string[] = [];
    a.onPeerJoin((peer) => joined.push(peer));
    const b = hub.connect('b');
    const c = hub.connect('c');
    const got: string[] = [];
    b.onMessage((from, msg) => got.push(`b<${from}:${msg.n}`));
    c.onMessage((from, msg) => got.push(`c<${from}:${msg.n}`));
    a.send({ n: 1 }, true);
    expect(joined).toEqual(['b', 'c']);
    expect(a.peers()).toEqual(['b', 'c']);
    expect(got).toEqual(['b<a:1', 'c<a:1']);
    const left: string[] = [];
    a.onPeerLeave((peer) => left.push(peer));
    c.close();
    expect(left).toEqual(['c']);
    expect(a.peers()).toEqual(['b']);
  });
});
