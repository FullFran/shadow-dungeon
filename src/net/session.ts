import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { GameEvent, HitClaim, WorldState } from '../core/state';
import { applyHitClaims, applyHostSnapshot, applyRemotePlayers, hostSnapshot, playerSnapshot, removeRemote, type HostSnapshot, type PlayerSnapshot } from '../core/sync';
import { createBuffer, lerpPos, pushSample, sampleAt, type InterpBuffer } from './interpolation';
import { decodeMessage, encodeMessage, type NetMessage, type RosterEntry } from './protocol';
import type { Scheduler, Transport } from './transport';

/**
 * One peer's side of a shared run (docs/gdd.md §12), between the transport
 * and the pure core. Around each fixed step the app calls `beforeStep`
 * (remote players, and on a guest the host's enemies, from the
 * interpolation buffers; on the host, guests' hit claims) and `afterStep`
 * (claims out at once; own state, and the host's snapshot, every
 * `sendEveryTicks` steps, ~20 Hz at 60 Hz).
 */
export interface SessionOptions {
  transport: Transport<string>;
  scheduler: Pick<Scheduler, 'now'>;
  /** How far in the past remote entities are drawn (ms). */
  renderDelayMs?: number;
  sendEveryTicks?: number;
  maxExtrapolateMs?: number;
}

export interface StartInfo {
  seed: number;
  floor: number;
  localId: string;
}

export interface NetStats {
  /** Bytes of the last snapshot sent (host) or received (guest). */
  snapshotBytes: number;
  /** Bytes of the last own-state message sent. */
  stateBytes: number;
  snapshotsReceived: number;
}

export interface NetSession {
  role(): 'host' | 'guest' | null;
  localId(): string | null;
  roster(): readonly RosterEntry[];
  /** This tab runs the run: player p1. */
  host(seed: number, floor: number, species: SpeciesId): void;
  /** Asks the session's host to let this player in; `onStart` fires when it answers. */
  join(species: SpeciesId, loadout: readonly (MoveId | null)[]): void;
  onStart(handler: (start: StartInfo) => void): void;
  beforeStep(world: WorldState, floor: number): { world: WorldState; events: GameEvent[] };
  afterStep(world: WorldState, floor: number): void;
  /** Host: everyone goes to `floor`. */
  sendFloor(floor: number): void;
  /** Guest: the floor the host moved to since the last call, if any. */
  takeFloorChange(): number | null;
  stats(): NetStats;
  leave(): void;
}

const MAX_PLAYERS = 4;
const SNAP_DISTANCE = 64;

const pick = <T>(a: T, b: T, t: number): T => (t < 1 ? a : b);

function mixPlayer(a: PlayerSnapshot, b: PlayerSnapshot, t: number): PlayerSnapshot {
  return { ...pick(a, b, t), pos: lerpPos(a.pos, b.pos, t, SNAP_DISTANCE) };
}

function mixSnapshot(a: HostSnapshot, b: HostSnapshot, t: number): HostSnapshot {
  const base = pick(a, b, t);
  const fromA = new Map(a.enemies.map((e) => [e.id, e.pos]));
  const toB = new Map(b.enemies.map((e) => [e.id, e.pos]));
  const projA = new Map(a.projectiles.map((p) => [p.id, p.pos]));
  const projB = new Map(b.projectiles.map((p) => [p.id, p.pos]));
  const at = (id: string, own: { x: number; y: number }, from: Map<string, { x: number; y: number }>, to: Map<string, { x: number; y: number }>) => {
    const pa = from.get(id);
    const pb = to.get(id);
    return pa && pb ? lerpPos(pa, pb, t, SNAP_DISTANCE) : own;
  };
  return {
    ...base,
    enemies: base.enemies.map((e) => ({ ...e, pos: at(e.id, e.pos, fromA, toB) })),
    projectiles: base.projectiles.map((p) => ({ ...p, pos: at(p.id, p.pos, projA, projB) })),
  };
}

