import { describe, expect, it } from 'vitest';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';
import { decodeMessage, encodeMessage, type NetMessage, type RosterEntry } from '../../src/net/protocol';

/** The online lobby is the town: names in the hello and the roster, walkers' presence at ~10 Hz, and new rounds in the same room. */
interface Peer {
  session: NetSession;
  started: StartInfo[];
  roster: readonly RosterEntry[];
  relobbies: number;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: [], roster: [], relobbies: 0 };
  session.onStart((start) => p.started.push(start));
  session.onRoster((roster) => (p.roster = roster));
  session.onLobby(() => p.relobbies++);
  return p;
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

describe('town presence on the wire', () => {
  it('round-trips compactly, rounding positions and directions', () => {
    const message: NetMessage = { t: 'town', at: 1234.56, map: 'mirador', pos: { x: 100.04, y: 50.26 }, facing: { x: 0.70711, y: -0.70711 }, moving: true };
    const wire = encodeMessage(message);
    expect(JSON.parse(wire)).toEqual({ t: 'town', at: 1234.6, m: 'mirador', p: [100, 50.3, 0.707, -0.707, 1] });
    expect(decodeMessage(wire)).toEqual({ t: 'town', at: 1234.6, map: 'mirador', pos: { x: 100, y: 50.3 }, facing: { x: 0.707, y: -0.707 }, moving: true });
  });

  it('drops malformed presence instead of trusting it', () => {
    expect(decodeMessage(JSON.stringify({ t: 'town', at: 1, m: 'refugio', p: 'x' }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'town', at: 1, m: 'refugio', p: [1, 'a', 0, 1, 0] }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'town', at: 1, m: 'x'.repeat(100), p: [1, 1, 0, 1, 0] }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'town', at: 'now', m: 'refugio', p: [1, 1, 0, 1, 0] }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'town', at: 1, m: 'refugio', p: [Infinity, 1, 0, 1, 0] }))).toBeNull();
  });

  it('keeps hellos and rosters without names readable (older peers)', () => {
    expect(decodeMessage(JSON.stringify({ t: 'hello', species: 'zorua', loadout: [] }))).toEqual({ t: 'hello', species: 'zorua', loadout: [] });
    const roster = [{ peer: 'h', id: 'p1', species: 'cubone' }];
    expect(decodeMessage(JSON.stringify({ t: 'lobby', players: roster }))).toEqual({ t: 'lobby', players: roster });
  });
});

