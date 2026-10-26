import { DEFAULT_DIFFICULTY, toDifficulty, type Difficulty } from '../data/difficulty';
import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { GameEvent, HitClaim, WorldState } from '../core/state';
import { applyBerryClaims, berryGranted, type BerryClaim } from '../core/berries';
import { applyHitClaims, applyHostSnapshot, applyRemotePlayers, hostSnapshot, playerSnapshot, removeRemote, type HostSnapshot, type PlayerSnapshot } from '../core/sync';
import { applyHolds, holdClaimedHits, type HpHold } from './hold';
import { createBuffer, lerpPos, pushSample, sampleAt, type InterpBuffer } from './interpolation';
import { decodeMessage, encodeMessage, parseRoomTrial, type NetMessage, type RoomTrial, type RosterEntry, type TownPresence } from './protocol';
import { sanitizeNickname } from './nickname';
import { CONTENT_HASH, PROTOCOL_VERSION, sameVersion } from './version';
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
 *
 * Town lobby: while the room walks the town, every peer sends where its
 * walker is (`sendPresence`, ~10 Hz) and draws the others from
 * `townWalkers` (interpolated like remote players). Only the host can lead
 * the room into a dungeon (`canLead`, `begin`); after a shared run the
 * host's `reopenLobby` brings everyone back to the town for another round
 * in the same room (guests hear it through `onLobby`).
 */

/** Another peer's walker in the town, at the render time. */
export interface TownWalker extends TownPresence {
  peer: string;
  /** Player id ("p2"…), species and nickname from the roster. */
  id: string;
  species: SpeciesId;
  name?: string;
}
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
  /** The host's tier; absent = easy (an easy host, or an older one, sends none). */
  difficulty?: Difficulty;
  localId: string;
  /** A shrine trial for the whole room instead of a dungeon run (absent: a run). */
  trial?: RoomTrial;
}

/** Why a guest was not let in. */
export type RefusedReason = 'full' | 'version';

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
  host(seed: number, floor: number, species: SpeciesId, options?: { lobby?: boolean; dungeon?: string; name?: string; difficulty?: Difficulty }): void;
  /** Host: picks the room's tier (sent to the guests at once while in the lobby, and with every `start`). */
  setDifficulty(difficulty: Difficulty): void;
  /** The room's tier: the host's own choice, or as a guest the latest the host sent (easy before any). */
  difficulty(): Difficulty;
  /** Host: true while waiting in the lobby for `begin`. */
  inLobby(): boolean;
  /** Host: leaves the lobby and starts every admitted player with its seed (or `runSeed`: the endless dungeon's mode picks it at Start) and `dungeon`, if given; with `trial`, a shrine trial instead of a run. */
  begin(dungeon?: string, runSeed?: number, trial?: RoomTrial): void;
  /** Host in the lobby: the shrine trial picked at the altar (or none), shown to the guests read-only. */
  setTrial(trial: RoomTrial | null): void;
  /** The room's shrine trial: the host's pick, or as a guest the latest the host sent (null: none). */
  trial(): RoomTrial | null;
  /** In the room: this player picked another species (and moves) in the loadout; the roster follows (an older host keeps the first). */
  repick(species: SpeciesId, loadout: readonly (MoveId | null)[]): void;
  /** Asks the session's host to let this player in; `onStart` fires when it answers. */
  join(species: SpeciesId, loadout: readonly (MoveId | null)[], name?: string): void;
  /** Host in the lobby: it may lead the room into a dungeon (guests never can). */
  canLead(): boolean;
  /** Host, after a shared run: back to the town lobby with a new seed; guests are told (`onLobby`). */
  reopenLobby(seed: number): void;
  /** Guest: the host brought the room back to the town lobby after a run. */
  onLobby(handler: () => void): void;
  /** Where this peer's walker is in the town (unreliable; the caller sends it ~10 Hz). */
  sendPresence(presence: TownPresence): void;
  /** The other peers' walkers in the town, interpolated `townDelayMs` in the past. */
  townWalkers(): TownWalker[];
  townDelayMs(): number;
  onStart(handler: (start: StartInfo) => void): void;
  /** The roster changed (someone was admitted or left). */
  onRoster(handler: (roster: readonly RosterEntry[]) => void): void;
  /** Guest: the host turned this player away: the room has four already, or (`version`) one of the two runs another version of the game. */
  onFull(handler: (reason: RefusedReason) => void): void;
  /** Host: a player on another version of the game knocked and was turned away (its nickname, sanitised; may be empty). */
  onVersionRefused(handler: (name: string) => void): void;
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
  /** This player's gather status, sent with its state from now on (core/gather.ts). */
  setStatus(status: { ready: boolean; afk: boolean }): void;
  /**
   * Player `id`'s gather status on `floor` as its last state said: ready, and
   * active (not AFK, and heard from within `STALE_MS`: a hidden tab stops
   * sending). Null when nothing was heard from it on that floor.
   */
  status(id: string, floor: number): { ready: boolean; active: boolean } | null;
  /** Host: everyone goes to `floor`. */
  sendFloor(floor: number): void;
  /** Guest: the floor the host moved to since the last call, if any. */
  takeFloorChange(): number | null;
  /** Host, endless dungeon: sends its run clock (reliable). */
  sendClock(ms: number, floor: number): void;
  /** Guest: the host's latest clock since the last call, if any. */
  takeClock(): { ms: number; floor: number } | null;
  stats(): NetStats;
  leave(): void;
}

