import { describe, expect, it } from 'vitest';
import { TrysteroTransport, type RoomLike } from '../../src/adapters/trystero-transport';
import { SPECIES } from '../../src/data/species';
import { linkKind, selectedPair } from '../../src/net/diagnostics';
import { createSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';

/** Issue #6: what the session and the transport know about the connection, for the technical report. */
const LOADOUT = SPECIES.mimikyu.defaultLoadout;

/** Chromium-style stats: a transport naming its selected pair, the pair and both candidates (with addresses, which must not leak). */
function chromiumStats(local: string, remote: string, protocol = 'udp', relayProtocol?: string) {
  return [
    { id: 'T1', type: 'transport', selectedCandidatePairId: 'CP1' },
    { id: 'CP0', type: 'candidate-pair', state: 'failed', localCandidateId: 'L0', remoteCandidateId: 'R0' },
    { id: 'CP1', type: 'candidate-pair', state: 'succeeded', localCandidateId: 'L1', remoteCandidateId: 'R1' },
    { id: 'L0', type: 'local-candidate', candidateType: 'host', protocol: 'udp', address: '192.168.1.23' },
    { id: 'L1', type: 'local-candidate', candidateType: local, protocol, address: '81.40.12.7', ip: '81.40.12.7', port: 51000, ...(relayProtocol ? { relayProtocol } : {}) },
    { id: 'R0', type: 'remote-candidate', candidateType: 'host', protocol: 'udp', address: '10.0.0.4' },
    { id: 'R1', type: 'remote-candidate', candidateType: remote, protocol, address: '2a02:9130::1', port: 62000 },
  ];
}

describe('selected ICE pair', () => {
  it('reads the pair the transport selected: candidate kinds and protocol only', () => {
    const link = selectedPair(chromiumStats('srflx', 'srflx'));
    expect(link).toEqual({ local: 'srflx', remote: 'srflx', protocol: 'udp' });
    expect(linkKind(link!)).toBe('direct');
  });

  it('names a relay and how this end reaches it', () => {
    const link = selectedPair(chromiumStats('relay', 'srflx', 'udp', 'tcp'));
    expect(link).toEqual({ local: 'relay', remote: 'srflx', protocol: 'udp', relayProtocol: 'tcp' });
    expect(linkKind(link!)).toBe('relay');
  });

  it('falls back to the nominated pair that succeeded (Firefox has no selectedCandidatePairId)', () => {
    const stats = chromiumStats('host', 'prflx').filter((r) => r.type !== 'transport').map((r) => (r.id === 'CP1' ? { ...r, nominated: true } : r));
    expect(selectedPair(stats)).toEqual({ local: 'host', remote: 'prflx', protocol: 'udp' });
  });

  it('is null before ICE picked a pair', () => {
    expect(selectedPair([{ id: 'CP0', type: 'candidate-pair', state: 'in-progress', localCandidateId: 'L', remoteCandidateId: 'R' }])).toBeNull();
    expect(selectedPair([])).toBeNull();
  });
});

describe('session diagnostics', () => {
  it('a guest: role, admitted, roster, peers with round trip and silence, and its transitions', () => {
    const scheduler = createFakeScheduler(1000);
    const hub = createMemoryHub<string>();
    const host = createSession({ transport: hub.connect('h'), scheduler });
    host.host(1, 1, 'mimikyu', { lobby: true, name: 'Paquito' });
    const guest = createSession({ transport: hub.connect('g'), scheduler });
    expect(guest.diagnostics()).toMatchObject({ role: null, admitted: false, rosterSize: 0, peersConnected: 1 });
    guest.join('mimikyu', LOADOUT, 'Lola');
    scheduler.advance(40);
    guest.ping();
    scheduler.advance(500);
    const d = guest.diagnostics();
    expect(d).toMatchObject({ admitted: true, started: false, refused: null, hostLeft: false, rosterSize: 2, peersConnected: 1 });
    expect(d.peers).toEqual([{ peer: 'h', id: 'p1', rttMs: 0, msSinceLastMessage: 500 }]);
    expect(d.transitions.map((e) => e.event)).toEqual(['knock', 'admitted']);
    expect(JSON.stringify(d)).not.toMatch(/Paquito|Lola/);
  });

  it('the host: its own role, guests admitted, a guest leaving and a version refusal', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = createSession({ transport: hub.connect('h'), scheduler });
    host.host(1, 1, 'mimikyu', { lobby: true });
    const guest = createSession({ transport: hub.connect('g'), scheduler });
    guest.join('mimikyu', LOADOUT);
    hub.connect('o').send(JSON.stringify({ t: 'hello', species: 'mimikyu', loadout: [], v: 0, c: 'x' }), true);
    guest.leave();
    const d = host.diagnostics();
    expect(d).toMatchObject({ role: 'host', localId: 'p1', admitted: true, started: true, rosterSize: 1 });
    expect(d.transitions.map((e) => e.event)).toEqual(['host', 'peerJoin', 'peerJoin', 'versionRefused', 'peerLeave']);
  });

  it('a refused guest and a host that left are in its transitions', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const guest = createSession({ transport: hub.connect('g'), scheduler });
    guest.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'full', peer: 'g', reason: 'version' }), true);
    expect(guest.diagnostics().refused).toBe('version');
    expect(guest.diagnostics().transitions.map((e) => e.event)).toContain('refused:version');
  });

  it('keeps only the most recent transitions', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = createSession({ transport: hub.connect('h'), scheduler });
    host.host(1, 1, 'mimikyu', { lobby: true });
    for (let i = 0; i < 60; i++) hub.connect(`x${i}`).close();
    const events = host.diagnostics().transitions;
    expect(events.length).toBeLessThanOrEqual(40);
    expect(events.at(-1)?.event).toBe('peerLeave');
  });
});

describe('Trystero transport links', () => {
  function fakeRoom(connections: Record<string, unknown>): RoomLike {
    return {
      makeAction: () => ({ send: () => Promise.resolve(), onMessage: null }),
      getPeers: () => connections,
      onPeerJoin: null,
      onPeerLeave: null,
      leave: () => Promise.resolve(),
    };
  }

  /** A peer connection stand-in: its stats, and ICE state changes the test fires. */
  function fakeConnection(stats: Array<Record<string, unknown>>) {
    const listeners: Array<() => void> = [];
    const pc = {
      iceConnectionState: 'checking',
      getStats: () => Promise.resolve(new Map(stats.map((s) => [s.id as string, s]))),
      addEventListener: (type: string, fn: () => void) => {
        if (type === 'iceconnectionstatechange') listeners.push(fn);
      },
    };
    return { pc, change: (state: string) => ((pc.iceConnectionState = state), listeners.forEach((fn) => fn())) };
  }

  it('reads the selected pair per peer, and records ICE state changes', async () => {
    const a = fakeConnection(chromiumStats('relay', 'srflx', 'udp', 'udp'));
    const b = { getStats: () => Promise.reject(new Error('closed')) };
    const room = fakeRoom({ a: a.pc, b });
    let now = 100;
    const transport = new TrysteroTransport(room, 'me', () => now);
    room.onPeerJoin?.('a');
    now = 250;
    a.change('connected');
    expect(await transport.links()).toEqual({ a: { local: 'relay', remote: 'srflx', protocol: 'udp', relayProtocol: 'udp' }, b: null });
    expect(transport.linkEvents()).toEqual([
      { tMs: 100, event: 'ice:checking' },
      { tMs: 250, event: 'ice:connected' },
    ]);
  });
});
