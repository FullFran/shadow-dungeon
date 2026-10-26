import type { SimaSync } from '../core/sima-events';
import type { GateSync } from '../core/gates';
import { isEliteTrait, toDifficulty, type Difficulty } from '../data/difficulty';
import type { MoveId } from '../data/moves';
import { isPlayable, type SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import type { ActionPhase, AiMode, BossStance, HitClaim } from '../core/state';
import type { EnemySnapshot, HostSnapshot, PlayerSnapshot, ProjectileSnapshot } from '../core/sync';

/**
 * Netcode spike protocol (docs/gdd.md §12). Reliable: hello, start, lobby,
 * full, ping, pong, claim, pick, berry, floor, clock, leave. Unreliable at ~20 Hz: state (every peer, its own player) and
 * snap (host: enemies and enemy projectiles). Unreliable at ~10 Hz while
 * the room walks the town: town (every peer, where its walker is). Names
 * and `town` are optional additions: a peer that does not send them still
 * plays, and an older peer drops `town` as an unknown message. `at` is the sender's clock
 * (ms), for the receiver's interpolation timeline; `floor` is the epoch that
 * separates floors. Compact JSON: the two frequent messages travel as
 * arrays with rounded numbers (0.1 px, 0.001 directions, whole ms).
 */
export interface RosterEntry {
  /** Transport peer id. */
  peer: string;
  /** Player id assigned by the host ("p1".."p4"). */
  id: string;
  species: SpeciesId;
  /** The player's nickname as sent in its hello (sanitised by the host); absent from older peers. */
  name?: string;
}

/** Where a peer's walker is in the town (lobby). */
export interface TownPresence {
  /** Overworld map id (src/data/world.ts), passed through as text. */
  map: string;
  pos: { x: number; y: number };
  facing: { x: number; y: number };
  moving: boolean;
}

/**
 * A Santuario de los Juramentos trial for the whole room (docs/gdd.md §3):
 * a boss species, a gauntlet id or a herald's seed, and its tier. Each peer
 * rebuilds the arenas from it (app/shrine-route.ts `trialRequestOf`).
 */
export interface RoomTrial {
  kind: 'boss' | 'gauntlet' | 'herald';
  id: string;
  difficulty: Difficulty;
}

const TRIAL_KINDS = new Set(['boss', 'gauntlet', 'herald']);
const TRIAL_ID = /^[a-z0-9-]{1,40}$/;

/** A room trial from the wire; null for anything malformed (an unknown tier reads as easy, like `start`). */
export function parseRoomTrial(raw: unknown): RoomTrial | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== 'string' || !TRIAL_KINDS.has(r.kind) || typeof r.id !== 'string' || !TRIAL_ID.test(r.id)) return null;
  return { kind: r.kind as RoomTrial['kind'], id: r.id, difficulty: toDifficulty(typeof r.difficulty === 'string' ? r.difficulty : undefined) };
}

export type NetMessage =
  /**
   * A tab joining the session announces its player; the host answers with `start`. Sent again in the
   * lobby when the player picks another species. `shrine: 1` says this peer plays shrine trials (absent: an older peer).
   */
  | { t: 'hello'; species: SpeciesId; loadout: readonly (MoveId | null)[]; name?: string; shrine?: 1 }
  /**
   * Host: the run seed, the current floor, the dungeon id (absent = the first dungeon), the difficulty tier
   * (absent or unknown = easy: an older host) and who is who (sent again whenever someone joins).
   */
  | { t: 'start'; seed: number; floor: number; dungeon?: string; difficulty?: string; players: readonly RosterEntry[]; trial?: RoomTrial }
  /** Host, before the run starts: who is in the room so far, the tier and the shrine trial it picked, for the guests to see (sent again on every change). */
  | { t: 'lobby'; players: readonly RosterEntry[]; difficulty?: string; trial?: RoomTrial }
  /** Host: the room already has four players; `peer` is the one turned away. */
  | { t: 'full'; peer: string }
  /** Round-trip probe (reliable, ~1 Hz); every peer answers with `pong` to the sender. */
  | { t: 'ping'; at: number }
  | { t: 'pong'; to: string; at: number }
  | { t: 'state'; at: number; floor: number; p: PlayerSnapshot }
  | { t: 'claim'; claims: readonly HitClaim[] }
  /** Guest: its player walked over Oran Berry `id`; the host decides (first claim wins). */
  | { t: 'pick'; id: string; by: string }
  /** Host: player `to` gets Oran Berry `id` (it heals on receiving this, once). */
  | { t: 'berry'; id: string; to: string }
  | { t: 'snap'; at: number; floor: number; s: HostSnapshot }
  /** Host: everyone goes down to this floor. */
  | { t: 'floor'; floor: number }
  /** Host, endless dungeon: its run clock (ms left) on `floor`, about once a second and on every floor change. */
  | { t: 'clock'; ms: number; floor: number }
  | { t: 'leave'; id: string }
  /** This peer's walker in the town lobby (unreliable, ~10 Hz). */
  | ({ t: 'town'; at: number } & TownPresence);

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const ri = (v: number) => Math.round(v);

