import { describe, expect, it } from 'vitest';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { CONTENT_HASH, PROTOCOL_VERSION } from '../../src/net/version';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';

/** The room's difficulty tier: the host picks it, guests see it in the town and play it (docs/gdd.md §9). */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null };
  session.onStart((start) => (p.started = start));
  return p;
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

describe('difficulty over the network', () => {
  it('shows the host tier to guests in the town and starts them on it', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(9, 1, 'mimikyu', { lobby: true, difficulty: 'hard' });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    expect(guest.session.difficulty()).toBe('hard');
    // The host changes its mind in the town: the guest sees it at once.
    host.session.setDifficulty('nightmare');
    expect(host.session.difficulty()).toBe('nightmare');
    expect(guest.session.difficulty()).toBe('nightmare');
    host.session.begin('crypt-of-the-sword-king');
    expect(guest.started?.difficulty).toBe('nightmare');
  });

  it('a guest cannot change the room tier', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(9, 1, 'mimikyu', { lobby: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    guest.session.setDifficulty('nightmare');
    expect(host.session.difficulty()).toBe('easy');
    expect(guest.session.difficulty()).toBe('easy');
  });

  it('an easy host (or an older one) sends no tier at all, which reads as easy', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(3, 1, 'mimikyu', { lobby: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    host.session.begin();
    expect(guest.started).toEqual({ seed: 3, floor: 1, localId: 'p2' });
    expect(guest.session.difficulty()).toBe('easy');
  });

  it('keeps the tier optional on the wire: an old start parses, an unknown tier reads as easy', () => {
    const old = decodeMessage(JSON.stringify({ t: 'start', seed: 1, floor: 1, players: [] }));
    expect(old && old.t === 'start' && old.difficulty).toBeUndefined();
    const hard = decodeMessage(encodeMessage({ t: 'start', seed: 1, floor: 1, difficulty: 'hard', players: [] }));
    expect(hard && hard.t === 'start' && hard.difficulty).toBe('hard');
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'start', seed: 5, floor: 1, difficulty: 'legendary', players: [{ peer: 'g', id: 'p2', species: 'mimikyu' }], v: PROTOCOL_VERSION, c: CONTENT_HASH }), true);
    expect(guest.started).not.toBeNull();
    expect(guest.started?.difficulty).toBeUndefined();
    expect(guest.session.difficulty()).toBe('easy');
  });
});
