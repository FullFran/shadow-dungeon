import { describe, expect, it } from 'vitest';
import { applyRemotePlayers, playerSnapshot } from '../../src/core/sync';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { decodeMessage, encodeMessage, type RosterEntry } from '../../src/net/protocol';
import { createSession, type NetSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';
import { CONTENT_HASH, PROTOCOL_VERSION } from '../../src/net/version';

/** Gender in co-op (odd/tasks/pokemon-gender.md): the path of the shiny skin; a peer that sends nothing reads as male. */
const LOADOUT = ['shadow-claw', 'play-rough'] as const;
const world = (female: boolean, shiny = false) => createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2', species: 'shinx', female, shiny });

describe('gender on the wire', () => {
  it('does not bump the protocol: it is optional and cosmetic, so builds with and without it still play together', () => {
    expect(PROTOCOL_VERSION).toBe(5);
    expect(CONTENT_HASH).toMatch(/^[0-9a-f]{8}$/);
  });

  it('hello and roster entries carry it only when it is exactly true', () => {
    const hello = decodeMessage(encodeMessage({ t: 'hello', species: 'shinx', loadout: [], female: true }));
    expect(hello?.t === 'hello' && hello.female).toBe(true);
    for (const female of [undefined, false, 'yes', 1]) {
      const plain = decodeMessage(JSON.stringify({ t: 'hello', species: 'shinx', loadout: [], female }));
      expect(plain?.t === 'hello' && plain.female, String(female)).toBeUndefined();
    }
    const lobby = decodeMessage(JSON.stringify({ t: 'lobby', players: [{ peer: 'a', id: 'p1', species: 'shinx', female: true }, { peer: 'b', id: 'p2', species: 'abra', female: 'x' }, { peer: 'c', id: 'p3', species: 'luxio' }] }));
    expect(lobby?.t === 'lobby' && lobby.players.map((p) => p.female)).toEqual([true, undefined, undefined]);
  });

  it('a state carries it to the teammate, whose copy of the player has it', () => {
    for (const female of [true, false]) {
      for (const shiny of [true, false]) {
        const decoded = decodeMessage(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world(female, shiny)) }));
        if (decoded?.t !== 'state') throw new Error('no state');
        expect(decoded.p.female === true).toBe(female);
        expect(decoded.p.shiny === true).toBe(shiny);
        const host = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10) });
        const seen = applyRemotePlayers(host, [decoded.p]);
        expect(seen.remotes[0]!.player.female === true).toBe(female);
        expect(seen.remotes[0]!.player.shiny === true).toBe(shiny);
      }
    }
  });

  it('a teammate who goes back to male stops drawing as female', () => {
    const host = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10) });
    const on = applyRemotePlayers(host, [playerSnapshot(world(true))]);
    expect(on.remotes[0]!.player.female).toBe(true);
    const off = applyRemotePlayers(on, [playerSnapshot(world(false))]);
    expect(off.remotes[0]!.player.female).toBeUndefined();
  });

  it('an older peer sends no field: its state reads as male, and a wrong value too', () => {
    const wire = JSON.parse(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world(false)) })) as Record<string, unknown>;
    expect('fe' in wire).toBe(false);
    for (const fe of [undefined, 0, 2, 'yes', true]) {
      const decoded = decodeMessage(JSON.stringify({ ...wire, fe }));
      expect(decoded?.t === 'state' && decoded.p.female, String(fe)).toBeUndefined();
    }
  });

  it('a player with no gender set sends exactly what it sent before', () => {
    expect(JSON.parse(encodeMessage({ t: 'hello', species: 'shinx', loadout: [] }))).toEqual({ t: 'hello', species: 'shinx', loadout: [] });
    const state = JSON.parse(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world(false)) })) as Record<string, unknown>;
    expect(Object.keys(state).sort()).toEqual(['at', 'f', 'p', 't']);
  });
});

describe('gender in the room roster', () => {
  interface Peer {
    session: NetSession;
    roster: readonly RosterEntry[];
  }
  const peer = (hub: ReturnType<typeof createMemoryHub<string>>, id: string, scheduler: ReturnType<typeof createFakeScheduler>): Peer => {
    const session = createSession({ transport: hub.connect(id), scheduler });
    const p: Peer = { session, roster: [] };
    session.onRoster((roster) => (p.roster = roster));
    return p;
  };

  it('the host and the guests see it, and a repick changes it, whatever the skin does', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'shinx', { lobby: true, female: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('luxio', LOADOUT, 'Ana', false, true);
    expect(guest.roster.map((r) => [r.id, r.species, r.female === true, r.shiny === true])).toEqual([
      ['p1', 'shinx', true, false],
      ['p2', 'luxio', true, false],
    ]);
    guest.session.repick('luxio', LOADOUT, false, false);
    host.session.repick('shinx', LOADOUT, false, false);
    expect(host.roster.map((r) => r.female === true)).toEqual([false, false]);
    expect(guest.roster.map((r) => r.female === true)).toEqual([false, false]);
    guest.session.repick('luxio', LOADOUT, true, true);
    expect(host.roster[1]).toMatchObject({ shiny: true, female: true });
    guest.session.repick('luxio', LOADOUT, true, false);
    expect(host.roster[1]!.shiny).toBe(true);
    expect(host.roster[1]!.female).toBeUndefined();
  });

  it('a guest that does not say reads as male', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'shinx', { lobby: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('luxio', LOADOUT, 'Ana');
    expect(host.roster.map((r) => 'female' in r)).toEqual([false, false]);
  });

  it('a walker in the town keeps it', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(42, 1, 'shinx', { lobby: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('luxio', LOADOUT, 'Ana', false, true);
    guest.session.sendPresence({ map: 'town', pos: vec(1, 1), facing: vec(0, 1), moving: false });
    scheduler.advance(1000);
    guest.session.sendPresence({ map: 'town', pos: vec(2, 1), facing: vec(0, 1), moving: false });
    scheduler.advance(1000);
    const walker = host.session.townWalkers().find((w) => w.id === 'p2');
    expect(walker?.female).toBe(true);
  });
});
