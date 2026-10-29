import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/data/species';
import { decodeMessage } from '../../src/net/protocol';
import { createSession, type NetSession, type RefusedReason } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type MemoryHub } from '../../src/net/transport';
import { CONTENT_HASH, PROTOCOL_VERSION } from '../../src/net/version';

/** Issue #7: the build label travels in the co-op handshake, so a version refusal names both builds. */
const LOADOUT = SPECIES.mimikyu.defaultLoadout;
const SAME = { v: PROTOCOL_VERSION, c: CONTENT_HASH };

interface Peer {
  session: NetSession;
  refused: { reason: RefusedReason; theirs?: string } | null;
  turnedAway: Array<{ name: string; theirs?: string }>;
}

function peer(hub: MemoryHub<string>, id: string, build?: string): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler: createFakeScheduler(), ...(build ? { build } : {}) });
  const p: Peer = { session, refused: null, turnedAway: [] };
  session.onFull((reason, theirs) => (p.refused = { reason, ...(theirs ? { theirs } : {}) }));
  session.onVersionRefused((name, theirs) => p.turnedAway.push({ name, ...(theirs ? { theirs } : {}) }));
  return p;
}

/** A raw peer on the hub: what it receives, parsed. */
function spy(hub: MemoryHub<string>, id: string) {
  const transport = hub.connect(id);
  const seen: Array<Record<string, unknown>> = [];
  transport.onMessage((_from, wire) => seen.push(JSON.parse(wire) as Record<string, unknown>));
  return { transport, seen };
}

describe('build label in the co-op handshake', () => {
  it('the hello carries the sender build label', () => {
    const hub = createMemoryHub<string>();
    const host = spy(hub, 'h');
    const guest = peer(hub, 'g', 'v0.9.1 · abc1234');
    guest.session.join('mimikyu', LOADOUT);
    expect(host.seen.find((m) => m.t === 'hello')).toMatchObject({ t: 'hello', b: 'v0.9.1 · abc1234', ...SAME });
  });

  it('a version refusal carries the host build label, and the guest reads it', () => {
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', 'v0.9.1 · abc1234');
    host.session.host(1, 1, 'mimikyu', { lobby: true });
    const other = spy(hub, 'o');
    other.transport.send(JSON.stringify({ t: 'hello', species: 'mimikyu', loadout: [], v: PROTOCOL_VERSION, c: 'deadbeef', b: 'v0.8.0 · 0ld0ld0' }), true);
    expect(other.seen).toContainEqual({ t: 'full', peer: 'o', reason: 'version', b: 'v0.9.1 · abc1234' });
    expect(host.turnedAway).toEqual([{ name: '', theirs: 'v0.8.0 · 0ld0ld0' }]);

    const guestHub = createMemoryHub<string>();
    const guest = peer(guestHub, 'g');
    guest.session.join('mimikyu', LOADOUT);
    guestHub.connect('h').send(JSON.stringify({ t: 'full', peer: 'g', reason: 'version', b: 'v0.9.1 · abc1234' }), true);
    expect(guest.refused).toEqual({ reason: 'version', theirs: 'v0.9.1 · abc1234' });
  });

  it('a guest refusing a host lobby of another version reads the host label from it', () => {
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g', 'v0.9.1 · abc1234');
    guest.session.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'lobby', players: [{ peer: 'h', id: 'p1', species: 'mimikyu' }], v: PROTOCOL_VERSION, c: 'deadbeef', b: 'v0.9.2 · fff0000' }), true);
    expect(guest.refused).toEqual({ reason: 'version', theirs: 'v0.9.2 · fff0000' });
  });

  it('an old-style hello without a label is still let in on the same version', () => {
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', 'v0.9.1 · abc1234');
    host.session.host(1, 1, 'mimikyu', { lobby: true });
    const old = spy(hub, 'o');
    old.transport.send(JSON.stringify({ t: 'hello', species: 'mimikyu', loadout: [], ...SAME }), true);
    expect(host.session.roster().map((r) => r.peer)).toEqual(['h', 'o']);
    expect(host.turnedAway).toEqual([]);
  });

  it('an old-style refusal without a label still refuses, with no label', () => {
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g', 'v0.9.1 · abc1234');
    guest.session.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'full', peer: 'g', reason: 'version' }), true);
    expect(guest.refused).toEqual({ reason: 'version' });
  });

  it('a plain full room still reads as full, without a label', () => {
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g');
    guest.session.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'full', peer: 'g' }), true);
    expect(guest.refused).toEqual({ reason: 'full' });
  });

  it('drops a label that is too long or carries odd characters', () => {
    const hello = (b: unknown) => decodeMessage(JSON.stringify({ t: 'hello', species: 'mimikyu', loadout: [], b }));
    expect(hello('v0.9.1 · abc1234')).toMatchObject({ b: 'v0.9.1 · abc1234' });
    expect(hello('x'.repeat(41))).not.toHaveProperty('b');
    expect(hello('<script>')).not.toHaveProperty('b');
    expect(hello(7)).not.toHaveProperty('b');
    expect(decodeMessage(JSON.stringify({ t: 'full', peer: 'g', reason: 'version', b: '<b>' }))).toEqual({ t: 'full', peer: 'g', reason: 'version' });
  });
});
