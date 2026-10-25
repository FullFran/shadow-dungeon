import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { GameEvent, HitClaim, WorldState } from '../core/state';
import { applyBerryClaims, berryGranted, type BerryClaim } from '../core/berries';
import { applyHitClaims, applyHostSnapshot, applyRemotePlayers, hostSnapshot, playerSnapshot, removeRemote, type HostSnapshot, type PlayerSnapshot } from '../core/sync';
import { applyHolds, holdClaimedHits, type HpHold } from './hold';
import { createBuffer, lerpPos, pushSample, sampleAt, type InterpBuffer } from './interpolation';
import { decodeMessage, encodeMessage, type NetMessage, type RosterEntry } from './protocol';
import { createStatsTracker, type StatsSummary } from './stats';
import type { Scheduler, Transport } from './transport';

/**
 * One peer's side of a shared run (docs/gdd.md §12), between the transport
 * and the pure core. Around each fixed step the app calls `beforeStep`
 * (remote players, and on a guest the host's enemies, from the
 * interpolation buffers; on the host, guests' hit and berry claims; on a
 * guest, the berries the host granted it) and `afterStep` (claims out at once; own state, and the host's snapshot, every
 * `sendEveryTicks` steps, ~20 Hz at 60 Hz).
 *
 * Room-code lobby: a host started with `{ lobby: true }` admits players
 * (up to four; the next one is told the room is full) and answers them with
 * the roster only; `begin` starts everyone with the host's seed. A guest
 * that knocked before the host was there knocks again when a peer joins or
 * when a roster without it arrives. Every peer pings the others about once a
 * second (reliable) for the round trip shown in the F3 overlay.
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
  /** The host's dungeon id as sent (validated by the run: an unknown id plays the first dungeon). */
  dungeon?: string;
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
  /** This peer's transport id. */
  peerId(): string;
  roster(): readonly RosterEntry[];
  /** This tab runs the run: player p1. */
  host(seed: number, floor: number, species: SpeciesId, options?: { lobby?: boolean; dungeon?: string }): void;
  /** Host: true while waiting in the lobby for `begin`. */
  inLobby(): boolean;
  /** Host: leaves the lobby and starts every admitted player with this seed (and `dungeon`, if given). */
  begin(dungeon?: string): void;
  /** Asks the session's host to let this player in; `onStart` fires when it answers. */
  join(species: SpeciesId, loadout: readonly (MoveId | null)[]): void;
  onStart(handler: (start: StartInfo) => void): void;
  /** The roster changed (someone was admitted or left). */
  onRoster(handler: (roster: readonly RosterEntry[]) => void): void;
  /** Guest: the host turned this player away, the room has four already. */
  onFull(handler: () => void): void;
  /** Guest (in the lobby or mid-run): the host left; fires once. */
  onHostLeft(handler: () => void): void;
  /** Not started yet: the other tabs knocking at the same time (for the local host election). */
  rivals(): readonly string[];
  /** Sends a round-trip probe to every peer (also done every 60 steps). */
  ping(): void;
  /** Rates, snapshot age and round trips for the net stats overlay. */
  liveStats(): StatsSummary;
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
const PING_EVERY_TICKS = 60;
const SNAP_DISTANCE = 64;

const pick = <T>(a: T, b: T, t: number): T => (t < 1 ? a : b);

