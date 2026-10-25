import { ENEMY_BEHAVIOUR } from '../data/enemies';
import type { MoveId } from '../data/moves';
import { SPECIES, type SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import { initialBoss, onBossDamaged } from './boss';
import { initialAi } from './enemies';
import type {
  ActionPhase,
  AiMode,
  BossStance,
  EnemyState,
  GameEvent,
  HitClaim,
  PlayerState,
  ProjectileState,
  RemotePlayer,
  RollState,
  WorldState,
} from './state';
import { vec, type Vec2 } from './vec';
import { createPlayer } from './world';

/**
 * Pure state exchange between peers (docs/gdd.md §12). Each peer owns its
 * player and reports it (`playerSnapshot`); the host owns the enemies and
 * reports them (`hostSnapshot`); guests claim their hits (`HitClaim`, from
 * `hitClaim` events) and the host applies them. Encoding and transport live
 * outside the core (src/net).
 */

/** What a peer tells the others about its own player. */
export interface PlayerSnapshot {
  id: string;
  species: SpeciesId;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  maxHp: number;
  roll: RollState | null;
  action: { moveId: MoveId; phase: ActionPhase; phaseMs: number; chargeMs: number; chargeLevel: number; aimDir: Vec2 } | null;
}

export interface EnemySnapshot {
  id: string;
  species: SpeciesId;
  pos: Vec2;
  facing: Vec2;
  hp: number;
  alive: boolean;
  hitstunMs: number;
  /** Behaviour, for animation, telegraphs and the guest's victim-side melee check. */
  ai: { mode: AiMode; modeMs: number; modeDurationMs: number; attackDir: Vec2 };
  boss?: { stance: BossStance; comboIndex: number };
}

/** An enemy projectile in flight (players' own projectiles stay on their peer). */
export interface ProjectileSnapshot {
  id: string;
  type: PokemonType;
  attackerTypes: readonly PokemonType[];
  power: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  remainingMs: number;
}

export interface HostSnapshot {
  tick: number;
  enemies: readonly EnemySnapshot[];
  projectiles: readonly ProjectileSnapshot[];
}

export function playerSnapshot(state: WorldState): PlayerSnapshot {
  const p = state.player;
  const a = p.action;
  return {
    id: state.localId,
    species: p.species,
    pos: p.pos,
    facing: p.facing,
    hp: p.hp,
    maxHp: p.maxHp,
    roll: p.roll,
    action: a ? { moveId: a.moveId, phase: a.phase, phaseMs: a.phaseMs, chargeMs: a.chargeMs, chargeLevel: a.chargeLevel, aimDir: a.aimDir } : null,
  };
}

function remoteFrom(snapshot: PlayerSnapshot, previous: PlayerState | undefined): PlayerState {
  const base = previous && previous.species === snapshot.species ? previous : createPlayer(snapshot.pos, snapshot.species);
  const action = snapshot.action
    ? { ...snapshot.action, slotIndex: 0, mouseAim: false, hitIds: [] as readonly string[] }
    : null;
  return {
    ...base,
    types: SPECIES[snapshot.species].types,
    pos: snapshot.pos,
    facing: snapshot.facing,
    hp: snapshot.hp,
    maxHp: snapshot.maxHp,
    roll: snapshot.roll,
    action,
  };
}

/** Puts other peers' reported players into the world (the local player's own report is ignored). */
export function applyRemotePlayers(state: WorldState, snapshots: readonly PlayerSnapshot[]): WorldState {
  let remotes: RemotePlayer[] = [...state.remotes];
  for (const snapshot of snapshots) {
    if (snapshot.id === state.localId) continue;
    const previous = remotes.find((r) => r.id === snapshot.id);
    const next = { id: snapshot.id, player: remoteFrom(snapshot, previous?.player) };
    remotes = previous ? remotes.map((r) => (r.id === snapshot.id ? next : r)) : [...remotes, next];
  }
  remotes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { ...state, remotes };
}

/** A peer left: its player is no longer in the world. */
export const removeRemote = (state: WorldState, id: string): WorldState => ({ ...state, remotes: state.remotes.filter((r) => r.id !== id) });

export function hostSnapshot(state: WorldState): HostSnapshot {
  return {
    tick: state.tick,
    enemies: state.enemies.map((e) => ({
      id: e.id,
      species: e.species,
      pos: e.pos,
      facing: e.facing,
      hp: e.hp,
      alive: e.alive,
      hitstunMs: e.hitstunMs,
      ai: { mode: e.ai.mode, modeMs: e.ai.modeMs, modeDurationMs: e.ai.modeDurationMs, attackDir: e.ai.attackDir },
      ...(e.boss ? { boss: { stance: e.boss.stance, comboIndex: e.boss.comboIndex } } : {}),
    })),
    projectiles: state.projectiles
      .filter((p) => p.owner === 'enemy')
      .map((p) => ({
        id: p.id,
        type: p.type,
        attackerTypes: p.attackerTypes,
        power: p.power,
        pos: p.pos,
        vel: p.vel,
        radius: p.radius,
        remainingMs: p.remainingMs,
      })),
  };
}

function freshEnemy(snapshot: EnemySnapshot): EnemyState {
  const species = SPECIES[snapshot.species];
  return {
    id: snapshot.id,
    species: snapshot.species,
    types: species.types,
    pos: snapshot.pos,
    facing: snapshot.facing,
    hp: species.maxHp,
    maxHp: species.maxHp,
    radius: species.radius,
    alive: true,
    hitstunMs: 0,
    knockback: vec(0, 0),
    ai: initialAi(),
    ...(ENEMY_BEHAVIOUR[snapshot.species]?.kind === 'boss' ? { boss: initialBoss() } : {}),
  };
}

/**
 * The guest keeps its own record of whether the attack in progress already
 * met its player: same attack (still attacking, same combo blow, not
 * restarted) keeps it, anything else starts clean.
 */
function sameAttack(local: EnemyState, snapshot: EnemySnapshot): boolean {
  return (
    local.ai.mode === 'attack' &&
    snapshot.ai.mode === 'attack' &&
    (local.boss?.comboIndex ?? 0) === (snapshot.boss?.comboIndex ?? 0) &&
    snapshot.ai.modeMs >= local.ai.modeMs - 1e-6
  );
}

/**
 * Guest: takes the host's enemies and enemy projectiles as they are (host ids
 * win), keeping only the guest's own per-attack contact records and its own
 * player and player projectiles.
 */
export function applyHostSnapshot(state: WorldState, snapshot: HostSnapshot): WorldState {
  const enemies = snapshot.enemies.map((s): EnemyState => {
    const local = state.enemies.find((e) => e.id === s.id && e.species === s.species);
    const base = local ?? freshEnemy(s);
    const contact = local && sameAttack(local, s) ? local.ai.contact : 'none';
    return {
      ...base,
      pos: s.pos,
      facing: s.facing,
      hp: s.hp,
      alive: s.alive,
      hitstunMs: s.hitstunMs,
      knockback: vec(0, 0),
      ai: { ...base.ai, ...s.ai, contact },
      ...(s.boss ? { boss: { ...(base.boss ?? initialBoss()), ...s.boss } } : {}),
    };
  });
  const own = state.projectiles.filter((p) => p.owner === 'player');
  const theirs = snapshot.projectiles.map((s): ProjectileState => {
    const local = state.projectiles.find((p) => p.owner === 'enemy' && p.id === s.id);
    return {
      ...s,
      owner: 'enemy',
      damageMultiplier: 1,
      hitstunMs: 0,
      knockback: 0,
      hitIds: local?.hitIds ?? [],
    };
  });
  return { ...state, enemies, projectiles: [...own, ...theirs] };
}

/** How many applied claim ids the host remembers (claims older than this are long settled). */
const CLAIM_MEMORY = 512;

/**
 * Host: applies guests' hit claims to its enemies, each claim once (a claim
 * id seen before is ignored). Appends the hit events to the state's events.
 */
export function applyHitClaims(state: WorldState, claims: readonly HitClaim[]): WorldState {
  if (claims.length === 0) return state;
  const events: GameEvent[] = [...state.events];
  let applied = state.appliedClaims;
  let enemies = state.enemies;
  for (const claim of claims) {
    if (applied.includes(claim.id)) continue;
    applied = [...applied, claim.id];
    const enemy = enemies.find((e) => e.id === claim.enemyId);
    if (!enemy || !enemy.alive) continue;
    let struck: EnemyState;
    if (claim.blocked) {
      events.push({ type: 'hitBlocked', enemyId: enemy.id, pos: enemy.pos });
      struck = { ...enemy, hp: claim.damage > 0 ? Math.max(1, enemy.hp - claim.damage) : enemy.hp };
    } else {
      const hp = Math.max(0, enemy.hp - claim.damage);
      struck = {
        ...(enemy.boss ? onBossDamaged(enemy, claim.damage) : enemy),
        hp,
        alive: hp > 0,
        hitstunMs: Math.max(enemy.hitstunMs, claim.hitstunMs),
        knockback: claim.knockback,
      };
      events.push({ type: 'enemyHit', enemyId: enemy.id, damage: claim.damage, effectiveness: claim.effectiveness, pos: enemy.pos });
      if (!struck.alive) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    }
    enemies = enemies.map((e) => (e.id === enemy.id ? struck : e));
  }
  return { ...state, enemies, appliedClaims: applied.slice(-CLAIM_MEMORY), events };
}
