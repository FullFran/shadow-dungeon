import type { DanmakuCard, DanmakuCardDef, DanmakuDef, DanmakuShot, EnemyAttackDef } from '../data/enemies';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, rotate, spawnShot, towardTarget } from './brain';
import { confineCircle } from './geometry';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { add, angleOf, distance, fromAngle, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * The caves' bullet-hell bosses, Lanturn and Dhelmise (data/enemies.ts
 * `DanmakuDef`): spell cards in a fixed order, each announced by name (the
 * HUD reads it from `boss.stance`), telegraphed (`telegraph`), played
 * (`attack`) and followed by an opening (`recover`), then a rest while it
 * drifts at its distance. Everything a guest needs to draw the card and to
 * check its melee part on its own player travels in the snapshot fields:
 * the card in `boss.stance`, the aim in `ai.attackDir`, the mark or the safe
 * lane in `ai.aimPoint`, the progress in `ai.modeMs`. The phase is host-only.
 *
 * Patterns: rings with a gap (the first gap faces the player, then it turns),
 * spirals (the space between arms is the way through), lane walls with a safe
 * lane that shifts every other wave, a swung anchor (sweep) and a marked
 * circle that bursts (zone). Enemy shots stop at `maxShots`.
 */
const PLAYER_RADIUS = TUNING.player.radius;
const DEG = Math.PI / 180;

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** The card order in play: phase 2's once awakened. */
export const cardsOf = (def: DanmakuDef, boss: Pick<BossState, 'phase'>): readonly DanmakuCard[] => (boss.phase === 2 && def.phase2 ? def.phase2.cards : def.cards);

export const danmakuCardAt = (def: DanmakuDef, boss: Pick<BossState, 'phase' | 'combosDone'>): DanmakuCard => {
  const cards = cardsOf(def, boss);
  return cards[boss.combosDone % cards.length]!;
};

export const cardDef = (def: DanmakuDef, card: string): DanmakuCardDef | undefined => def.patterns[card as DanmakuCard];

/** Multiples k * `every` (k >= 1, k < count) passed between `before` (exclusive) and `now` (inclusive). */
function crossed(before: number, now: number, every: number, count: number): number[] {
  const out: number[] = [];
  for (let k = Math.max(1, Math.floor(before / every)); k < count; k++) {
    const at = k * every;
    if (at > now) break;
    if (at > before) out.push(k);
  }
  return out;
}

const enemyShots = (state: WorldState): number => state.projectiles.reduce((n, p) => n + (p.owner === 'enemy' ? 1 : 0), 0);

/** Fires one shot unless the room already holds `maxShots` enemy shots (the cap only ever widens the gaps). */
function shoot(state: WorldState, enemy: EnemyState, def: DanmakuDef, shot: DanmakuShot, dir: Vec2, at?: Vec2): WorldState {
  if (enemyShots(state) >= def.maxShots) return state;
  return spawnShot(state, enemy, shot, dir, at);
}

/**
 * Directions of ring `index`: `perRing` slots evenly spaced, `gap` of them
 * left empty around the gap centre (the aim for ring 0, turned by
 * `gapTurnDeg` per ring).
 */
export function ringDirections(aim: Vec2, perRing: number, gap: number, gapTurnDeg: number, index: number): Vec2[] {
  const step = 360 / perRing;
  const gapCentre = angleOf(aim) / DEG + index * gapTurnDeg;
  const filled = perRing - gap;
  // Slots run from just past the gap all the way round to just before it.
  return Array.from({ length: filled }, (_, i) => fromAngle((gapCentre + (gap / 2 + 0.5 + i) * step) * DEG));
}

/** Spiral shot `n`: one per arm, the arms evenly spaced, the whole spiral turning `turnDegPerShot` a shot. */
export function spiralDirections(aim: Vec2, arms: number, turnDegPerShot: number, n: number): Vec2[] {
  return Array.from({ length: arms }, (_, arm) => rotate(aim, n * turnDegPerShot + (arm * 360) / arms));
}

/** Centre of the safe lane of wave `index` (x for walls moving up or down): wave 0 where the mark was, odd waves shifted towards the open side. */
export function laneGap(arenaWidth: number, markX: number, gapWidth: number, shiftPx: number, index: number): number {
  const lo = gapWidth / 2 + 8;
  const hi = arenaWidth - gapWidth / 2 - 8;
  const side = markX < arenaWidth / 2 ? 1 : -1;
  const x = index % 2 === 1 ? markX + side * shiftPx : markX;
  return Math.min(hi, Math.max(lo, x));
}

