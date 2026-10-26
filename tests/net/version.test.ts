import { describe, expect, it } from 'vitest';
import { startRun } from '../../src/core/run';
import { hostSnapshot, playerSnapshot } from '../../src/core/sync';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { SPECIES } from '../../src/data/species';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { createSession, type NetSession, type RefusedReason, type StartInfo } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub, type FakeScheduler, type MemoryHub } from '../../src/net/transport';
import { CONTENT_HASH, PROTOCOL_VERSION, fnv1a } from '../../src/net/version';

/** The version gate and the wire checks (odd/tasks/coop-flow.md T1): another version is turned away; unknown content is dropped. */
interface Peer {
  session: NetSession;
  started: StartInfo | null;
  refused: RefusedReason | null;
  turnedAway: number;
}

function peer(hub: MemoryHub<string>, id: string, scheduler: FakeScheduler): Peer {
  const session = createSession({ transport: hub.connect(id), scheduler });
  const p: Peer = { session, started: null, refused: null, turnedAway: 0 };
  session.onStart((start) => (p.started = start));
  session.onFull((reason) => (p.refused = reason));
  session.onVersionRefused(() => p.turnedAway++);
  return p;
}

const LOADOUT = SPECIES.mimikyu.defaultLoadout;
const SAME = { v: PROTOCOL_VERSION, c: CONTENT_HASH };

describe('version gate', () => {
  it('hashes the content ids into a stable 8-digit tag (FNV-1a)', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toBe('e40c292c');
    expect(CONTENT_HASH).toMatch(/^[0-9a-f]{8}$/);
  });

  it('lets in a guest on the same version', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const host = peer(hub, 'h', scheduler);
    host.session.host(1, 1, 'mimikyu', { lobby: true });
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    expect(host.session.roster().map((r) => r.peer)).toEqual(['h', 'g']);
    expect(guest.refused).toBeNull();
  });

  it('turns away a peer on another version (or an older one with none), and says so on both sides', () => {
    for (const versioned of [{}, { v: PROTOCOL_VERSION, c: 'deadbeef' }, { v: PROTOCOL_VERSION + 1, c: CONTENT_HASH }]) {
      const scheduler = createFakeScheduler();
      const hub = createMemoryHub<string>();
      const host = peer(hub, 'h', scheduler);
      host.session.host(1, 1, 'mimikyu', { lobby: true });
      const other = hub.connect('o');
      const seen: unknown[] = [];
      other.onMessage((_from, wire) => seen.push(JSON.parse(wire)));
      other.send(JSON.stringify({ t: 'hello', species: 'mimikyu', loadout: [], ...versioned }), true);
      expect(seen).toContainEqual({ t: 'full', peer: 'o', reason: 'version' });
      expect(host.session.roster().map((r) => r.peer)).toEqual(['h']);
      expect(host.turnedAway).toBe(1);
    }
  });

  it('a guest refuses a host on another version (its lobby or start), once', () => {
    for (const t of ['lobby', 'start']) {
      const scheduler = createFakeScheduler();
      const hub = createMemoryHub<string>();
      const guest = peer(hub, 'g', scheduler);
      guest.session.join('mimikyu', LOADOUT);
      const old = hub.connect('h');
      old.send(JSON.stringify({ t, seed: 1, floor: 1, players: [{ peer: 'h', id: 'p1', species: 'mimikyu' }, { peer: 'g', id: 'p2', species: 'mimikyu' }] }), true);
      expect(guest.refused).toBe('version');
      expect(guest.started).toBeNull();
    }
  });

  it('a guest on the host side of a version refusal reads the reason', () => {
    const scheduler = createFakeScheduler();
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    hub.connect('h').send(JSON.stringify({ t: 'full', peer: 'g', reason: 'version' }), true);
    expect(guest.refused).toBe('version');
  });
});

