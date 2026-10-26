import { describe, expect, it } from 'vitest';
import { startRun } from '../../src/core/run';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';

/** The bonfire over the wire (odd/tasks/coop-flow.md T5): the host's retry message, and late joins held to a join point. */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
  waits: number;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null, waits: 0 };
  session.onStart((start) => (p.started = start));
  session.onWait(() => (p.waits += 1));
  return p;
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

function room() {
  const scheduler = createFakeScheduler();
  const hub = createMemoryHub<string>();
  const host = peer(hub, 'h', scheduler);
  host.session.host(42, 1, 'mimikyu', { lobby: true });
  const a = peer(hub, 'a', scheduler);
  a.session.join('mimikyu', LOADOUT);
  host.session.begin();
  // The run is under way: the host has stepped its first floor.
  host.session.afterStep(startRun(42, { localId: 'p1', role: 'host' }).world, 1);
  return { scheduler, hub, host, a };
}

describe('bonfire over the wire', () => {
  it('the host\'s retry reaches the guest once, with the bonfire floor and the decision', () => {
    const { host, a } = room();
    expect(a.session.takeRetry()).toBeNull();
    host.session.sendRetry(3, true);
    expect(a.session.takeRetry()).toEqual({ floor: 3, go: true });
    expect(a.session.takeRetry()).toBeNull();
    host.session.sendRetry(3, false);
    expect(a.session.takeRetry()).toEqual({ floor: 3, go: false });
  });

  it('a hello during a floor waits ("wait for the next floor") and is let in on the next floor start', () => {
    const { hub, scheduler, host } = room();
    const late = peer(hub, 'late', scheduler);
    late.session.join('mimikyu', LOADOUT);
    expect(late.started).toBeNull();
    expect(late.waits).toBe(1);
    expect(host.session.roster().map((r) => r.id)).toEqual(['p1', 'p2']);
    host.session.sendFloor(2);
    expect(late.started).toEqual({ seed: 42, floor: 2, localId: 'p3' });
  });

  it('a hello held during a floor is let in at a bonfire respawn, on the bonfire floor', () => {
    const { hub, scheduler, host } = room();
    host.session.sendFloor(5);
    host.session.afterStep(startRun(42, { localId: 'p1', role: 'host' }).world, 5);
    const late = peer(hub, 'late', scheduler);
    late.session.join('mimikyu', LOADOUT);
    expect(late.started).toBeNull();
    host.session.sendRetry(3, true);
    expect(late.started).toEqual({ seed: 42, floor: 3, localId: 'p3' });
  });

  it('a hello right at a floor start (before the host steps it) is let in at once', () => {
    const { hub, scheduler, host } = room();
    host.session.sendFloor(2);
    const late = peer(hub, 'late', scheduler);
    late.session.join('mimikyu', LOADOUT);
    expect(late.started).toEqual({ seed: 42, floor: 2, localId: 'p3' });
  });
});