/** The x of each kelp shot of one wave: every `spacing` px, none inside the safe lane. */
export function laneShots(arenaWidth: number, gapX: number, gapWidth: number, spacing: number): number[] {
  const out: number[] = [];
  for (let x = spacing / 2; x < arenaWidth; x += spacing) if (Math.abs(x - gapX) > gapWidth / 2) out.push(x);
  return out;
}

/** Where the anchor's arm points `modeMs` into a sweep: from half the sweep before the aim to half after it. */
export function sweepAngle(aim: Vec2, sweepDeg: number, sweepMs: number, modeMs: number): number {
  return angleOf(aim) + (-sweepDeg / 2 + sweepDeg * Math.min(1, Math.max(0, modeMs / sweepMs))) * DEG;
}

const wrap = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));

/** The melee part of a card in its attack window against `player` (sweep or zone), and whether it touches; null for bullet cards. */
export function danmakuMelee(enemy: EnemyState, def: DanmakuDef, player: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  if (enemy.ai.mode !== 'attack' || !enemy.boss) return null;
  const card = cardDef(def, enemy.boss.stance);
  if (!card) return null;
  const p = card.pattern;
  if (p.kind === 'sweep') {
    const offset = sub(player, enemy.pos);
    const dist = length(offset);
    if (dist > p.radius + PLAYER_RADIUS) return { attack: p.attack, touches: false };
    const arm = sweepAngle(enemy.ai.attackDir, p.sweepDeg, p.sweepMs, enemy.ai.modeMs);
    const near = dist <= enemy.radius + PLAYER_RADIUS || Math.abs(wrap(angleOf(offset) - arm)) <= (p.armDeg / 2) * DEG;
    return { attack: p.attack, touches: near };
  }
  if (p.kind === 'zone') {
    const at = enemy.ai.aimPoint ?? enemy.pos;
    return { attack: p.attack, touches: distance(at, player) <= p.radius + PLAYER_RADIUS };
  }
  return null;
}

function startCard(state: WorldState, enemy: EnemyState, def: DanmakuDef, target: Vec2, events: GameEvent[]): EnemyState {
  const card = danmakuCardAt(def, enemy.boss!);
  const cd = cardDef(def, card)!;
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const p = cd.pattern;
  // Positional cards (the anchor sweep, the bursting zones) carry the shared pierce telegraph and warning sound.
  const pierce = (p.kind === 'sweep' || p.kind === 'zone') && p.attack.pierceRoll === true;
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: card, durationMs: cd.telegraphMs, ...(pierce ? { pierceRoll: true as const } : {}) });
  const toPlayer = towardTarget(target, enemy);
  let attackDir = toPlayer;
  let aimPoint: Vec2 | undefined;
  if (p.kind === 'zone') aimPoint = p.at === 'self' ? enemy.pos : target;
  if (p.kind === 'lanes') {
    // The wall starts at the far end from the player and comes at them; the mark is the safe lane.
    attackDir = target.y > state.arena.height / 2 ? vec(0, 1) : vec(0, -1);
    aimPoint = vec(laneGap(state.arena.width, target.x, p.gapWidth, p.shiftPx, 0), attackDir.y > 0 ? 0 : state.arena.height);
  }
  const { aimPoint: _old, ...ai } = enemy.ai;
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  return { ...next, facing: toPlayer, ai: { ...enterMode(ai, 'telegraph', cd.telegraphMs), attackDir, contact: 'none', attack: card, ...(aimPoint ? { aimPoint } : {}) } };
}

/** Fires part `index` of a bullet card (ring, spiral shot or wall wave). */
function firePart(state: WorldState, enemy: EnemyState, def: DanmakuDef, cd: DanmakuCardDef, index: number): WorldState {
  const p = cd.pattern;
  let next = state;
  const aim = enemy.ai.attackDir;
  if (p.kind === 'rings') for (const dir of ringDirections(aim, p.perRing, p.gap, p.gapTurnDeg, index)) next = shoot(next, enemy, def, p.shot, dir);
  if (p.kind === 'spiral') for (const dir of spiralDirections(aim, p.arms, p.turnDegPerShot, index)) next = shoot(next, enemy, def, p.shot, dir);
  if (p.kind === 'lanes') {
    const mark = enemy.ai.aimPoint ?? vec(state.arena.width / 2, 0);
    const gapX = laneGap(state.arena.width, mark.x, p.gapWidth, p.shiftPx, index);
    const y = aim.y > 0 ? p.shot.radius + 2 : state.arena.height - p.shot.radius - 2;
    for (const x of laneShots(state.arena.width, gapX, p.gapWidth, p.spacing)) next = shoot(next, enemy, def, p.shot, aim, vec(x, y));
  }
  return next;
}

