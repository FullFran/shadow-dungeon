import type { SimaSync } from '../core/sima-events';
import type { GateSync } from '../core/gates';
import { isEliteTrait, toDifficulty, type Difficulty } from '../data/difficulty';
import { isDungeonId } from '../data/dungeons';
import { MOVES, type MoveId } from '../data/moves';
import { SPECIES, isPlayable, type SpeciesId } from '../data/species';
import { POKEMON_TYPES, type PokemonType } from '../data/types';
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
  /** It wears its line's shiny skin (cosmetic; odd/tasks/shiny-echo.md). */
  shiny?: boolean;
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
   * lobby when the player picks another species. `v` and `c` are its protocol version and content hash (net/version.ts): the host turns away any other.
   * `b` is the sender's build label ("v0.9.0 · e60dcb9", issue #7), only to name it in a refusal; absent from older peers.
   */
  | { t: 'hello'; species: SpeciesId; loadout: readonly (MoveId | null)[]; name?: string; shiny?: boolean; v?: number; c?: string; b?: string }
  /**
   * Host: the run seed, the current floor, the dungeon id (absent = the first dungeon), the difficulty tier
   * (absent or unknown = easy: an older host) and who is who (sent again whenever someone joins).
   */
  | { t: 'start'; seed: number; floor: number; dungeon?: string; difficulty?: string; players: readonly RosterEntry[]; trial?: RoomTrial; v?: number; c?: string; b?: string }
  /** Host, before the run starts: who is in the room so far, the tier and the shrine trial it picked, for the guests to see (sent again on every change). */
  | { t: 'lobby'; players: readonly RosterEntry[]; difficulty?: string; trial?: RoomTrial; v?: number; c?: string; b?: string }
  /**
   * Host: `peer` is turned away: the room already has four players, or (`reason: 'version'`) it runs
   * another version of the game (`b`: the host's build label). An older peer reads either as a full room.
   */
  | { t: 'full'; peer: string; reason?: 'version'; b?: string }
  /** Round-trip probe (reliable, ~1 Hz); every peer answers with `pong` to the sender. */
  | { t: 'ping'; at: number }
  | { t: 'pong'; to: string; at: number }
  /** A peer's own player; `ready`: it confirmed leaving the floor and stands on the stairs (or exit); `afk`: no input for a while (core/gather.ts). */
  | { t: 'state'; at: number; floor: number; p: PlayerSnapshot; ready?: true; afk?: true }
  | { t: 'claim'; claims: readonly HitClaim[] }
  /** Guest: its player walked over Oran Berry `id`; the host decides (first claim wins). */
  | { t: 'pick'; id: string; by: string }
  /** Host: player `to` gets Oran Berry `id` (it heals on receiving this, once). */
  | { t: 'berry'; id: string; to: string }
  | { t: 'snap'; at: number; floor: number; s: HostSnapshot }
  /** Host: everyone goes down to this floor. */
  | { t: 'floor'; floor: number }
  /** Host, after a full party wipe (core/bonfire.ts): `go`, everyone respawns at the bonfire on `floor`; else the run ends. */
  | { t: 'retry'; floor: number; go: boolean }
  /** Host: `peer` knocked during a floor; it is let in at the next join point (a new floor, a bonfire respawn). */
  | { t: 'wait'; peer: string }
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

const PHASES = new Set<string>(['charging', 'windup', 'active', 'recovery']);
const AI_MODES = new Set<string>(['dormant', 'asleep', 'idle', 'approach', 'reposition', 'telegraph', 'attack', 'recover', 'transform']);
const isMove = (id: unknown): id is MoveId => typeof id === 'string' && Object.hasOwn(MOVES, id);
const isSpecies = (id: unknown): id is SpeciesId => typeof id === 'string' && Object.hasOwn(SPECIES, id);
const isType = (id: unknown): id is PokemonType => POKEMON_TYPES.some((type) => type === id);
const allFinite = (values: readonly unknown[]): boolean => values.every(finite);