function mixPlayer(a: PlayerSnapshot, b: PlayerSnapshot, t: number): PlayerSnapshot {
  const base = pick(a, b, t);
  const from = new Map(a.projectiles.map((p) => [p.id, p.pos]));
  const to = new Map(b.projectiles.map((p) => [p.id, p.pos]));
  return {
    ...base,
    pos: lerpPos(a.pos, b.pos, t, SNAP_DISTANCE),
    projectiles: base.projectiles.map((p) => {
      const pa = from.get(p.id);
      const pb = to.get(p.id);
      return pa && pb ? { ...p, pos: lerpPos(pa, pb, t, SNAP_DISTANCE) } : p;
    }),
  };
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
  /** Host: the dungeon sent with every `start`. */
  let dungeon: string | undefined;
  let started = false;
  let ticks = 0;
  let left = false;
  let lobby = false;
  let joining: { species: SpeciesId; loadout: readonly (MoveId | null)[] } | null = null;
  let admitted = false;
  let full = false;
  const startHandlers: Array<(start: StartInfo) => void> = [];
  const rosterHandlers: Array<(roster: readonly RosterEntry[]) => void> = [];
  const fullHandlers: Array<() => void> = [];
  const hostLeftHandlers: Array<() => void> = [];
  let hostGone = false;
  /** Hellos heard before this peer started or hosted (local election; admitted at once if it hosts). */
  const pending = new Map<string, SpeciesId>();
  let holds: HpHold[] = [];
  const tracker = createStatsTracker();
  const offsets = new Map<string, number>();
  const players = new Map<string, InterpBuffer<PlayerSnapshot>>();
  let snapshots = createBuffer<HostSnapshot>();
  let inbox: HitClaim[] = [];
  /** Host: guests' berry claims since the last step. Guest: berries the host granted this player. */
  let berryInbox: BerryClaim[] = [];
  let berryGrants: string[] = [];
  let floorChange: number | null = null;
  const stats: NetStats = { snapshotBytes: 0, stateBytes: 0, snapshotsReceived: 0 };

  const send = (message: NetMessage, reliable: boolean): number => {
    const wire = encodeMessage(message);
    transport.send(wire, reliable);
    tracker.sent(wire.length, scheduler.now());
    return wire.length;
  };

  const setRoster = (next: RosterEntry[]) => {
    roster = next;
    for (const handler of rosterHandlers) handler(roster);
  };

  const hostLeft = () => {
    if (role === 'host' || hostGone || !(started || admitted)) return;
    hostGone = true;
    for (const handler of hostLeftHandlers) handler();
  };

  /** Guest still waiting to be let in: knock (again). */
  const knock = () => {
    if (joining && !started && !admitted && !full && role !== 'host') send({ t: 'hello', species: joining.species, loadout: joining.loadout }, true);
  };

  /** Sender clock -> local timeline: the smallest observed (arrival - sent) is the clock difference plus the fastest path. */
  function stamp(peer: string, at: number): number {
    const seen = scheduler.now() - at;
    const offset = Math.min(offsets.get(peer) ?? seen, seen);
    offsets.set(peer, offset);
    return at + offset;
  }

  /** Host: gives `peer` a player id; false when the room is full. */
  function admit(peer: string, species: SpeciesId): boolean {
    if (roster.some((r) => r.peer === peer)) return true;
    const taken = new Set(roster.map((r) => r.id));
    let id: string | null = null;
    for (let n = 1; n <= MAX_PLAYERS && !id; n++) if (!taken.has(`p${n}`)) id = `p${n}`;
    if (!id) return false;
    setRoster([...roster, { peer, id, species }]);
    return true;
  }

  function dropPeer(peer: string): void {
    const entry = roster.find((r) => r.peer === peer);
    tracker.forget(peer);
    pending.delete(peer);
    if (!entry) return;
    if (entry.id === 'p1') hostLeft();
    setRoster(roster.filter((r) => r !== entry));
    players.delete(entry.id);
    if (role === 'host') send({ t: 'leave', id: entry.id }, true);
  }

  const startMessage = (): NetMessage => ({ t: 'start', seed, floor: hostFloor, ...(dungeon ? { dungeon } : {}), players: roster });

  transport.onMessage((from, wire) => {
    tracker.received(wire.length, scheduler.now());
    const message = decodeMessage(wire);
    if (!message) return;
    switch (message.t) {
      case 'hello':
        if (role !== 'host') {
          if (!started) pending.set(from, message.species);
          return;
        }
        if (!admit(from, message.species)) send({ t: 'full', peer: from }, true);
        else if (lobby) send({ t: 'lobby', players: roster }, true);
        else send(startMessage(), true);
        return;
      case 'lobby':
        if (role === 'host') return;
        pending.delete(from);
        setRoster([...message.players]);
        if (roster.some((r) => r.peer === transport.selfId)) admitted = true;
        else knock();
        return;
      case 'full':
        if (message.peer !== transport.selfId || started || full) return;
        full = true;
        for (const handler of fullHandlers) handler();
        return;
      case 'ping':
        send({ t: 'pong', to: from, at: message.at }, true);
        return;
      case 'pong':
        if (message.to === transport.selfId) tracker.rtt(from, scheduler.now() - message.at);
        return;
      case 'start': {
        if (role === 'host') return;
        pending.delete(from);
        setRoster([...message.players]);
        const me = roster.find((r) => r.peer === transport.selfId);
        if (!me) return knock();
        if (started) return;
        started = true;
        role = 'guest';
        localId = me.id;
        seed = message.seed;
        for (const handler of startHandlers) handler({ seed, floor: message.floor, ...(typeof message.dungeon === 'string' ? { dungeon: message.dungeon } : {}), localId: me.id });
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
        {
          const at = stamp(from, message.at);
          // Age: the delay above the fastest path seen, plus half the measured round trip.
          tracker.snapshot(scheduler.now() - at + (tracker.rttOf(from) ?? 0) / 2, scheduler.now());
          snapshots = pushSample(snapshots, { at, epoch: message.floor, value: message.s });
        }
        return;
      case 'claim':
        if (role === 'host') inbox = [...inbox, ...message.claims];
        return;
      case 'pick':
        if (role === 'host') berryInbox = [...berryInbox, { berryId: message.id, playerId: message.by }];
        return;
      case 'berry':
        if (role === 'guest' && message.to === localId) berryGrants = [...berryGrants, message.id];
        return;
      case 'floor':
        if (role === 'guest') floorChange = Math.max(floorChange ?? 0, message.floor);
        return;
      case 'leave':
        if (message.id === 'p1') hostLeft();
        players.delete(message.id);
        setRoster(roster.filter((r) => r.id !== message.id));
        return;
    }
  });
  transport.onPeerLeave(dropPeer);
  transport.onPeerJoin(() => knock());

  return {
    role: () => role,
    localId: () => localId,
    peerId: () => transport.selfId,
    roster: () => roster,
    host(runSeed, floor, species, hostOptions) {
      role = 'host';
      started = true;
      localId = 'p1';
      seed = runSeed;
      hostFloor = floor;
      dungeon = hostOptions?.dungeon;
      lobby = hostOptions?.lobby ?? false;
      setRoster([{ peer: transport.selfId, id: 'p1', species }]);
      // Tabs that knocked while this one was still searching are let in now (local election).
      for (const [peer, theirs] of pending) admit(peer, theirs);
      pending.clear();
      // Anyone already in the room who knocked before this tab hosted knocks again on seeing the roster.
      if (lobby) send({ t: 'lobby', players: roster }, true);
      else if (roster.length > 1) send(startMessage(), true);
    },
    inLobby: () => role === 'host' && lobby,
    begin(chosen) {
      if (role !== 'host' || !lobby) return;
      lobby = false;
      if (chosen !== undefined) dungeon = chosen;
      send(startMessage(), true);
    },
    join(species, loadout) {
      joining = { species, loadout };
      send({ t: 'hello', species, loadout }, true);
    },
    onStart: (handler) => void startHandlers.push(handler),
    onRoster: (handler) => void rosterHandlers.push(handler),
    onFull: (handler) => void fullHandlers.push(handler),
    onHostLeft: (handler) => void hostLeftHandlers.push(handler),
    rivals: () => (started || role === 'host' ? [] : [...pending.keys()]),
    ping() {
      send({ t: 'ping', at: scheduler.now() }, true);
    },
    liveStats: () => tracker.summary(scheduler.now()),
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
        ({ world: next, holds } = applyHolds(holds, next, scheduler.now()));
      }
      const events: GameEvent[] = [];
      if (role === 'host' && inbox.length > 0) {
        const before = next.events.length;
        next = applyHitClaims(next, inbox);
        events.push(...next.events.slice(before));
        inbox = [];
      }
      if (role === 'host' && berryInbox.length > 0) {
        const claimed = applyBerryClaims(next, berryInbox);
        next = claimed.state;
        berryInbox = [];
        for (const grant of claimed.granted) send({ t: 'berry', id: grant.berryId, to: grant.playerId }, true);
      }
      if (role === 'guest' && berryGrants.length > 0) {
        for (const id of berryGrants) next = berryGranted(next, id, events);
        berryGrants = [];
      }
      return { world: next, events };
    },
    afterStep(world, floor) {
      if (!role || !localId) return;
      ticks++;
      if (ticks % PING_EVERY_TICKS === 0) send({ t: 'ping', at: scheduler.now() }, true);
      if (role === 'guest') {
        for (const e of world.events) if (e.type === 'berryClaim') send({ t: 'pick', id: e.berryId, by: localId }, true);
        const claims = world.events.flatMap((e) => (e.type === 'hitClaim' ? [e.claim] : []));
        if (claims.length > 0) {
          send({ t: 'claim', claims }, true);
          holds = holdClaimedHits(holds, world, claims, scheduler.now());
        }
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
