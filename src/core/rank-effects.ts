import { MOVES, type BuffDef, type HitboxDef, type MoveDef, type MoveId, type ZoneDef } from '../data/moves';
import { RANK_EFFECTS, type RankEffect } from '../data/rank-effects';
import { MAX_RANK } from '../data/tutor';
import { onBossDamaged } from './boss';
import { cardHpFloor } from './cards';
import type { EnemyState, GameEvent, HitEffects, PlayerState, ProjectileState, WorldState } from './state';
import { enemyTimeScale } from './time';
import { scale, vec, type Vec2 } from './vec';

/**
 * The tutor's rank effects (odd/tasks/move-progression.md T2), pure. A
 * ranked move is its definition with the effects of ranks 1..rank folded in
 * (`rankedMove`): numbers change (size, stagger, crit, drain, hits, homing,
 * the buff), and generic fields switch on (`mark`, `split`, `weaken`, `zone`,
 * `rethrow`, `chain`, `ward`, `iframes`, `heal`: data/moves.ts) that combat
 * reads. An unranked move is returned as it is, so a plain run's state never
 * changes (golden digest).
 */

const scaleHitbox = (hitbox: HitboxDef, k: number): HitboxDef => {
  if (hitbox.kind === 'arc') return { ...hitbox, range: hitbox.range * k };
  if (hitbox.kind === 'dash' || hitbox.kind === 'projectile') return { ...hitbox, radius: hitbox.radius * k };
  return hitbox;
};

function strongerBuff(buff: BuffDef | undefined, e: Extract<RankEffect, { kind: 'buff' }>): BuffDef | undefined {
  if (!buff || buff.kind === 'kindle') return buff;
  const durationMs = buff.durationMs + (e.durationMs ?? 0);
  if (buff.kind === 'power') return { ...buff, durationMs, hits: buff.hits + (e.hits ?? 0), multiplier: buff.multiplier + (e.multiplier ?? 0) };
  if (buff.kind === 'haste') return { ...buff, durationMs, speed: buff.speed + (e.speed ?? 0), critChance: buff.critChance + (e.critChance ?? 0) };
  if (buff.kind === 'guard') return { ...buff, durationMs, damageTaken: Math.max(0.2, buff.damageTaken + (e.damageTaken ?? 0)) };
  return { ...buff, durationMs, multiplier: buff.multiplier + (e.multiplier ?? 0), damageTaken: Math.max(0.2, buff.damageTaken + (e.damageTaken ?? 0)) };
}

/** `move` with one rank effect folded in. */
export function applyRankEffect(move: MoveDef, e: RankEffect): MoveDef {
  switch (e.kind) {
    case 'crit':
      return { ...move, critBonus: (move.critBonus ?? 0) + e.bonus };
    case 'size':
      return { ...move, hitbox: scaleHitbox(move.hitbox, e.multiplier) };
    case 'dot':
      // A move that already burns (or poisons) always does; otherwise the rank adds the chance.
      return move.dot ? move : { ...move, dot: e.dot, dotChance: e.chance };
    case 'mark':
      return { ...move, mark: { share: e.share, delayMs: e.delayMs } };
    case 'split':
      return { ...move, split: { count: e.count, share: e.share } };
    case 'weaken':
      return { ...move, weaken: { factor: e.factor, durationMs: e.durationMs } };
    case 'zone': {
      const { kind: _kind, ...zone } = e;
      return { ...move, zone };
    }
    case 'hits':
      return { ...move, multiHit: (move.multiHit ?? 1) + e.add };
    case 'return':
      return { ...move, rethrow: { times: e.times, share: e.share } };
    case 'chain':
      return { ...move, chain: { share: e.share, range: e.range } };
    case 'ward':
      return { ...move, ward: { damageTaken: e.damageTaken, durationMs: e.durationMs } };
    case 'iframes':
      return { ...move, iframes: true };
    case 'buff': {
      const buff = strongerBuff(move.buff, e);
      return buff ? { ...move, buff } : move;
    }
    case 'drain':
      return { ...move, drain: (move.drain ?? 0) + e.share };
    case 'stagger':
      return { ...move, hitstunMs: move.hitstunMs * e.multiplier, knockback: move.knockback * e.multiplier };
    case 'homing':
      return move.hitbox.kind === 'projectile' ? { ...move, hitbox: { ...move.hitbox, homing: Math.max(move.hitbox.homing ?? 0, e.degPerSec) } } : move;
    case 'heal':
      return { ...move, heal: (move.heal ?? 0) + e.share };
  }
}