export function createSession(options: SessionOptions): NetSession {
  const { transport, scheduler } = options;
  const renderDelayMs = options.renderDelayMs ?? 100;
  const sendEvery = options.sendEveryTicks ?? 3;
  const sampleOptions = { maxExtrapolateMs: options.maxExtrapolateMs ?? 50 };

  let role: 'host' | 'guest' | null = null;
  let localId: string | null = null;
  let roster: RosterEntry[] = [];
  let seed = 0;
  let hostFloor = 1;
  let started = false;
  let ticks = 0;
  let left = false;
  const startHandlers: Array<(start: StartInfo) => void> = [];
  const offsets = new Map<string, number>();
  const players = new Map<string, InterpBuffer<PlayerSnapshot>>();
  let snapshots = createBuffer<HostSnapshot>();
  let inbox: HitClaim[] = [];
  let floorChange: number | null = null;
  const stats: NetStats = { snapshotBytes: 0, stateBytes: 0, snapshotsReceived: 0 };

  const send = (message: NetMessage, reliable: boolean): number => {
    const wire = encodeMessage(message);
    transport.send(wire, reliable);
    return wire.length;
  };

  /** Sender clock -> local timeline: the smallest observed (arrival - sent) is the clock difference plus the fastest path. */
  function stamp(peer: string, at: number): number {
    const seen = scheduler.now() - at;
    const offset = Math.min(offsets.get(peer) ?? seen, seen);
    offsets.set(peer, offset);
    return at + offset;
  }

  function admit(peer: string, species: SpeciesId): void {
    if (roster.some((r) => r.peer === peer)) return;
    const taken = new Set(roster.map((r) => r.id));
    let id: string | null = null;
    for (let n = 1; n <= MAX_PLAYERS && !id; n++) if (!taken.has(`p${n}`)) id = `p${n}`;
    if (!id) return;
    roster = [...roster, { peer, id, species }];
  }

  function dropPeer(peer: string): void {
    const entry = roster.find((r) => r.peer === peer);
    if (!entry) return;
    roster = roster.filter((r) => r !== entry);
    players.delete(entry.id);
    if (role === 'host') send({ t: 'leave', id: entry.id }, true);
  }

  transport.onMessage((from, wire) => {
    const message = decodeMessage(wire);
    if (!message) return;
    switch (message.t) {
      case 'hello':
        if (role !== 'host') return;
        admit(from, message.species);
        send({ t: 'start', seed, floor: hostFloor, players: roster }, true);
        return;
      case 'start': {
        if (role === 'host') return;
        roster = [...message.players];
        const me = roster.find((r) => r.peer === transport.selfId);
        if (!me || started) return;
        started = true;
        role = 'guest';
        localId = me.id;
        seed = message.seed;
        for (const handler of startHandlers) handler({ seed, floor: message.floor, localId: me.id });
        return;
      }
      case 'state': {
        if (message.p.id === localId) return;
        const buffer = players.get(message.p.id) ?? createBuffer<PlayerSnapshot>();
        players.set(message.p.id, pushSample(buffer, { at: stamp(from, message.at), epoch: message.floor, value: message.p }));
        return;
      }
      case 'snap':
        if (role !== 'guest') return;
        stats.snapshotBytes = wire.length;
        stats.snapshotsReceived++;
        snapshots = pushSample(snapshots, { at: stamp(from, message.at), epoch: message.floor, value: message.s });
        return;
      case 'claim':
        if (role === 'host') inbox = [...inbox, ...message.claims];
        return;
      case 'floor':
        if (role === 'guest') floorChange = Math.max(floorChange ?? 0, message.floor);
        return;
      case 'leave':
        players.delete(message.id);
        roster = roster.filter((r) => r.id !== message.id);
        return;
    }
  });
  transport.onPeerLeave(dropPeer);

  return {
    role: () => role,
    localId: () => localId,
    roster: () => roster,
    host(runSeed, floor, species) {
      role = 'host';
      started = true;
      localId = 'p1';
      seed = runSeed;
      hostFloor = floor;
      roster = [{ peer: transport.selfId, id: 'p1', species }];
    },
    join(species, loadout) {
      send({ t: 'hello', species, loadout }, true);
    },
    onStart: (handler) => void startHandlers.push(handler),
    beforeStep(world, floor) {
      const renderAt = scheduler.now() - renderDelayMs;
      const remote: PlayerSnapshot[] = [];
      for (const [id, buffer] of players) {
        if (id === localId || buffer.samples.at(-1)?.epoch !== floor) continue;
        const value = sampleAt(buffer, renderAt, mixPlayer, sampleOptions);
        if (value) remote.push(value);
      }
      let next = applyRemotePlayers(world, remote);
      for (const r of next.remotes) if (!players.has(r.id)) next = removeRemote(next, r.id);
      if (role === 'guest' && snapshots.samples.at(-1)?.epoch === floor) {
        const snapshot = sampleAt(snapshots, renderAt, mixSnapshot, sampleOptions);
        if (snapshot) next = applyHostSnapshot(next, snapshot);
      }
      const events: GameEvent[] = [];
      if (role === 'host' && inbox.length > 0) {
        const before = next.events.length;
        next = applyHitClaims(next, inbox);
        events.push(...next.events.slice(before));
        inbox = [];
      }
      return { world: next, events };
    },
    afterStep(world, floor) {
      if (!role || !localId) return;
      ticks++;
      if (role === 'guest') {
        const claims = world.events.flatMap((e) => (e.type === 'hitClaim' ? [e.claim] : []));
        if (claims.length > 0) send({ t: 'claim', claims }, true);
      }
      if (ticks % sendEvery !== 0) return;
      const at = scheduler.now();
      stats.stateBytes = send({ t: 'state', at, floor, p: { ...playerSnapshot(world), id: localId } }, false);
      if (role === 'host') stats.snapshotBytes = send({ t: 'snap', at, floor, s: hostSnapshot(world) }, false);
    },
    sendFloor(floor) {
      hostFloor = floor;
      send({ t: 'floor', floor }, true);
    },
    takeFloorChange() {
      const floor = floorChange;
      floorChange = null;
      return floor;
    },
    stats: () => ({ ...stats }),
    leave() {
      if (left) return;
      left = true;
      if (localId) send({ t: 'leave', id: localId }, true);
      transport.close();
    },
  };
}