type Wire = Record<string, unknown> & { t: string };

function encodePlayer(p: PlayerSnapshot): unknown[] {
  const roll = p.roll ? [ri(p.roll.elapsedMs), r3(p.roll.dir.x), r3(p.roll.dir.y)] : 0;
  const a = p.action;
  const action = a ? [a.moveId, a.phase, ri(a.phaseMs), ri(a.chargeMs), a.chargeLevel, r3(a.aimDir.x), r3(a.aimDir.y)] : 0;
  const out: unknown[] = [p.id, p.species, r1(p.pos.x), r1(p.pos.y), r3(p.facing.x), r3(p.facing.y), r1(p.hp), r1(p.maxHp), roll, action];
  const reviving = p.revive !== undefined && p.revive > 0;
  if (p.projectiles.length > 0 || p.hidden || reviving) out.push(p.projectiles.map(encodeProjectile));
  if (p.hidden || reviving) out.push(p.hidden ? 1 : 0);
  // Optional revive progress (ms), last: an older peer ignores it.
  if (reviving) out.push(ri(p.revive!));
  return out;
}

/** A peer's species: one this game can play, else Mimikyu (a newer or hostile peer never crashes the world). */
const playerSpecies = (value: unknown): SpeciesId => (isPlayable(value) ? value : 'mimikyu');

/** Roster entries with a playable species each. */
const withPlayableSpecies = (players: unknown): unknown =>
  Array.isArray(players) ? players.map((p: unknown) => (typeof p === 'object' && p !== null ? { ...p, species: playerSpecies((p as { species?: unknown }).species) } : p)) : players;

function decodePlayer(w: unknown[]): PlayerSnapshot {
  const [id, species, x, y, fx, fy, hp, maxHp, roll, action, shots, hidden, revive] = w as [string, SpeciesId, number, number, number, number, number, number, unknown, unknown, unknown, unknown, unknown];
  const r = Array.isArray(roll) ? (roll as number[]) : null;
  const a = Array.isArray(action) ? (action as [MoveId, ActionPhase, number, number, number, number, number]) : null;
  return {
    id,
    species: playerSpecies(species),
    pos: { x, y },
    facing: { x: fx, y: fy },
    hp,
    maxHp,
    roll: r ? { elapsedMs: r[0]!, dir: { x: r[1]!, y: r[2]! } } : null,
    action: a ? { moveId: a[0], phase: a[1], phaseMs: a[2], chargeMs: a[3], chargeLevel: a[4], aimDir: { x: a[5], y: a[6] } } : null,
    projectiles: Array.isArray(shots) ? (shots as unknown[][]).map(decodeProjectile) : [],
    ...(hidden === 1 ? { hidden: true } : {}),
    ...(finite(revive) && revive > 0 ? { revive } : {}),
  };
}

function encodeEnemy(e: EnemySnapshot): unknown[] {
  const out: unknown[] = [
    e.id,
    e.species,
    r1(e.pos.x),
    r1(e.pos.y),
    r3(e.facing.x),
    r3(e.facing.y),
    r1(e.hp),
    e.alive ? 1 : 0,
    ri(e.hitstunMs),
    e.ai.mode,
    ri(e.ai.modeMs),
    ri(e.ai.modeDurationMs),
    r3(e.ai.attackDir.x),
    r3(e.ai.attackDir.y),
  ];
  const elite = e.elite !== undefined;
  const named = e.ai.attack !== undefined || e.ai.aimPoint !== undefined || e.spent === true || elite;
  if (e.boss || named) out.push(e.boss?.stance ?? null, e.boss?.comboIndex ?? null);
  // Optional named attack and landing point (experimental roster), after the boss slots.
  if (named) out.push(e.ai.attack ?? null, e.ai.aimPoint ? [r1(e.ai.aimPoint.x), r1(e.ai.aimPoint.y)] : null);
  // Optional spent flag (fell by its own blast).
  if (e.spent || elite) out.push(e.spent ? 1 : 0);
  // Optional elite trait (any of data/difficulty.ts `ELITE_TRAIT_DEFS`), "*" while its armor holds, "!" if it strikes positionally, last.
  if (elite) out.push(`${e.elite}${e.armor ? '*' : ''}${e.pierceRoll ? '!' : ''}`);
  return out;
}