/** A player from the wire, or null when its id or a number is off (an action with an unknown move is dropped). */
function decodePlayer(w: unknown): PlayerSnapshot | null {
  if (!Array.isArray(w)) return null;
  const [id, species, x, y, fx, fy, hp, maxHp, roll, action, shots, hidden, revive] = w as [unknown, unknown, number, number, number, number, number, number, unknown, unknown, unknown, unknown, unknown];
  if (typeof id !== 'string' || !allFinite([x, y, fx, fy, hp, maxHp])) return null;
  const r = Array.isArray(roll) && roll.length === 3 && allFinite(roll) ? (roll as number[]) : null;
  const a = Array.isArray(action) && action.length === 7 && isMove(action[0]) && PHASES.has(action[1]) && allFinite(action.slice(2)) ? (action as [MoveId, ActionPhase, number, number, number, number, number]) : null;
  return {
    id,
    species: playerSpecies(species),
    pos: { x, y },
    facing: { x: fx, y: fy },
    hp,
    maxHp,
    roll: r ? { elapsedMs: r[0]!, dir: { x: r[1]!, y: r[2]! } } : null,
    action: a ? { moveId: a[0], phase: a[1], phaseMs: a[2], chargeMs: a[3], chargeLevel: a[4], aimDir: { x: a[5], y: a[6] } } : null,
    projectiles: decodeList(shots, decodeProjectile),
    ...(hidden === 1 ? { hidden: true } : {}),
    ...(finite(revive) && revive > 0 ? { revive } : {}),
  };
}

/** The well-formed entries of a wire list (anything else, or a list that is not one, is dropped). */
function decodeList<T>(wire: unknown, decode: (w: unknown) => T | null): T[] {
  return Array.isArray(wire) ? wire.flatMap((w) => decode(w) ?? []) : [];
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

/** An enemy from the wire, or null when its id, species (of another version) or a number is off. */
function decodeEnemy(w: unknown): EnemySnapshot | null {
  if (!Array.isArray(w)) return null;
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
  if (typeof id !== 'string' || !isSpecies(species) || !allFinite([x, y, fx, fy, hp, hitstunMs, modeMs, modeDurationMs, ax, ay])) return null;
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
      mode: AI_MODES.has(mode) ? mode : 'idle',
      modeMs,
      modeDurationMs,
      attackDir: { x: ax, y: ay },
      ...(typeof attack === 'string' ? { attack } : {}),
      ...(Array.isArray(aim) && aim.length === 2 && allFinite(aim) ? { aimPoint: { x: aim[0], y: aim[1] } } : {}),
    },
    ...(typeof stance === 'string' ? { boss: { stance, comboIndex: finite(comboIndex) ? comboIndex : 0 } } : {}),
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

/** A projectile from the wire, or null when its id, type or a number is off. */
function decodeProjectile(w: unknown): ProjectileSnapshot | null {
  if (!Array.isArray(w)) return null;
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
  if (typeof id !== 'string' || !isType(type) || !allFinite([power, x, y, vx, vy, radius, remainingMs])) return null;
  return {
    id,
    type,
    attackerTypes: Array.isArray(attackerTypes) ? attackerTypes.filter(isType) : [type],
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
      // `sh`: the player wears its shiny skin (outside the positional player array, optional).
      wire = { t: 'state', at: r1(message.at), f: message.floor, p: encodePlayer(message.p), ...(message.ready ? { r: 1 } : {}), ...(message.afk ? { a: 1 } : {}), ...(message.p.shiny ? { sh: 1 } : {}) };
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
        // A boss room's fog still closed (core/fog-wall.ts).
        ...(message.s.fogWall ? { w: 1 } : {}),
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

const KNOWN = new Set(['hello', 'start', 'lobby', 'full', 'ping', 'pong', 'state', 'claim', 'pick', 'berry', 'snap', 'floor', 'retry', 'wait', 'clock', 'leave', 'town']);

const PLAYER_ID = /^p[1-4]$/;

/** A roster entry from the wire with a playable species, or null when its peer or player id is off. */
function decodeRosterEntry(raw: unknown): RosterEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.peer !== 'string' || typeof r.id !== 'string' || !PLAYER_ID.test(r.id)) return null;
  return { peer: r.peer, id: r.id, species: playerSpecies(r.species), ...(typeof r.name === 'string' ? { name: r.name } : {}), ...(r.shiny === true ? { shiny: true } : {}) };
}

/** A guest's hit claim, or null when an id or a number is off (the host applies it to its world). */
function decodeClaim(raw: unknown): HitClaim | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const knockback = c.knockback as Record<string, unknown> | null | undefined;
  if (typeof c.id !== 'string' || typeof c.playerId !== 'string' || typeof c.enemyId !== 'string') return null;
  if (!allFinite([c.damage, c.effectiveness, c.hitstunMs]) || typeof knockback !== 'object' || knockback === null || !allFinite([knockback.x, knockback.y])) return null;
  return c as unknown as HitClaim;
}