const MAX_PLAYERS = 4;
/** This build's protocol version and content hash, on every hello, lobby and start. */
const VERSION = { v: PROTOCOL_VERSION, c: CONTENT_HASH } as const;
/** Town presence comes at ~10 Hz: draw walkers a bit further in the past than run players. */
const TOWN_DELAY_MS = 150;
const PING_EVERY_TICKS = 60;
/** A player silent this long is away (its tab hidden: the browser stops its frames) and is not waited for (ms). */
export const STALE_MS = 3000;
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

/** Walkers slide between presences on one map and jump when the map changes (or the gap is a teleport). */
function mixPresence(a: TownPresence, b: TownPresence, t: number): TownPresence {
  if (a.map !== b.map) return t < 1 ? a : b;
  return { ...pick(a, b, t), pos: lerpPos(a.pos, b.pos, Math.min(1, t), SNAP_DISTANCE * 2) };
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
  /** The room's tier: the host's pick, or the latest a guest heard. */
  let tier: Difficulty = DEFAULT_DIFFICULTY;
  let started = false;
  let ticks = 0;
  let left = false;
  let lobby = false;
  let joining: { species: SpeciesId; loadout: readonly (MoveId | null)[]; name?: string } | null = null;
  /** The shrine trial picked in the lobby (shown to guests), and the one under way (sent with `start`). */
  let picked: RoomTrial | null = null;
  let running: RoomTrial | null = null;
  let admitted = false;
  let full = false;
  const startHandlers: Array<(start: StartInfo) => void> = [];
  const rosterHandlers: Array<(roster: readonly RosterEntry[]) => void> = [];
  const fullHandlers: Array<(reason: RefusedReason) => void> = [];
  const versionHandlers: Array<(name: string) => void> = [];
  const hostLeftHandlers: Array<() => void> = [];
  const lobbyHandlers: Array<() => void> = [];
  /** Town walkers by transport peer id. */
  const walkers = new Map<string, InterpBuffer<TownPresence>>();
  let hostGone = false;
  /** Hellos heard before this peer started or hosted (local election; admitted at once if it hosts). */
  const pending = new Map<string, { species: SpeciesId; name: string }>();
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
  let clock: { ms: number; floor: number } | null = null;
  /** This player's gather status (sent with its state), and the others' as last heard. */
  let own = { ready: false, afk: false };
  const statuses = new Map<string, { ready: boolean; afk: boolean; floor: number; heardAt: number }>();
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
    if (joining && !started && !admitted && !full && role !== 'host') send(helloOf(joining), true);
  };

  /** Sender clock -> local timeline: the smallest observed (arrival - sent) is the clock difference plus the fastest path. */
  function stamp(peer: string, at: number): number {
    const seen = scheduler.now() - at;
    const offset = Math.min(offsets.get(peer) ?? seen, seen);
    offsets.set(peer, offset);
    return at + offset;
  }

  const helloOf = (j: { species: SpeciesId; loadout: readonly (MoveId | null)[]; name?: string }): NetMessage => ({ t: 'hello', species: j.species, loadout: j.loadout, ...(j.name ? { name: j.name } : {}), ...VERSION });

  /** Guest: turned away (or the host runs another version); fires once. */
  const refused = (reason: RefusedReason) => {
    if (started || full) return;
    full = true;
    for (const handler of fullHandlers) handler(reason);
  };

  /** Host: gives `peer` a player id; false when the room is full. */
  function admit(peer: string, species: SpeciesId, name = ''): boolean {
    const known = roster.find((r) => r.peer === peer);
    if (known) {
      // A hello again: the player picked another species in the room.
      if (known.species !== species) setRoster(roster.map((r) => (r === known ? { ...r, species } : r)));
      return true;
    }
    const taken = new Set(roster.map((r) => r.id));
    let id: string | null = null;
    for (let n = 1; n <= MAX_PLAYERS && !id; n++) if (!taken.has(`p${n}`)) id = `p${n}`;
    if (!id) return false;
    setRoster([...roster, { peer, id, species, ...(name ? { name } : {}) }]);
    return true;
  }

  function dropPeer(peer: string): void {
    const entry = roster.find((r) => r.peer === peer);
    tracker.forget(peer);
    pending.delete(peer);
    walkers.delete(peer);
    if (!entry) return;
    if (entry.id === 'p1') hostLeft();
    setRoster(roster.filter((r) => r !== entry));
    players.delete(entry.id);
    statuses.delete(entry.id);
    if (role === 'host') send({ t: 'leave', id: entry.id }, true);
  }

  /** The tier goes on the wire only when it is not the default (absent reads as easy, as for an older host). */
  const tierField = (): { difficulty?: Difficulty } => (tier === DEFAULT_DIFFICULTY ? {} : { difficulty: tier });
  const startMessage = (): NetMessage => ({ t: 'start', seed, floor: hostFloor, ...(dungeon ? { dungeon } : {}), ...tierField(), players: roster, ...(running ? { trial: running } : {}), ...VERSION });
  const lobbyMessage = (): NetMessage => ({ t: 'lobby', players: roster, ...tierField(), ...(picked ? { trial: picked } : {}), ...VERSION });

  transport.onMessage((from, wire) => {
    tracker.received(wire.length, scheduler.now());
    const message = decodeMessage(wire);
    if (!message) return;
    switch (message.t) {
      case 'hello': {
        const name = sanitizeNickname(message.name);
        const same = sameVersion(message.v, message.c);
        if (role !== 'host') {
          if (!started && same) pending.set(from, { species: message.species, name });
          return;
        }
        // Another version would desync the run (or crash on content it does not know): turned away, on both screens.
        if (!same) {
          send({ t: 'full', peer: from, reason: 'version' }, true);
          for (const handler of versionHandlers) handler(name);
          return;
        }
        if (!admit(from, message.species, name)) send({ t: 'full', peer: from }, true);
        else if (lobby) send(lobbyMessage(), true);
        else send(startMessage(), true);
        return;
      }
      case 'lobby':
        if (role === 'host') return;
        pending.delete(from);
        if (!sameVersion(message.v, message.c)) return refused('version');
        tier = toDifficulty(message.difficulty);
        picked = parseRoomTrial(message.trial);
        setRoster(message.players.map((r) => ({ ...r, ...(r.name !== undefined ? { name: sanitizeNickname(r.name) } : {}) })));
        if (started && roster.some((r) => r.peer === transport.selfId)) {
          // The host brought the room back to the town after a run: wait for its next start.
          started = false;
          admitted = true;
          resetRun();
          for (const handler of lobbyHandlers) handler();
          return;
        }
        if (roster.some((r) => r.peer === transport.selfId)) admitted = true;
        else knock();
        return;
      case 'full':
        if (message.peer === transport.selfId) refused(message.reason ?? 'full');
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
        if (!sameVersion(message.v, message.c)) return refused('version');
        setRoster(message.players.map((r) => ({ ...r, ...(r.name !== undefined ? { name: sanitizeNickname(r.name) } : {}) })));
        const me = roster.find((r) => r.peer === transport.selfId);
        if (!me) return knock();
        if (started) return;
        started = true;
        role = 'guest';
        localId = me.id;
        seed = message.seed;
        tier = toDifficulty(message.difficulty);
        running = parseRoomTrial(message.trial);
        for (const handler of startHandlers) handler({ seed, floor: message.floor, ...(typeof message.dungeon === 'string' ? { dungeon: message.dungeon } : {}), ...tierField(), localId: me.id, ...(running ? { trial: running } : {}) });
        return;
      }
      case 'state': {
        if (message.p.id === localId) return;
        statuses.set(message.p.id, { ready: message.ready === true, afk: message.afk === true, floor: message.floor, heardAt: scheduler.now() });
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
      case 'clock':
        // Only the host's clock counts, and only a sane one.
        if (role !== 'guest' || roster.find((r) => r.id === 'p1')?.peer !== from) return;
        if (typeof message.ms !== 'number' || !Number.isFinite(message.ms) || message.ms < 0 || typeof message.floor !== 'number') return;
        clock = { ms: message.ms, floor: message.floor };
        return;
      case 'town': {
        if (from === transport.selfId) return;
        const buffer = walkers.get(from) ?? createBuffer<TownPresence>(16);
        walkers.set(from, pushSample(buffer, { at: stamp(from, message.at), epoch: 0, value: { map: message.map, pos: message.pos, facing: message.facing, moving: message.moving } }));
        return;
      }
      case 'leave':
        if (message.id === 'p1') hostLeft();
        for (const r of roster) if (r.id === message.id) walkers.delete(r.peer);
        players.delete(message.id);
        statuses.delete(message.id);
        setRoster(roster.filter((r) => r.id !== message.id));
        return;
    }
  });
  /** A new round: forget the last run's remote players, snapshots and pending claims. */
  function resetRun(): void {
    players.clear();
    statuses.clear();
    own = { ready: false, afk: false };
    snapshots = createBuffer<HostSnapshot>();
    inbox = [];
    berryInbox = [];
    berryGrants = [];
    holds = [];
    floorChange = null;
    // A Sima clock from the last round must not reach the next one.
    clock = null;
  }

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
      tier = hostOptions?.difficulty ?? DEFAULT_DIFFICULTY;
      lobby = hostOptions?.lobby ?? false;
      const name = sanitizeNickname(hostOptions?.name);
      setRoster([{ peer: transport.selfId, id: 'p1', species, ...(name ? { name } : {}) }]);
      // Tabs that knocked while this one was still searching are let in now (local election).
      for (const [peer, theirs] of pending) admit(peer, theirs.species, theirs.name);
      pending.clear();
      // Anyone already in the room who knocked before this tab hosted knocks again on seeing the roster.
      if (lobby) send(lobbyMessage(), true);
      else if (roster.length > 1) send(startMessage(), true);
    },
    inLobby: () => role === 'host' && lobby,
    setDifficulty(next) {
      if (role !== 'host' || next === tier) return;
      tier = next;
      if (lobby) send(lobbyMessage(), true);
    },
    difficulty: () => tier,
    begin(chosen, runSeed, trial) {
      if (role !== 'host' || !lobby) return;
      lobby = false;
      if (chosen !== undefined) dungeon = chosen;
      if (runSeed !== undefined) seed = runSeed;
      running = trial ?? null;
      send(startMessage(), true);
    },
    setTrial(next) {
      if (role !== 'host' || !lobby) return;
      picked = next;
      send(lobbyMessage(), true);
    },
    trial: () => picked,
    repick(species, loadout) {
      if (role === 'host') {
        const me = roster.find((r) => r.id === 'p1');
        if (!me || me.species === species) return;
        setRoster(roster.map((r) => (r === me ? { ...r, species } : r)));
        if (lobby) send(lobbyMessage(), true);
        return;
      }
      if (!joining) return;
      joining = { ...joining, species, loadout };
      send(helloOf(joining), true);
    },
    join(species, loadout, name) {
      const clean = sanitizeNickname(name);
      joining = { species, loadout, ...(clean ? { name: clean } : {}) };
      send(helloOf(joining), true);
    },
    canLead: () => role === 'host' && lobby,
    reopenLobby(nextSeed) {
      if (role !== 'host') return;
      lobby = true;
      seed = nextSeed;
      hostFloor = 1;
      running = null;
      resetRun();
      send(lobbyMessage(), true);
    },
    onLobby: (handler) => void lobbyHandlers.push(handler),
    sendPresence(presence) {
      send({ t: 'town', at: scheduler.now(), ...presence }, false);
    },
    townWalkers() {
      const renderAt = scheduler.now() - TOWN_DELAY_MS;
      return roster.flatMap((r): TownWalker[] => {
        const buffer = r.peer === transport.selfId ? undefined : walkers.get(r.peer);
        const value = buffer && sampleAt(buffer, renderAt, mixPresence, { maxExtrapolateMs: 0 });
        return value ? [{ ...value, peer: r.peer, id: r.id, species: r.species, ...(r.name ? { name: r.name } : {}) }] : [];
      });
    },
    townDelayMs: () => TOWN_DELAY_MS,
    onStart: (handler) => void startHandlers.push(handler),
    onRoster: (handler) => void rosterHandlers.push(handler),
    onFull: (handler) => void fullHandlers.push(handler),
    onVersionRefused: (handler) => void versionHandlers.push(handler),
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
      stats.stateBytes = send({ t: 'state', at, floor, p: { ...playerSnapshot(world), id: localId }, ...(own.ready ? { ready: true } : {}), ...(own.afk ? { afk: true } : {}) }, false);
      if (role === 'host') stats.snapshotBytes = send({ t: 'snap', at, floor, s: hostSnapshot(world) }, false);
    },
    setStatus(status) {
      own = { ready: status.ready, afk: status.afk };
    },
    status(id, floor) {
      const heard = statuses.get(id);
      if (!heard || heard.floor !== floor) return null;
      return { ready: heard.ready, active: !heard.afk && scheduler.now() - heard.heardAt < STALE_MS };
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
    sendClock(ms, floor) {
      if (role === 'host') send({ t: 'clock', ms: Math.round(ms), floor }, true);
    },
    takeClock() {
      const latest = clock;
      clock = null;
      return latest;
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