function decodeEnemy(w: unknown[]): EnemySnapshot {
  const [id, species, x, y, fx, fy, hp, alive, hitstunMs, mode, modeMs, modeDurationMs, ax, ay, stance, comboIndex, attack, aim, spent, elite] = w as [
    string,
    SpeciesId,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    AiMode,
    number,
    number,
    number,
    number,
    BossStance | null | undefined,
    number | null | undefined,
    string | null | undefined,
    [number, number] | null | undefined,
    number | undefined,
    string | undefined,
  ];
  const trait = typeof elite === 'string' ? elite.replace(/[*!]/g, '') : '';
  return {
    id,
    species,
    pos: { x, y },
    facing: { x: fx, y: fy },
    hp,
    alive: alive === 1,
    hitstunMs,
    ai: {
      mode,
      modeMs,
      modeDurationMs,
      attackDir: { x: ax, y: ay },
      ...(typeof attack === 'string' ? { attack } : {}),
      ...(Array.isArray(aim) ? { aimPoint: { x: aim[0], y: aim[1] } } : {}),
    },
    ...(stance ? { boss: { stance, comboIndex: comboIndex ?? 0 } } : {}),
    ...(spent === 1 ? { spent: true } : {}),
    ...(isEliteTrait(trait) ? { elite: trait, ...(elite!.includes('*') ? { armor: true as const } : {}), ...(elite!.includes('!') ? { pierceRoll: true as const } : {}) } : {}),
  };
}


function encodeProjectile(p: ProjectileSnapshot): unknown[] {
  const out: unknown[] = [p.id, p.type, p.attackerTypes, p.power, r1(p.pos.x), r1(p.pos.y), r1(p.vel.x), r1(p.vel.y), r1(p.radius), ri(p.remainingMs)];
  // Optional positional flag, then the damage multiplier of a weakened enemy's shot (an older peer ignores both).
  if (p.pierceRoll || p.mult !== undefined) out.push(p.pierceRoll ? 1 : 0);
  if (p.mult !== undefined) out.push(r3(p.mult));
  return out;
}

function decodeProjectile(w: unknown[]): ProjectileSnapshot {
  const [id, type, attackerTypes, power, x, y, vx, vy, radius, remainingMs, pierce, mult] = w as [
    string,
    PokemonType,
    PokemonType[],
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number | undefined,
    unknown,
  ];
  return {
    id,
    type,
    attackerTypes,
    power,
    pos: { x, y },
    vel: { x: vx, y: vy },
    radius,
    remainingMs,
    ...(pierce === 1 ? { pierceRoll: true } : {}),
    ...(finite(mult) && mult > 0 && mult <= MAX_SHOT_MULT ? { mult } : {}),
  };
}

/** The largest damage multiplier an enemy shot may carry on the wire (a weakening only lowers it). */
const MAX_SHOT_MULT = 1;

/** Rank-effect statuses of the snap's enemies on the wire: [id, mark damage, mark ms, weaken factor, weaken ms] (null where absent), only enemies that have one. */
type StatusWire = [string, number | null, number | null, number | null, number | null];

function encodeStatuses(enemies: readonly EnemySnapshot[]): StatusWire[] {
  return enemies
    .filter((e) => e.mark || e.weakened)
    .map((e) => [e.id, e.mark ? ri(e.mark.damage) : null, e.mark ? ri(e.mark.ms) : null, e.weakened ? r3(e.weakened.factor) : null, e.weakened ? ri(e.weakened.ms) : null]);
}

/** The snap's enemies with the statuses from the wire laid on (malformed entries are dropped; an older host sends none). */
function withStatuses(enemies: EnemySnapshot[], wire: unknown): EnemySnapshot[] {
  if (!Array.isArray(wire)) return enemies;
  const byId = new Map<string, Pick<EnemySnapshot, 'mark' | 'weakened'>>();
  for (const entry of wire) {
    if (!Array.isArray(entry) || entry.length !== 5 || typeof entry[0] !== 'string') continue;
    const [id, damage, ms, factor, weakMs] = entry as unknown[];
    const mark = finite(damage) && finite(ms) && damage >= 0 && ms >= 0 ? { damage, ms } : undefined;
    const weakened = finite(factor) && finite(weakMs) && factor > 0 && factor <= 1 && weakMs >= 0 ? { factor, ms: weakMs } : undefined;
    byId.set(id as string, { ...(mark ? { mark } : {}), ...(weakened ? { weakened } : {}) });
  }
  return enemies.map((e) => (byId.has(e.id) ? { ...e, ...byId.get(e.id) } : e));
}

