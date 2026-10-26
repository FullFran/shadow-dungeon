import { describe, expect, it } from 'vitest';
import { trialRequestOf } from '../../src/app/shrine-route';
import { startTrial } from '../../src/core/shrine';
import { SPECIES } from '../../src/data/species';
import { parseRoomTrial, type RoomTrial } from '../../src/net/protocol';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';

/** Santuario de los Juramentos in an online room (docs/gdd.md §3, §12): the host picks, everyone picks its own Pokémon, the host starts. */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
  lobbies: number;
  full: boolean;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null, lobbies: 0, full: false };
  session.onStart((start) => (p.started = start));
  session.onLobby(() => p.lobbies++);
  session.onFull(() => (p.full = true));
  return p;
}

const AEGISLASH: RoomTrial = { kind: 'boss', id: 'aegislash', difficulty: 'hard' };

function room(): { hub: MemoryHub<string>; scheduler: FakeScheduler; host: Peer; guest: Peer } {
  const scheduler = createFakeScheduler();
  const hub = createMemoryHub<string>();
  const host = peer(hub, 'h', scheduler);
  host.session.host(42, 1, 'mimikyu', { lobby: true });
  const guest = peer(hub, 'g', scheduler);
  guest.session.join('mimikyu', SPECIES.mimikyu.defaultLoadout);
  return { hub, scheduler, host, guest };
}

describe('shrine trials in an online room', () => {
  it('the guest sees the host pick read-only, then both start the same trial with party scaling', () => {
    const { host, guest } = room();
    expect(guest.session.trial()).toBeNull();
    host.session.setDifficulty('hard');
    host.session.setTrial(AEGISLASH);
    expect(guest.session.trial()).toEqual(AEGISLASH);
    // A guest cannot pick or start one.
    guest.session.setTrial({ kind: 'gauntlet', id: 'oaths', difficulty: 'easy' });
    expect(host.session.trial()).toEqual(AEGISLASH);
    // Each player picks its own Pokémon in the loadout; the host's roster follows.
    guest.session.repick('zorua', SPECIES.zorua.defaultLoadout);
    expect(host.session.roster().find((r) => r.id === 'p2')?.species).toBe('zorua');
    host.session.repick('cubone', SPECIES.cubone.defaultLoadout);
    expect(guest.session.roster().find((r) => r.id === 'p1')?.species).toBe('cubone');

    const request = trialRequestOf(AEGISLASH)!;
    host.session.begin(request.stops[0]!.dungeon, 77, AEGISLASH);
    expect(guest.started).toMatchObject({ seed: 77, floor: 1, dungeon: request.stops[0]!.dungeon, difficulty: 'hard', localId: 'p2', trial: AEGISLASH });
    const party = host.session.roster().length;
    expect(party).toBe(2);
    // Both peers build the same arena: the same boss, scaled for two.
    const hostWorld = startTrial(77, { species: 'cubone', difficulty: 'hard', localId: 'p1', role: 'host', party }, request.stops).world;
    const guestRequest = trialRequestOf(guest.started!.trial!)!;
    const guestWorld = startTrial(77, { species: 'zorua', difficulty: 'hard', localId: 'p2', role: 'guest', party: guest.session.roster().length }, guestRequest.stops).world;
    const solo = startTrial(77, { species: 'cubone', difficulty: 'hard' }, request.stops).world;
    const boss = (w: typeof solo) => w.enemies.find((e) => e.boss)!;
    expect(boss(hostWorld).species).toBe('aegislash');
    expect(boss(guestWorld)).toMatchObject({ species: 'aegislash', maxHp: boss(hostWorld).maxHp });
    expect(boss(hostWorld).maxHp).toBeGreaterThan(boss(solo).maxHp);
    expect(guestWorld.player.species).toBe('zorua');

    // The end: the host brings the room back to its town; the guest follows.
    host.session.reopenLobby(5);
    expect(guest.lobbies).toBe(1);
    expect(host.session.inLobby()).toBe(true);
    // A plain dungeon run afterwards carries no trial.
    guest.started = null;
    host.session.begin('misty-forest', 9);
    expect(guest.started).not.toBeNull();
    expect(guest.started!.trial).toBeUndefined();
  });

  it('a late older peer is turned away while a trial runs, a current one joins it', () => {
    const { hub, scheduler, host } = room();
    host.session.setTrial(AEGISLASH);
    host.session.begin('crypt-of-the-sword-king', 3, AEGISLASH);
    const seen: string[] = [];
    const old = hub.connect('o');
    old.onMessage((_from, wire) => seen.push(JSON.parse(wire).t));
    old.send(JSON.stringify({ t: 'hello', species: 'litwick', loadout: [] }), true);
    expect(seen).toContain('full');
    expect(host.session.roster().some((r) => r.peer === 'o')).toBe(false);
    const late = peer(hub, 'l', scheduler);
    late.session.join('litwick', SPECIES.litwick.defaultLoadout);
    expect(late.started?.trial).toEqual(AEGISLASH);
  });

  it('reads a room trial from the wire only when it is well formed', () => {
    expect(parseRoomTrial(AEGISLASH)).toEqual(AEGISLASH);
    expect(parseRoomTrial({ kind: 'herald', id: '12345', difficulty: 'nope' })).toEqual({ kind: 'herald', id: '12345', difficulty: 'easy' });
    for (const bad of [null, 'x', 3, [], { kind: 'run', id: 'a' }, { kind: 'boss', id: 'BAD ID' }, { kind: 'boss', id: 'x'.repeat(41) }, { kind: 'boss' }]) expect(parseRoomTrial(bad)).toBeNull();
    expect(trialRequestOf({ kind: 'boss', id: 'nobody', difficulty: 'easy' })).toBeNull();
    expect(trialRequestOf({ kind: 'gauntlet', id: 'guardians', difficulty: 'easy' })?.stops.length).toBe(4);
    expect(trialRequestOf({ kind: 'herald', id: 'abc', difficulty: 'easy' })).toBeNull();
    expect(trialRequestOf({ kind: 'herald', id: '12', difficulty: 'easy' })?.stops[0]?.heraldSeed).toBe(12);
  });
});