/** Parts of a bullet card and the time between them. */
function partsOf(cd: DanmakuCardDef): { count: number; every: number } | null {
  const p = cd.pattern;
  if (p.kind === 'rings') return { count: p.rings, every: p.gapMs };
  if (p.kind === 'spiral') return { count: Math.max(1, Math.floor(p.durationMs / p.everyMs)), every: p.everyMs };
  if (p.kind === 'lanes') return { count: p.waves, every: p.gapMs };
  return null;
}

/** Length of a card's attack window. */
function attackMsOf(cd: DanmakuCardDef): number {
  const p = cd.pattern;
  if (p.kind === 'sweep') return p.sweepMs;
  if (p.kind === 'zone') return p.impactMs;
  const parts = partsOf(cd)!;
  return parts.count * parts.every;
}

function rest(enemy: EnemyState, cd: DanmakuCardDef): EnemyState {
  const boss = enemy.boss!;
  return withAi(withBoss(enemy, { combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', cd.recoverMs), contact: 'none' });
}

/** Phase 2 starts once, below `belowHp`, only between cards. */
const awakens = (enemy: EnemyState, def: DanmakuDef): boolean => def.phase2 !== undefined && enemy.boss?.phase !== 2 && enemy.hp <= enemy.maxHp * def.phase2.belowHp;

export function updateDanmaku(state: WorldState, start: EnemyState, def: DanmakuDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  let enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const restMs = boss.phase === 2 && def.phase2 ? def.phase2.restMs : def.restMs;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: restMs });
      break;
    case 'approach': {
      if (awakens(enemy, def)) {
        events.push({ type: 'bossStance', enemyId: enemy.id, stance: 'awaken' });
        events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'awaken', durationMs: def.phase2!.transformMs });
        enemy = withAi(withBoss(enemy, { stance: 'awaken', stanceMs: 0, phase: 2, combosDone: 0, comboIndex: 0 }), { ...enterMode(ai, 'transform', def.phase2!.transformMs), contact: 'none' });
        break;
      }
      if (ai.cooldownMs <= 0) {
        enemy = startCard(state, enemy, def, target, events);
        break;
      }
      const radial = dist < def.keepDistance - 30 ? scale(toPlayer, -1) : dist > def.keepDistance + 60 ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.6)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'transform':
      // "El ancla despierta": neither attacks nor blocks (the opening), then phase 2's first card soon after.
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: 600 });
      break;
    case 'telegraph': {
      const cd = cardDef(def, boss.stance);
      if (!cd) {
        enemy = withAi(enemy, enterMode(ai, 'approach'));
        break;
      }
      const p = cd.pattern;
      if (p.kind === 'rings' || p.kind === 'spiral' || p.kind === 'sweep') enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      // Riptide: the mark follows the player, then holds still for the last `lockMs` (walk out of it).
      if (p.kind === 'zone' && p.at === 'target' && ai.modeDurationMs - ai.modeMs > p.lockMs) enemy = withAi(enemy, { ...ai, aimPoint: target });
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: boss.stance });
        // It surfaces on the mark.
        if (p.kind === 'zone' && p.at === 'target' && enemy.ai.aimPoint) enemy = { ...enemy, pos: confineCircle(state.arena, enemy.ai.aimPoint, enemy.radius) };
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', attackMsOf(cd)), contact: 'none' });
        if (partsOf(cd)) state = firePart(state, enemy, def, cd, 0);
      }
      break;
    }
    case 'attack': {
      const cd = cardDef(def, boss.stance);
      if (!cd) {
        enemy = withAi(enemy, enterMode(ai, 'approach'));
        break;
      }
      const parts = partsOf(cd);
      if (parts) {
        for (const k of crossed(ai.modeMs - ms, ai.modeMs, parts.every, parts.count)) {
          state = firePart(state, enemy, def, cd, k);
          enemy = withBoss(enemy, { comboIndex: k });
        }
      }
      const melee = danmakuMelee(enemy, def, state.player.pos);
      if (melee) {
        const hit = contactPlayer(state, enemy, melee.attack, melee.touches, events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      }
      if (modeOver(ai)) {
        const p = cd.pattern;
        if (p.kind === 'zone' && p.ring) {
          const from = enemy.ai.aimPoint ?? enemy.pos;
          for (const dir of ringDirections(toPlayer, p.ring.count, p.ring.gap, 0, 0)) state = shoot(state, enemy, def, p.ring.shot, dir, add(from, scale(dir, enemy.radius + p.ring.shot.radius)));
        }
        enemy = rest(enemy, cd);
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: restMs, strafeSign: ai.strafeSign === 1 ? -1 : 1 });
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}