describe('town lobby session', () => {
  function room() {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'cubone', { lobby: true, name: 'Anfitriona' });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('zorua', LOADOUT, ' Fran\u0000 ');
    return { scheduler, hub, host, guest };
  }

  it('carries sanitised names from the hello into everyone roster', () => {
    const { host, guest } = room();
    expect(host.roster.map((r) => r.name)).toEqual(['Anfitriona', 'Fran']);
    expect(guest.roster.map((r) => r.name)).toEqual(['Anfitriona', 'Fran']);
  });

  it('lists a guest without a name (older client) with no name, for the fallback', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'cubone', { lobby: true });
    const old = peer(hub, 'o', scheduler);
    old.session.join('zorua', LOADOUT);
    expect(host.roster.map((r) => r.name)).toEqual([undefined, undefined]);
  });

  it('shows each other walker (not oneself) with species and name, interpolated between presences', () => {
    const { scheduler, host, guest } = room();
    guest.session.sendPresence({ map: 'refugio', pos: { x: 0, y: 100 }, facing: { x: 1, y: 0 }, moving: true });
    scheduler.advance(100);
    guest.session.sendPresence({ map: 'refugio', pos: { x: 100, y: 100 }, facing: { x: 1, y: 0 }, moving: true });
    // Drawn RENDER_DELAY in the past: half way between the two samples.
    scheduler.advance(100 + host.session.townDelayMs() - 150);
    const [walker, ...rest] = host.session.townWalkers();
    expect(rest).toEqual([]);
    expect(walker).toMatchObject({ peer: 'g', id: 'p2', species: 'zorua', name: 'Fran', map: 'refugio', moving: true });
    expect(walker!.pos.x).toBeCloseTo(50, 0);
    expect(guest.session.townWalkers()).toEqual([]);
  });

  it('jumps instead of sliding when a walker changes maps', () => {
    const { scheduler, host, guest } = room();
    guest.session.sendPresence({ map: 'refugio', pos: { x: 1000, y: 320 }, facing: { x: 1, y: 0 }, moving: true });
    scheduler.advance(100);
    guest.session.sendPresence({ map: 'ruinas', pos: { x: 48, y: 320 }, facing: { x: 1, y: 0 }, moving: true });
    scheduler.advance(host.session.townDelayMs() + 10);
    expect(host.session.townWalkers()[0]).toMatchObject({ map: 'ruinas', pos: { x: 48, y: 320 } });
  });

  it('forgets a walker who leaves', () => {
    const { scheduler, host, guest } = room();
    guest.session.sendPresence({ map: 'refugio', pos: { x: 0, y: 0 }, facing: { x: 1, y: 0 }, moving: false });
    scheduler.advance(400);
    expect(host.session.townWalkers()).toHaveLength(1);
    guest.session.leave();
    expect(host.session.townWalkers()).toEqual([]);
  });

  it('lets only the host start the run', () => {
    const { host, guest } = room();
    guest.session.begin('misty-forest');
    expect(guest.started).toEqual([]);
    expect(host.session.inLobby()).toBe(true);
    expect(host.session.canLead()).toBe(true);
    expect(guest.session.canLead()).toBe(false);
    host.session.begin('misty-forest');
    expect(guest.started).toEqual([{ seed: 42, floor: 1, dungeon: 'misty-forest', localId: 'p2' }]);
    expect(host.session.canLead()).toBe(false);
  });

  it('brings everyone back to the town lobby after a run, then starts a new round in the same room', () => {
    const { host, guest } = room();
    host.session.begin('crypt-of-the-sword-king');
    host.session.reopenLobby(77);
    expect(guest.relobbies).toBe(1);
    expect(host.session.inLobby()).toBe(true);
    expect(guest.roster.map((r) => r.id)).toEqual(['p1', 'p2']);
    host.session.begin('misty-forest');
    expect(guest.started.map((s) => [s.seed, s.dungeon])).toEqual([
      [42, 'crypt-of-the-sword-king'],
      [77, 'misty-forest'],
    ]);
  });

  it('a guest hears the room close once and then the host leave once, so its run ends (and is paid) exactly once', () => {
    const { host, guest } = room();
    let left = 0;
    guest.session.onHostLeft(() => left++);
    host.session.begin('crypt-of-the-sword-king');
    host.session.reopenLobby(77);
    // A lobby again (a tier change, a repick) is not another run closing.
    host.session.setDifficulty('hard');
    host.session.leave();
    expect(guest.relobbies).toBe(1);
    expect(left).toBe(1);
  });

  it("a Sima round's clock and seed never leak into the next round from the town", () => {
    const { host, guest } = room();
    host.session.begin('eclipse-chasm', 9001);
    host.session.sendClock(0, 12);
    // The run ended before the guest's game read the last clock; back in town, a new round.
    host.session.reopenLobby(77);
    expect(guest.session.takeClock()).toBeNull();
    host.session.begin('eclipse-chasm', 9002);
    expect(guest.started.map((s) => [s.seed, s.dungeon])).toEqual([
      [9001, 'eclipse-chasm'],
      [9002, 'eclipse-chasm'],
    ]);
  });

  it('lets a late joiner in while the room is back in town', () => {
    const { scheduler, hub, host } = room();
    host.session.begin('crypt-of-the-sword-king');
    host.session.reopenLobby(5);
    const late = peer(hub, 'l', scheduler);
    late.session.join('litwick', LOADOUT, 'Tarde');
    expect(late.started).toEqual([]);
    expect(late.roster.map((r) => r.name)).toEqual(['Anfitriona', 'Fran', 'Tarde']);
  });
});
