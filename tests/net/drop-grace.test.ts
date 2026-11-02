import { describe, expect, it } from 'vitest';
import { createSession, PEER_GRACE_MS, type HostGone, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';
import type { RosterEntry } from '../../src/net/protocol';
import { startRun } from '../../src/core/run';

/**
 * Owner report (2026-11-02, v0.11.0): a guest was thrown out to the town while
 * playing online. A short network blip makes Trystero report a peer leave
 * (ICE "disconnected" for 5 s, or "failed"); the session took that as the
 * host leaving and ended the guest's room. Now a link drop opens a grace
 * window: only an explicit `leave` or the window running out ends the room.
 */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
  roster: readonly RosterEntry[];
  gone: HostGone[];
  reconnecting: boolean[];
}

const LOADOUT = ['shadow-claw', 'play-rough'] as const;

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null, roster: [], gone: [], reconnecting: [] };
  session.onStart((start) => (p.started = start));
  session.onRoster((roster) => (p.roster = roster));
  session.onHostLeft((why) => p.gone.push(why));
  session.onReconnecting((on) => p.reconnecting.push(on));
  return p;
}

/** A room with its host and one guest, mid-run (or in the town lobby). */
function room(midRun = true) {
  const scheduler = createFakeScheduler();
  const hub = createMemoryHub<string>();
  const host = peer(hub, 'h', scheduler);
  host.session.host(9, 1, 'mimikyu', { lobby: true });
  const guest = peer(hub, 'a', scheduler);
  guest.session.join('mimikyu', LOADOUT);
  if (midRun) {
    host.session.begin();
    host.session.afterStep(startRun(9, { localId: 'p1', role: 'host' }).world, 1);
  }
  return { scheduler, hub, host, guest };
}

