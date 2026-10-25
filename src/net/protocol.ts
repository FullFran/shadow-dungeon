import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import type { ActionPhase, AiMode, BossStance, HitClaim } from '../core/state';
import type { EnemySnapshot, HostSnapshot, PlayerSnapshot, ProjectileSnapshot } from '../core/sync';

/**
 * Netcode spike protocol (docs/gdd.md §12). Reliable: hello, start, lobby,
 * full, ping, pong, claim, pick, berry, floor, clock, leave. Unreliable at ~20 Hz: state (every peer, its own player) and
 * snap (host: enemies and enemy projectiles). `at` is the sender's clock
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
}

export type NetMessage =
  /** A tab joining the session announces its player; the host answers with `start`. */
  | { t: 'hello'; species: SpeciesId; loadout: readonly (MoveId | null)[] }
  /** Host: the run seed, the current floor, the dungeon id (absent = the first dungeon) and who is who (sent again whenever someone joins). */
  | { t: 'start'; seed: number; floor: number; dungeon?: string; players: readonly RosterEntry[] }
  /** Host, before the run starts: who is in the room so far (sent again on every change). */
  | { t: 'lobby'; players: readonly RosterEntry[] }
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
  | { t: 'leave'; id: string };

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const ri = (v: number) => Math.round(v);

type Wire = Record<string, unknown> & { t: string };

function encodePlayer(p: PlayerSnapshot): unknown[] {
  const roll = p.roll ? [ri(p.roll.elapsedMs), r3(p.roll.dir.x), r3(p.roll.dir.y)] : 0;
  const a = p.action;
  const action = a ? [a.moveId, a.phase, ri(a.phaseMs), ri(a.chargeMs), a.chargeLevel, r3(a.aimDir.x), r3(a.aimDir.y)] : 0;
  const out: unknown[] = [p.id, p.species, r1(p.pos.x), r1(p.pos.y), r3(p.facing.x), r3(p.facing.y), r1(p.hp), r1(p.maxHp), roll, action];
  if (p.projectiles.length > 0 || p.hidden) out.push(p.projectiles.map(encodeProjectile));
  if (p.hidden) out.push(1);
  return out;
}

function decodePlayer(w: unknown[]): PlayerSnapshot {
  const [id, species, x, y, fx, fy, hp, maxHp, roll, action, shots, hidden] = w as [string, SpeciesId, number, number, number, number, number, number, unknown, unknown, unknown, unknown];
  const r = Array.isArray(roll) ? (roll as number[]) : null;
  const a = Array.isArray(action) ? (action as [MoveId, ActionPhase, number, number, number, number, number]) : null;
  return {
    id,
    species,
    pos: { x, y },
    facing: { x: fx, y: fy },
    hp,
    maxHp,
    roll: r ? { elapsedMs: r[0]!, dir: { x: r[1]!, y: r[2]! } } : null,
    action: a ? { moveId: a[0], phase: a[1], phaseMs: a[2], chargeMs: a[3], chargeLevel: a[4], aimDir: { x: a[5], y: a[6] } } : null,
    projectiles: Array.isArray(shots) ? (shots as unknown[][]).map(decodeProjectile) : [],
    ...(hidden === 1 ? { hidden: true } : {}),
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
  const named = e.ai.attack !== undefined || e.ai.aimPoint !== undefined || e.spent === true;
  if (e.boss || named) out.push(e.boss?.stance ?? null, e.boss?.comboIndex ?? null);
  // Optional named attack and landing point (experimental roster), after the boss slots.
  if (named) out.push(e.ai.attack ?? null, e.ai.aimPoint ? [r1(e.ai.aimPoint.x), r1(e.ai.aimPoint.y)] : null);
  // Optional spent flag (fell by its own blast), last.
  if (e.spent) out.push(1);
  return out;
}

function decodeEnemy(w: unknown[]): EnemySnapshot {
  const [id, species, x, y, fx, fy, hp, alive, hitstunMs, mode, modeMs, modeDurationMs, ax, ay, stance, comboIndex, attack, aim, spent] = w as [
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
  ];
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
  };
}

function encodeProjectile(p: ProjectileSnapshot): unknown[] {
  return [p.id, p.type, p.attackerTypes, p.power, r1(p.pos.x), r1(p.pos.y), r1(p.vel.x), r1(p.vel.y), r1(p.radius), ri(p.remainingMs)];
}

function decodeProjectile(w: unknown[]): ProjectileSnapshot {
  const [id, type, attackerTypes, power, x, y, vx, vy, radius, remainingMs] = w as [
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
  ];
  return { id, type, attackerTypes, power, pos: { x, y }, vel: { x: vx, y: vy }, radius, remainingMs };
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
      };
      break;
    default:
      wire = message as unknown as Wire;
  }
  return JSON.stringify(wire);
}

const KNOWN = new Set(['hello', 'start', 'lobby', 'full', 'ping', 'pong', 'state', 'claim', 'pick', 'berry', 'snap', 'floor', 'clock', 'leave']);

/** Parses a wire message; null for anything that is not one (the spike trusts the content otherwise). */
export function decodeMessage(text: string): NetMessage | null {
  let wire: Wire;
  try {
    wire = JSON.parse(text) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object' || !KNOWN.has(wire.t)) return null;
  if (wire.t === 'state') return { t: 'state', at: wire.at as number, floor: wire.f as number, p: decodePlayer(wire.p as unknown[]) };
  if (wire.t === 'snap') {
    return {
      t: 'snap',
      at: wire.at as number,
      floor: wire.f as number,
      s: {
        tick: wire.k as number,
        berries: Array.isArray(wire.b) ? (wire.b as string[]) : [],
        enemies: (wire.e as unknown[][]).map(decodeEnemy),
        projectiles: (wire.p as unknown[][]).map(decodeProjectile),
      },
    };
  }
  return wire as unknown as NetMessage;
}