describe('wire checks', () => {
  const snapOf = (enemies: unknown[], projectiles: unknown[] = []) => JSON.stringify({ t: 'snap', at: 1, f: 1, k: 1, b: ['f1b1', 3], e: enemies, p: projectiles });

  it('drops a snapshot enemy of a species this build does not know, keeps the others', () => {
    const { world } = startRun(7, {}, 2);
    const wire = JSON.parse(encodeMessage({ t: 'snap', at: 1, floor: 2, s: hostSnapshot(world) })) as { e: unknown[][] };
    expect(wire.e.length).toBeGreaterThan(1);
    wire.e[0]![1] = 'missingno';
    wire.e[1]![2] = 'NaN';
    const decoded = decodeMessage(JSON.stringify(wire));
    expect(decoded?.t === 'snap' && decoded.s.enemies.length).toBe(wire.e.length - 2);
  });

  it('drops a projectile of an unknown type and a malformed one; keeps only string berries', () => {
    const shot = ['s1', 'ghost', ['ghost'], 40, 1, 2, 3, 4, 5, 600];
    const decoded = decodeMessage(snapOf([], [shot, ['s2', 'cosmic', [], 40, 1, 2, 3, 4, 5, 600], 'x', ['s3']]));
    expect(decoded?.t === 'snap' && decoded.s.projectiles.map((p) => p.id)).toEqual(['s1']);
    expect(decoded?.t === 'snap' && decoded.s.berries).toEqual(['f1b1']);
  });

  it('reads an unknown enemy mode as idle instead of trusting it', () => {
    const { world } = startRun(7, {}, 2);
    const wire = JSON.parse(encodeMessage({ t: 'snap', at: 1, floor: 2, s: hostSnapshot(world) })) as { e: unknown[][] };
    wire.e[0]![9] = 'dance';
    const decoded = decodeMessage(JSON.stringify(wire));
    expect(decoded?.t === 'snap' && decoded.s.enemies[0]!.ai.mode).toBe('idle');
  });

  it('drops a player state with a broken id or position, and an action of an unknown move', () => {
    const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2' });
    const wire = JSON.parse(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world) })) as { p: unknown[] };
    expect(decodeMessage(JSON.stringify({ ...wire, p: [7, ...wire.p.slice(1)] }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ ...wire, p: [wire.p[0], wire.p[1], 'x', ...wire.p.slice(3)] }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ ...wire, p: 'nope' }))).toBeNull();
    const acting = [...wire.p];
    acting[9] = ['hyper-beam-9000', 'active', 10, 0, 0, 1, 0];
    const decoded = decodeMessage(JSON.stringify({ ...wire, p: acting }));
    expect(decoded?.t === 'state' && decoded.p.action).toBeNull();
  });

  it('drops a start of an unknown dungeon, roster entries without a player id, and malformed hit claims', () => {
    expect(decodeMessage(JSON.stringify({ t: 'start', seed: 1, floor: 1, dungeon: 'the-moon', players: [], ...SAME }))).toBeNull();
    const start = decodeMessage(JSON.stringify({ t: 'start', seed: 1, floor: 1, dungeon: 'misty-forest', players: [{ peer: 'a', id: 'p1', species: 'mimikyu' }, { peer: 'b', id: 'boss' }, 3], ...SAME }));
    expect(start?.t === 'start' && start.players.map((p) => p.peer)).toEqual(['a']);
    const good = { id: 'c1', playerId: 'p2', enemyId: 'e1', damage: 5, effectiveness: 1, hitstunMs: 0, knockback: { x: 0, y: 0 }, blocked: false };
    const claim = decodeMessage(JSON.stringify({ t: 'claim', claims: [good, { ...good, damage: 'lots' }, { ...good, knockback: null }, null] }));
    expect(claim?.t === 'claim' && claim.claims).toEqual([good]);
  });

  it('drops floor numbers that are not whole floors', () => {
    for (const floor of [0, 1.5, -2, 'x']) expect(decodeMessage(JSON.stringify({ t: 'floor', floor }))).toBeNull();
    expect(decodeMessage(JSON.stringify({ t: 'floor', floor: 3 }))).toEqual({ t: 'floor', floor: 3 });
  });

  it('a guest fed bad snapshots keeps stepping (nothing unknown reaches its world)', () => {
    const scheduler = createFakeScheduler(1000);
    const hub = createMemoryHub<string>();
    const guest = peer(hub, 'g', scheduler);
    guest.session.join('mimikyu', LOADOUT);
    const host = hub.connect('h');
    host.send(JSON.stringify({ t: 'start', seed: 1, floor: 1, players: [{ peer: 'h', id: 'p1', species: 'mimikyu' }, { peer: 'g', id: 'p2', species: 'mimikyu' }], ...SAME }), true);
    expect(guest.started?.localId).toBe('p2');
    const { world } = startRun(1, { localId: 'p2', role: 'guest' }, 1);
    const bad = ['e1', 'missingno', 1, 1, 0, 1, 10, 1, 0, 'idle', 0, 0, 0, 0];
    for (let i = 0; i < 5; i++) {
      host.send(snapOf([bad], [['s9', 'cosmic', [], 1, 1, 1, 1, 1, 1, 1]]), false);
      scheduler.advance(50);
    }
    const stepped = guest.session.beforeStep(world, 1);
    expect(stepped.world.enemies.some((e) => (e.species as string) === 'missingno')).toBe(false);
  });
});