/** A floor number from the wire: a whole number from 1 up. */
const isFloor = (v: unknown): v is number => finite(v) && Number.isInteger(v) && v >= 1;

/**
 * Parses a wire message; null for anything that is not one. Ids that name
 * content (species, moves, types, dungeons, players) are checked against
 * this build: an entry with an unknown one is dropped, never trusted.
 */
/** A build label as shown to players ("v0.9.0 · e60dcb9"): short, plain characters only; anything else is dropped. */
export const BUILD_LABEL = /^[\w .·+-]{1,40}$/u;
const buildOf = (b: unknown): { b?: string } => (typeof b === 'string' && BUILD_LABEL.test(b) ? { b } : {});
/** The wire without its build label, then the label back only when it is a valid one. */
function checkedBuild(wire: Wire): Wire {
  const { b, ...rest } = wire;
  return { ...rest, ...buildOf(b) } as Wire;
}

export function decodeMessage(text: string): NetMessage | null {
  let wire: Wire;
  try {
    wire = JSON.parse(text) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !KNOWN.has(wire.t)) return null;
  switch (wire.t) {
    case 'town':
      return decodeTown(wire);
    case 'state': {
      const p = decodePlayer(wire.p);
      if (!p || !finite(wire.at) || !isFloor(wire.f)) return null;
      return { t: 'state', at: wire.at, floor: wire.f, p: wire.sh === 1 ? { ...p, shiny: true } : p, ...(wire.r === 1 ? { ready: true as const } : {}), ...(wire.a === 1 ? { afk: true as const } : {}) };
    }
    case 'snap':
      if (!finite(wire.at) || !isFloor(wire.f) || !finite(wire.k)) return null;
      return {
        t: 'snap',
        at: wire.at,
        floor: wire.f,
        s: {
          tick: wire.k,
          berries: Array.isArray(wire.b) ? wire.b.filter((b): b is string => typeof b === 'string') : [],
          enemies: withStatuses(decodeList(wire.e, decodeEnemy), wire.x),
          projectiles: decodeList(wire.p, decodeProjectile),
          ...(wire.v && typeof wire.v === 'object' ? { sima: wire.v as SimaSync } : {}),
          ...(finite(wire.n) && wire.n >= 1 && wire.n <= 4 ? { party: Math.floor(wire.n) } : {}),
          ...(decodeGate(wire.g) ? { gate: decodeGate(wire.g)! } : {}),
          ...(wire.w === 1 ? { fogWall: true as const } : {}),
        },
      };
    case 'hello':
      // The skin flag reads as set only when it is exactly true (absent from an older peer).
      return { ...checkedBuild(wire), species: playerSpecies(wire.species), shiny: wire.shiny === true ? true : undefined, loadout: Array.isArray(wire.loadout) ? wire.loadout.map((m) => (isMove(m) ? m : null)) : [] } as unknown as NetMessage;
    case 'start':
      // A dungeon this build does not know: the host runs other content (the version gate stops that first).
      if (!finite(wire.seed) || !isFloor(wire.floor) || (wire.dungeon !== undefined && !isDungeonId(wire.dungeon))) return null;
      return { ...checkedBuild(wire), players: decodeList(wire.players, decodeRosterEntry) } as unknown as NetMessage;
    case 'lobby':
      return { ...checkedBuild(wire), players: decodeList(wire.players, decodeRosterEntry) } as unknown as NetMessage;
    case 'full':
      return typeof wire.peer === 'string' ? { t: 'full', peer: wire.peer, ...(wire.reason === 'version' ? { reason: 'version' as const, ...buildOf(wire.b) } : {}) } : null;
    case 'claim':
      return { t: 'claim', claims: decodeList(wire.claims, decodeClaim) };
    case 'pick':
    case 'berry':
      return typeof wire.id === 'string' && typeof (wire.t === 'pick' ? wire.by : wire.to) === 'string' ? (wire as unknown as NetMessage) : null;
    case 'floor':
      return isFloor(wire.floor) ? { t: 'floor', floor: wire.floor } : null;
    case 'retry':
      return isFloor(wire.floor) && typeof wire.go === 'boolean' ? { t: 'retry', floor: wire.floor, go: wire.go } : null;
    case 'wait':
      return typeof wire.peer === 'string' ? { t: 'wait', peer: wire.peer } : null;
    case 'leave':
      return typeof wire.id === 'string' ? { t: 'leave', id: wire.id } : null;
    default:
      return wire as unknown as NetMessage;
  }
}