/** The rank effects that ranks 1..`rank` of `id` add, in order. */
export const rankEffectsOf = (id: MoveId, rank: number): readonly RankEffect[] => RANK_EFFECTS[id].slice(0, Math.max(0, Math.min(MAX_RANK, Math.floor(rank))));

const cache = new Map<string, MoveDef>();

/** `MOVES[id]` at `rank` (0 or none: the plain definition, the same object). */
export function rankedMove(id: MoveId, rank: number | undefined): MoveDef {
  const base = MOVES[id];
  const r = Math.max(0, Math.min(MAX_RANK, Math.floor(rank ?? 0)));
  if (r === 0) return base;
  const key = `${id}:${r}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const ranked = rankEffectsOf(id, r).reduce(applyRankEffect, base);
  cache.set(key, ranked);
  return ranked;
}

/** The player's version of a move: with its Mejoras (PlayerState.moveRanks). */
export const playerMove = (player: Pick<PlayerState, 'moveRanks'>, id: MoveId): MoveDef => rankedMove(id, player.moveRanks?.[id]);

/** The rank effects a move's hits carry (only the fields it has). */
export function rankHitEffects(move: MoveDef): HitEffects {
  return {
    ...(move.dot && move.dotChance !== undefined ? { dotChance: move.dotChance } : {}),
    ...(move.mark ? { mark: move.mark } : {}),
    ...(move.weaken ? { weaken: move.weaken } : {}),
    ...(move.chain ? { chain: move.chain } : {}),
    ...(move.zone?.at === 'impact' ? { zone: move.zone } : {}),
  };
}

/** What a zone, a split shot or a chained hit carries on: only the burn or poison (nothing that spawns more). */
export function childEffects(effects: HitEffects | undefined): HitEffects | undefined {
  if (!effects?.dot) return undefined;
  return { dot: effects.dot, ...(effects.dotChance !== undefined ? { dotChance: effects.dotChance } : {}) };
}

/** A player zone at `pos` (core/combat.ts moves it and resolves its hits like any player projectile). */
export function zoneProjectile(state: WorldState, zone: ZoneDef, pos: Vec2, from: { type: MoveDef['type']; multiplier: number; moveId: MoveId }, delayMs = zone.delayMs ?? 0): WorldState {
  const projectile: ProjectileState = {
    id: `p${state.nextId}`,
    owner: 'player',
    type: from.type,
    attackerTypes: state.player.types,
    power: zone.power,
    damageMultiplier: from.multiplier,
    pos,
    vel: vec(0, 0),
    radius: zone.radius,
    remainingMs: zone.lifetimeMs + delayMs,
    hitstunMs: 0,
    knockback: 0,
    hitIds: [],
    pierce: true,
    wave: true,
    zone: true,
    ...(delayMs > 0 ? { armMs: delayMs } : {}),
    ...(zone.every ? { linger: zone.every, lingerMs: zone.every } : {}),
    ...(zone.dot ? { effects: { dot: zone.dot } } : {}),
    moveId: from.moveId,
  };
  return { ...state, nextId: state.nextId + 1, projectiles: [...state.projectiles, projectile] };
}

/** The shots a split shot bursts into at `pos`, fanning out along `dir` (the struck enemy is not hit again). */
export function splitShots(state: WorldState, p: ProjectileState, pos: Vec2, dir: Vec2, struckId: string): WorldState {
  if (!p.split) return state;
  const { count, share } = p.split;
  const spread = count <= 1 ? 0 : (count <= 2 ? 50 : 90) * (Math.PI / 180);
  const speed = Math.hypot(p.vel.x, p.vel.y) || 160;
  const base = Math.atan2(dir.y, dir.x);
  let current = state;
  for (let i = 0; i < count; i++) {
    const angle = count <= 1 ? base : base - spread / 2 + (spread * i) / (count - 1);
    const child: ProjectileState = {
      id: `p${current.nextId}`,
      owner: 'player',
      type: p.type,
      attackerTypes: p.attackerTypes,
      power: Math.max(1, Math.round(p.power * share)),
      damageMultiplier: p.damageMultiplier,
      pos,
      vel: scale(vec(Math.cos(angle), Math.sin(angle)), speed),
      radius: Math.max(3, p.radius * 0.6),
      remainingMs: 500,
      hitstunMs: p.hitstunMs * 0.5,
      knockback: p.knockback * 0.5,
      hitIds: [struckId],
      ...(childEffects(p.effects) ? { effects: childEffects(p.effects)! } : {}),
      ...(p.moveId ? { moveId: p.moveId } : {}),
      secondary: true,
    };
    current = { ...current, nextId: current.nextId + 1, projectiles: [...current.projectiles, child] };
  }
  return current;
}

/** After a landed hit of `damage` on a survivor: a mark (if none is pending) and a weakening. */
export function markAndWeaken(enemy: EnemyState, effects: HitEffects | undefined, damage: number): EnemyState {
  if (!effects || !enemy.alive) return enemy;
  let next = enemy;
  if (effects.mark && !enemy.mark) next = { ...next, mark: { damage: Math.max(1, Math.round(damage * effects.mark.share)), ms: effects.mark.delayMs } };
  if (effects.weaken) next = { ...next, weakened: { factor: effects.weaken.factor, ms: effects.weaken.durationMs } };
  return next;
}

/** The factor an enemy's hits deal (1 unless weakened). */
export const weakenFactor = (enemy: Pick<EnemyState, 'weakened'>): number => enemy.weakened?.factor ?? 1;

/**
 * Host (and solo), every step: marks count down at the enemy time scale and
 * burst (a spell card's floor holds, as for hits), weakenings wear off.
 */
export function tickRankStatus(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  if (!state.enemies.some((e) => e.mark || e.weakened)) return state;
  const ms = dtMs * enemyTimeScale(state);
  const enemies = state.enemies.map((enemy) => {
    if (!enemy.mark && !enemy.weakened) return enemy;
    const { mark, weakened, ...clean } = enemy;
    if (!enemy.alive) return clean;
    let next: EnemyState = clean;
    if (weakened && weakened.ms - ms > 0) next = { ...next, weakened: { ...weakened, ms: weakened.ms - ms } };
    if (mark && mark.ms - ms > 0) return { ...next, mark: { ...mark, ms: mark.ms - ms } };
    if (!mark) return next;
    const hp = Math.max(Math.min(cardHpFloor(enemy), enemy.hp), enemy.hp - mark.damage);
    const dealt = enemy.hp - hp;
    if (dealt > 0) events.push({ type: 'enemyHit', enemyId: enemy.id, damage: dealt, effectiveness: 1, pos: enemy.pos, burst: true });
    if (hp <= 0) events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    return { ...(enemy.boss ? onBossDamaged(next, dealt) : next), hp, alive: hp > 0 };
  });
  return { ...state, enemies };
}

/** A ranked move with super-armor starts it as the move starts. */
export const startWard = (player: PlayerState, move: MoveDef): PlayerState =>
  move.ward ? { ...player, ward: { damageTaken: move.ward.damageTaken, remainingMs: move.ward.durationMs } } : player;

/** Super-armor runs down on the player's clock (the field is dropped when spent). */
export function tickWard(player: PlayerState, dtMs: number): PlayerState {
  if (!player.ward) return player;
  const remainingMs = player.ward.remainingMs - dtMs;
  const { ward: _spent, ...rest } = player;
  return remainingMs > 0 ? { ...player, ward: { ...player.ward, remainingMs } } : rest;
}

/** Damage-taken factor of the running super-armor (1 without). */
export const wardDamageTaken = (player: Pick<PlayerState, 'ward'>): number => player.ward?.damageTaken ?? 1;

/** The player is in the active phase of a ranked move with i-frames. */
export const moveIframes = (player: Pick<PlayerState, 'action' | 'moveRanks'>): boolean =>
  player.action?.phase === 'active' && Boolean(player.moveRanks?.[player.action.moveId]) && playerMove(player, player.action.moveId).iframes === true;

/** A ranked move that heals as it takes hold. */
export const healOnUse = (player: PlayerState, move: MoveDef): PlayerState =>
  move.heal && player.hp > 0 ? { ...player, hp: Math.min(player.maxHp, player.hp + player.maxHp * move.heal) } : player;