describe('a dropped link gets a grace window before anyone is gone', () => {
  for (const midRun of [true, false]) {
    it(`a host drop shorter than the window does not end the guest's room, and the guest keeps its place (${midRun ? 'mid-run' : 'town lobby'})`, () => {
      const { scheduler, hub, host, guest } = room(midRun);
      hub.drop('h');
      expect(guest.session.reconnecting()).toBe(true);
      expect(guest.reconnecting).toEqual([true]);
      scheduler.advance(PEER_GRACE_MS - 1000);
      hub.restore('h');
      scheduler.advance(PEER_GRACE_MS * 2);
      expect(guest.gone).toEqual([]);
      expect(guest.session.reconnecting()).toBe(false);
      expect(guest.reconnecting).toEqual([true, false]);
      expect(guest.session.diagnostics().hostLeft).toBe(false);
      expect(host.roster.map((r) => r.peer)).toEqual(['h', 'a']);
      expect(guest.roster.map((r) => r.peer)).toEqual(['h', 'a']);
    });
  }

  it('a host drop longer than the window ends the room once, as a lost connection', () => {
    const { scheduler, hub, guest } = room();
    hub.drop('h');
    scheduler.advance(PEER_GRACE_MS - 1);
    expect(guest.gone).toEqual([]);
    scheduler.advance(1);
    expect(guest.gone).toEqual(['lost']);
    expect(guest.session.reconnecting()).toBe(false);
    // The link coming back afterwards changes nothing: the room is over for this guest.
    hub.restore('h');
    scheduler.advance(PEER_GRACE_MS * 2);
    expect(guest.gone).toEqual(['lost']);
  });

  it('an explicit leave ends the room at once, even while reconnecting', () => {
    const { scheduler, host, guest } = room();
    host.session.leave();
    expect(guest.gone).toEqual(['left']);
    scheduler.advance(PEER_GRACE_MS * 2);
    expect(guest.gone).toEqual(['left']);
  });

  it('a guest drop and return within the window keeps its roster slot (no leave sent to the others)', () => {
    const { scheduler, hub, host, guest } = room();
    const other = peer(hub, 'b', scheduler);
    other.session.join('mimikyu', LOADOUT);
    host.session.sendFloor(2);
    expect(host.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    hub.drop('a');
    scheduler.advance(PEER_GRACE_MS - 1000);
    expect(host.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(other.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    hub.restore('a');
    scheduler.advance(PEER_GRACE_MS * 2);
    expect(host.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(other.roster.map((r) => r.id)).toEqual(['p1', 'p2', 'p3']);
    expect(guest.started?.localId).toBe('p2');
    expect(guest.gone).toEqual([]);
    expect(other.gone).toEqual([]);
  });

  it('a guest gone past the window is dropped from the roster, and the others are told', () => {
    const { scheduler, hub, host } = room();
    const other = peer(hub, 'b', scheduler);
    other.session.join('mimikyu', LOADOUT);
    host.session.sendFloor(2);
    hub.drop('a');
    scheduler.advance(PEER_GRACE_MS);
    expect(host.roster.map((r) => r.id)).toEqual(['p1', 'p3']);
    expect(other.roster.map((r) => r.id)).toEqual(['p1', 'p3']);
    expect(other.gone).toEqual([]);
  });

  it('a resync for one guest does not tell a held guest to wait a second time', () => {
    const { scheduler, hub, host, guest } = room();
    const other = peer(hub, 'b', scheduler);
    let waits = 0;
    other.session.onWait(() => waits++);
    other.session.join('mimikyu', LOADOUT);
    expect(waits).toBe(1);
    hub.drop('a');
    scheduler.advance(1000);
    hub.restore('a');
    expect(waits).toBe(1);
    expect(other.session.held()).toBe(true);
    expect(guest.gone).toEqual([]);
    expect(host.roster.map((r) => r.peer)).toEqual(['h', 'a']);
  });

  // Verifier B1: a reload is a new peer id; the old one's held slot must not turn the reloaded page away as "full".
  it('a guest reloading its page in a full 4-player room gets back in (the away slot gives way)', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(9, 1, 'mimikyu', { lobby: true });
    for (const id of ['a', 'b', 'c']) peer(hub, id, scheduler).session.join('mimikyu', LOADOUT);
    expect(host.roster).toHaveLength(4);
    hub.drop('c');
    const back = peer(hub, 'c2', scheduler);
    const refused: string[] = [];
    back.session.onFull((why) => refused.push(why));
    back.session.join('mimikyu', LOADOUT);
    expect(refused).toEqual([]);
    expect(host.roster.map((r) => r.peer)).toEqual(['h', 'a', 'b', 'c2']);
    // A full room with nobody away still turns a fifth player away.
    const fifth = peer(hub, 'e', scheduler);
    const turned: string[] = [];
    fifth.session.onFull((why) => turned.push(why));
    fifth.session.join('mimikyu', LOADOUT);
    expect(turned).toEqual(['full']);
  });

  // Verifier B2: away while the host ended the run and began the next one: the guest follows the new run.
  it('a guest away while the host ends the run and begins the next one follows the new run', () => {
    const { scheduler, hub, host, guest } = room();
    const seeds: number[] = [];
    let relobbies = 0;
    guest.session.onStart((s) => seeds.push(s.seed));
    guest.session.onLobby(() => relobbies++);
    hub.drop('a');
    host.session.reopenLobby(42);
    host.session.begin();
    scheduler.advance(5000);
    hub.restore('a');
    expect(seeds).toEqual([42]);
    expect(guest.started?.seed).toBe(42);
    // Its old run ends first (paid once, as when the room goes back to the town), then the new one starts.
    expect(relobbies).toBe(1);
    // The same run's start heard again changes nothing.
    hub.drop('a');
    scheduler.advance(1000);
    hub.restore('a');
    expect(seeds).toEqual([42]);
    expect(relobbies).toBe(1);
  });

  it('a guest leaving the room town on purpose is gone at once, without a grace window', () => {
    const { host, guest } = room(false);
    guest.session.leave();
    expect(host.roster.map((r) => r.peer)).toEqual(['h']);
  });

  it('a guest that comes back is brought up to date with what it missed (the floor the host moved to)', () => {
    const { scheduler, hub, host, guest } = room();
    hub.drop('a');
    host.session.sendFloor(3);
    expect(guest.session.takeFloorChange()).toBeNull();
    scheduler.advance(2000);
    hub.restore('a');
    expect(guest.session.takeFloorChange()).toBe(3);
  });

  it('a guest that comes back to the town finds the run the host began meanwhile', () => {
    const { scheduler, hub, host, guest } = room(false);
    hub.drop('a');
    host.session.begin('misty-forest');
    expect(guest.started).toBeNull();
    scheduler.advance(2000);
    hub.restore('a');
    expect(guest.started).toEqual({ seed: 9, floor: 1, dungeon: 'misty-forest', localId: 'p2' });
  });
});