/** A gate's progress on the wire: [done, outcome, key x, key y] (key and outcome optional). */
function encodeGate(g: GateSync): unknown[] {
  return [g.done ? 1 : 0, g.outcome ?? null, ...(g.key ? [r1(g.key.x), r1(g.key.y)] : [])];
}

/** A gate's progress from the wire, or undefined when it is not one (an older or hostile host). */
function decodeGate(w: unknown): GateSync | undefined {
  if (!Array.isArray(w) || w.length < 2 || (w[0] !== 0 && w[0] !== 1)) return undefined;
  const outcome = w[1] === 'opened' || w[1] === 'broken' ? w[1] : undefined;
  const key = w.length >= 4 && finite(w[2]) && finite(w[3]) ? { x: w[2], y: w[3] } : undefined;
  return { done: w[0] === 1, ...(outcome ? { outcome } : {}), ...(key ? { key } : {}) };
}

export function encodeMessage(message: NetMessage): string {
  let wire: Wire;
  switch (message.t) {
    case 'state':
      wire = { t: 'state', at: r1(message.at), f: message.floor, p: encodePlayer(message.p) };
      break;
    case 'snap':
      wire = {
        t: 'snap',
        at: r1(message.at),
        f: message.floor,
        k: message.s.tick,
        b: message.s.berries,
        e: message.s.enemies.map(encodeEnemy),
        p: message.s.projectiles.map(encodeProjectile),
        ...(message.s.sima ? { v: message.s.sima } : {}),
        // Co-op party size of the floor (optional: an older guest ignores it).
        ...(message.s.party !== undefined ? { n: message.s.party } : {}),
        // The floor's gate (optional): done flag, outcome, the dropped key's position.
        ...(message.s.gate ? { g: encodeGate(message.s.gate) } : {}),
        // Rank-effect marks and weakenings on enemies (optional: an older guest ignores them).
        ...(encodeStatuses(message.s.enemies).length > 0 ? { x: encodeStatuses(message.s.enemies) } : {}),
      };
      break;
    case 'town':
      wire = { t: 'town', at: r1(message.at), m: message.map, p: [r1(message.pos.x), r1(message.pos.y), r3(message.facing.x), r3(message.facing.y), message.moving ? 1 : 0] };
      break;
    default:
      wire = message as unknown as Wire;
  }
  return JSON.stringify(wire);
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** A town presence from the wire, or null when any field is off (it comes from any peer). */
function decodeTown(wire: Wire): NetMessage | null {
  const p = wire.p;
  if (!finite(wire.at) || typeof wire.m !== 'string' || wire.m.length > 24 || !Array.isArray(p) || p.length !== 5 || !p.every(finite)) return null;
  const [x, y, fx, fy, moving] = p as number[];
  return { t: 'town', at: wire.at, map: wire.m, pos: { x: x!, y: y! }, facing: { x: fx!, y: fy! }, moving: moving === 1 };
}

const KNOWN = new Set(['hello', 'start', 'lobby', 'full', 'ping', 'pong', 'state', 'claim', 'pick', 'berry', 'snap', 'floor', 'clock', 'leave', 'town']);

/** Parses a wire message; null for anything that is not one (the spike trusts the content otherwise). */
export function decodeMessage(text: string): NetMessage | null {
  let wire: Wire;
  try {
    wire = JSON.parse(text) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !KNOWN.has(wire.t)) return null;
  if (wire.t === 'town') return decodeTown(wire);
  if (wire.t === 'state') return { t: 'state', at: wire.at as number, floor: wire.f as number, p: decodePlayer(wire.p as unknown[]) };
  if (wire.t === 'snap') {
    return {
      t: 'snap',
      at: wire.at as number,
      floor: wire.f as number,
      s: {
        tick: wire.k as number,
        berries: Array.isArray(wire.b) ? (wire.b as string[]) : [],
        enemies: withStatuses((wire.e as unknown[][]).map(decodeEnemy), wire.x),
        projectiles: (wire.p as unknown[][]).map(decodeProjectile),
        ...(wire.v && typeof wire.v === 'object' ? { sima: wire.v as SimaSync } : {}),
        ...(finite(wire.n) && wire.n >= 1 && wire.n <= 4 ? { party: Math.floor(wire.n) } : {}),
        ...(decodeGate(wire.g) ? { gate: decodeGate(wire.g)! } : {}),
      },
    };
  }
  if (wire.t === 'hello') return { ...wire, species: playerSpecies(wire.species) } as unknown as NetMessage;
  if (wire.t === 'start' || wire.t === 'lobby') return { ...wire, players: withPlayableSpecies(wire.players) } as unknown as NetMessage;
  return wire as unknown as NetMessage;
}
