import { describe, expect, it } from 'vitest';
import { bonfireSnapshot } from '../../src/core/bonfire';
import { partyAgreed, type GatherMember } from '../../src/core/gather';
import { atLeavingPoint, floorPlanOf, roomExit, startRun, type RunState } from '../../src/core/run';
import type { RemotePlayer, WorldState } from '../../src/core/state';
import { playerSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { CRYPT } from '../../src/data/dungeons';
import { COOP_REVIVE } from '../../src/data/party-scaling';
import { createSession, type NetSession, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';
import { encodeMessage } from '../../src/net/protocol';
import { input } from '../core/helpers';
import { coopLoop, ticksOf, type CoopLoop } from './coop-loop';

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

/**
 * Ticket SD-Q090F7: everyone back at the bonfire from a later floor. The floor number goes down there, and from then
 * on the peers must keep hearing each other, or a teammate stays frozen as it was when the bonfire lit (fainted,
 * or standing where it can never be ready), and the party can neither move on nor lose.
 */
describe('back at the bonfire from a later floor', () => {
  const SEED = 515;
  const BONFIRE = CRYPT.plan.findIndex((p) => p.kind === 'room' && p.role === 'midboss') + 1;
  const LATER = BONFIRE + 2;
  const NEXT = BONFIRE + 1;

  const at = (localId: string, role: 'host' | 'guest', floor: number) => startRun(SEED, { localId, role }, floor, CRYPT.id);
  const cleared = (world: WorldState): WorldState => ({ ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
  const fainted = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, hp: 0 } });
  const onExit = (run: RunState, world: WorldState): WorldState => {
    const exit = roomExit(floorPlanOf(run), CRYPT)!;
    return { ...world, player: { ...world.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } };
  };
  const run = (l: CoopLoop, ms: number) => {
    for (let i = 0; i < ticksOf(ms); i++) l.tick(input(), input());
  };
  const teammate = (world: WorldState): RemotePlayer => world.remotes[0]!;

  /** The mid-boss fell with `down` fainted, each peer kept its bonfire; the party went on, wiped on a later floor, and everyone is back with its own snapshot. */
  function backAtBonfire(down: 'host' | 'guest'): { l: CoopLoop; run: RunState } {
    let guestId = '';
    const l = coopLoop((id) => {
      guestId = id;
      const host = cleared(at('p1', 'host', BONFIRE).world);
      const guest = cleared(at(id, 'guest', BONFIRE).world);
      return { host: down === 'host' ? fainted(host) : host, guest: down === 'guest' ? fainted(guest) : guest };
    }, BONFIRE);
    run(l, 400);
    // A short look: nobody revives in this time, so the bonfire lights with the teammate down on the other screen.
    expect(teammate(down === 'host' ? l.guestWorld : l.hostWorld).player.hp).toBe(0);
    const kept = { host: bonfireSnapshot(l.hostWorld), guest: bonfireSnapshot(l.guestWorld) };

    l.floor = LATER;
    l.hostWorld = fainted(at('p1', 'host', LATER).world);
    l.guestWorld = fainted(at(guestId, 'guest', LATER).world);
    run(l, 400);

    l.floor = BONFIRE;
    l.hostWorld = kept.host;
    l.guestWorld = kept.guest;
    run(l, 400);
    return { l, run: at('p1', 'host', BONFIRE).run };
  }

  it.each(['host', 'guest'] as const)('a teammate fainted when it lit (the %s) stands up on the other screen too', (down) => {
    const { l } = backAtBonfire(down);
    expect(teammate(l.hostWorld).player.hp).toBeGreaterThan(0);
    expect(teammate(l.guestWorld).player.hp).toBeGreaterThan(0);
  });

  it.each(['host', 'guest'] as const)('each peer follows the other again, with the %s down when it lit', (down) => {
    const { l } = backAtBonfire(down);
    const moved = vec(l.guestWorld.player.pos.x + 40, l.guestWorld.player.pos.y);
    l.guestWorld = { ...l.guestWorld, player: { ...l.guestWorld.player, pos: moved } };
    const movedHost = vec(l.hostWorld.player.pos.x - 40, l.hostWorld.player.pos.y);
    l.hostWorld = { ...l.hostWorld, player: { ...l.hostWorld.player, pos: movedHost } };
    run(l, 400);
    expect(teammate(l.hostWorld).player.pos).toEqual(l.guestWorld.player.pos);
    expect(teammate(l.guestWorld).player.pos).toEqual(l.hostWorld.player.pos);
  });

  it.each(['host', 'guest'] as const)('the party can leave the bonfire room together, with the %s down when it lit', (down) => {
    const { l, run: floor } = backAtBonfire(down);
    l.hostWorld = onExit(floor, l.hostWorld);
    l.guestWorld = onExit(floor, l.guestWorld);
    l.guest.setStatus({ ready: true, afk: false });
    run(l, 400);
    const members: GatherMember[] = [
      { alive: true, active: true, ready: true },
      ...l.hostWorld.remotes.map((r) => {
        const status = l.host.status(r.id, l.floor);
        return { alive: r.player.hp > 0, active: status?.active ?? false, ready: (status?.ready ?? false) && atLeavingPoint(floor, l.hostWorld, r.player.pos) };
      }),
    ];
    expect(partyAgreed(members)).toBe(true);
  });

  it('on the floors between the bonfire and the wipe the guest gets the host\'s enemies again', () => {
    const { l } = backAtBonfire('guest');
    l.floor = NEXT;
    l.hostWorld = at('p1', 'host', NEXT).world;
    l.guestWorld = at('p2', 'guest', NEXT).world;
    run(l, 300);
    const target = l.hostWorld.enemies[0]!;
    expect(l.guestWorld.enemies.find((e) => e.id === target.id)?.alive).toBe(true);
    l.hostWorld = { ...l.hostWorld, enemies: l.hostWorld.enemies.map((e) => (e.id === target.id ? { ...e, alive: false, hp: 0 } : e)) };
    run(l, 300);
    expect(l.guestWorld.enemies.find((e) => e.id === target.id)?.alive ?? false).toBe(false);
  });

  it('a straggler of the later floor, sent before the return, does not freeze the teammate again', () => {
    const scheduler = createFakeScheduler(5000);
    const hub = createMemoryHub<string>();
    const session = createSession({ transport: hub.connect('h'), scheduler, renderDelayMs: 0 });
    session.host(SEED, BONFIRE, 'mimikyu');
    const wire = hub.connect('g');
    const world = at('p1', 'host', BONFIRE).world;
    const state = (sentAt: number, floor: number, x: number) => wire.send(encodeMessage({ t: 'state', at: sentAt, floor, p: { ...playerSnapshot(world), id: 'p2', pos: vec(x, 0) } }), false);
    state(5000, LATER, 1);
    scheduler.advance(100);
    state(5100, BONFIRE, 2);
    state(5050, LATER, 3);
    expect(teammate(session.beforeStep(world, BONFIRE).world).player.pos.x).toBe(2);
  });

  it('going down still follows the higher floor, and a straggler of the floor before is ignored', () => {
    const scheduler = createFakeScheduler(5000);
    const hub = createMemoryHub<string>();
    const session = createSession({ transport: hub.connect('h'), scheduler, renderDelayMs: 0 });
    session.host(SEED, BONFIRE, 'mimikyu');
    const wire = hub.connect('g');
    const world = at('p1', 'host', NEXT).world;
    const state = (sentAt: number, floor: number, x: number) => wire.send(encodeMessage({ t: 'state', at: sentAt, floor, p: { ...playerSnapshot(world), id: 'p2', pos: vec(x, 0) } }), false);
    state(5000, BONFIRE, 1);
    scheduler.advance(100);
    state(5100, NEXT, 2);
    state(5050, BONFIRE, 3);
    expect(teammate(session.beforeStep(world, NEXT).world).player.pos.x).toBe(2);
  });

  it('a bonfire on the floor of the wipe (the Sima\'s) keeps the peers in touch across the return', () => {
    let guestId = '';
    const l = coopLoop((id) => {
      guestId = id;
      return { host: cleared(at('p1', 'host', BONFIRE).world), guest: cleared(at(id, 'guest', BONFIRE).world) };
    }, BONFIRE);
    run(l, 400);
    const kept = { host: bonfireSnapshot(l.hostWorld), guest: bonfireSnapshot(l.guestWorld) };
    l.hostWorld = fainted(l.hostWorld);
    l.guestWorld = fainted(l.guestWorld);
    run(l, 400);
    expect(teammate(l.hostWorld).player.hp).toBe(0);
    expect(guestId).toBe('p2');
    l.hostWorld = kept.host;
    l.guestWorld = kept.guest;
    run(l, 400);
    expect(teammate(l.hostWorld).player.hp).toBeGreaterThan(0);
    expect(teammate(l.guestWorld).player.hp).toBeGreaterThan(0);
  });

  it.each(['host', 'guest'] as const)('after the return a standing ally can still revive the %s', (who) => {
    const { l } = backAtBonfire(who === 'host' ? 'guest' : 'host');
    if (who === 'host') l.hostWorld = fainted(l.hostWorld);
    else l.guestWorld = fainted(l.guestWorld);
    const stand = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, pos: vec(300, 300) } });
    l.hostWorld = stand(l.hostWorld);
    l.guestWorld = stand(l.guestWorld);
    run(l, COOP_REVIVE.holdMs + 500);
    expect((who === 'host' ? l.hostWorld : l.guestWorld).player.hp).toBeGreaterThan(0);
  });

  it('dying again after the return is a wipe on both screens, not a wait for a frozen teammate', () => {
    const { l } = backAtBonfire('guest');
    l.hostWorld = fainted(l.hostWorld);
    l.guestWorld = fainted(l.guestWorld);
    run(l, 400);
    expect(teammate(l.hostWorld).player.hp).toBe(0);
    expect(teammate(l.guestWorld).player.hp).toBe(0);
  });
});
