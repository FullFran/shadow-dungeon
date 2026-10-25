import { describe, expect, it } from 'vitest';
import { LagTransport } from '../../src/net/lag';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';
import type { RosterEntry } from '../../src/net/protocol';

/** Room-code lobby on top of the session: the host waits for players, then starts them all with its seed. */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
  roster: readonly RosterEntry[];
  full: boolean;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null, roster: [], full: false };
  session.onStart((start) => (p.started = start));
  session.onRoster((roster) => (p.roster = roster));
  session.onFull(() => (p.full = true));
  return p;
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

describe('lobby', () => {
  it('admits guests without starting them, then starts everyone with the host seed', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'mimikyu', { lobby: true });
    const a = peer(hub, 'a', scheduler);
    const b = peer(hub, 'b', scheduler);
    a.session.join('mimikyu', LOADOUT);
    b.session.join('mimikyu', LOADOUT);
    expect(a.started).toBeNull();
    expect(host.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(a.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(host.session.inLobby()).toBe(true);
    host.session.begin();
    expect(host.session.inLobby()).toBe(false);
    expect(a.started).toEqual({ seed: 42, floor: 1, localId: 'p2' });
    expect(b.started).toEqual({ seed: 42, floor: 1, localId: 'p3' });
  });

  it('tells a fifth player the room is full and leaves the four others alone', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(1, 1, 'mimikyu', { lobby: true });
    const guests = ['a', 'b', 'c', 'd'].map((id) => peer(hub, id, scheduler));
    for (const g of guests) g.session.join('mimikyu', LOADOUT);
    expect(guests.map((g) => g.full)).toEqual([false, false, false, true]);
    expect(host.roster).toHaveLength(4);
    host.session.begin();
    expect(guests.map((g) => g.started?.localId ?? null)).toEqual(['p2', 'p3', 'p4', null]);
  });

  it('a guest that knocked before the host arrived knocks again when the host shows up', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const early = peer(hub, 'a', scheduler);
    early.session.join('mimikyu', LOADOUT);
    const host = peer(hub, 'h', scheduler);
    host.session.host(5, 1, 'mimikyu', { lobby: true });
    expect(early.roster.map((r) => r.id)).toEqual(['p1', 'p2']);
  });

  it('measures the round trip to each peer with ping / pong and counts bytes both ways', () => {
    const scheduler = createFakeScheduler(1000);
    const hub = createMemoryHub<string>();
    const lag = { lagMs: 50, jitterMs: 0, loss: 0, scheduler, random: () => 0.5 };
    const host = createSession({ transport: new LagTransport(hub.connect('h'), lag), scheduler });
    const guest = createSession({ transport: new LagTransport(hub.connect('g'), lag), scheduler });
    host.host(1, 1, 'mimikyu');
    guest.join('mimikyu', LOADOUT);
    scheduler.advance(200);
    guest.ping();
    scheduler.advance(200);
    expect(guest.liveStats().rttMs).toEqual({ h: 100 });
    expect(guest.liveStats().bytesOutPerSec).toBeGreaterThan(0);
    expect(guest.liveStats().bytesInPerSec).toBeGreaterThan(0);
  });

  it('tells guests once when the host leaves, in the lobby or mid-run', () => {
    for (const midRun of [false, true]) {
      const scheduler = createFakeScheduler();
      const hub = createMemoryHub<string>();
      const host = peer(hub, 'h', scheduler);
      host.session.host(1, 1, 'mimikyu', { lobby: true });
      const guest = peer(hub, 'a', scheduler);
      let told = 0;
      guest.session.onHostLeft(() => told++);
      guest.session.join('mimikyu', LOADOUT);
      if (midRun) host.session.begin();
      host.session.leave();
      expect(told).toBe(1);
    }
  });

  it('a guest leaving is not the host leaving', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(1, 1, 'mimikyu');
    const a = peer(hub, 'a', scheduler);
    const b = peer(hub, 'b', scheduler);
    let told = 0;
    a.session.onHostLeft(() => told++);
    a.session.join('mimikyu', LOADOUT);
    b.session.join('mimikyu', LOADOUT);
    b.session.leave();
    expect(told).toBe(0);
  });
});
