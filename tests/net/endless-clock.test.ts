import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type MemoryHub, type FakeScheduler } from '../../src/net/transport';

/** The endless dungeon in a shared run: the host owns the clock and picks the seed (daily or free) at Start. */
function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): { session: NetSession; started: StartInfo | null } {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p = { session, started: null as StartInfo | null };
  session.onStart((start) => (p.started = start));
  return p;
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

describe('endless clock over the network', () => {
  it('the clock message survives the wire', () => {
    expect(decodeMessage(encodeMessage({ t: 'clock', ms: 61_234, floor: 3 }))).toEqual({ t: 'clock', ms: 61_234, floor: 3 });
  });

  it('the host picks the run seed at Start (the daily challenge or a free seed)', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'mimikyu', { lobby: true });
    const a = peer(hub, 'a', scheduler);
    a.session.join('mimikyu', LOADOUT);
    host.session.begin('eclipse-chasm', 777);
    expect(a.started).toEqual({ seed: 777, floor: 1, dungeon: 'eclipse-chasm', localId: 'p2' });
  });

  it('guests take the host clock (the latest one), the host ignores clocks, hostile values are dropped', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'mimikyu', { lobby: true });
    const a = peer(hub, 'a', scheduler);
    a.session.join('mimikyu', LOADOUT);
    host.session.begin('eclipse-chasm');
    expect(a.session.takeClock()).toBeNull();
    host.session.sendClock(300_000, 2);
    host.session.sendClock(299_000, 2);
    expect(a.session.takeClock()).toEqual({ ms: 299_000, floor: 2 });
    expect(a.session.takeClock()).toBeNull();
    expect(host.session.takeClock()).toBeNull();
    // A guest cannot set anyone's clock; a bad value never reaches the run.
    const rogue = hub.connect('x');
    rogue.send(JSON.stringify({ t: 'clock', ms: 'soon', floor: 2 }), true);
    rogue.send(JSON.stringify({ t: 'clock', ms: -5, floor: 2 }), true);
    rogue.send(JSON.stringify({ t: 'clock', ms: 1, floor: 2 }), true);
    expect(a.session.takeClock()).toBeNull();
  });
});
