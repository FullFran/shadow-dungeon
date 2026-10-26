import { TREVENANT, type TreantCard, type TreantDef } from '../data/enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, pathDirection, replaceEnemy, rotate, spawnShot, spreadDirections, towardTarget } from './brain';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { slamTouches } from './victim';
import { add, distance, normalize, scale, sub, vec, type Vec2 } from './vec';
import { hostedMoves, updateHostedCardFight } from './cards';

/**
 * Trevenant, the Misty Forest's mid-boss (data/enemies.ts `TreantDef`): it
 * walks in and slams, then plays its next spell card (announced through
 * `boss.stance`, so guests see the banner), then slams again.
 *
 * - Roots: the hollow is cut into lanes; every other lane is marked (the
 *   first wave always takes the player's lane) and bursts with roots that
 *   stay a moment, then the other lanes. Roots are positional: rolling
 *   through them does not help (`pierceRoll`).
 * - Spiral: arms of leaves wind out of it, burst after burst.
 * - Curse: a ring is marked around the player with a gap on the side away
 *   from the tree; it closes in on its centre. Twice, re-aimed.
 * - Grove (hard and up): two spirals winding opposite ways.
 *
 * What a guest needs to draw it travels in the snapshot: the card and wave in
 * `boss.stance`/`comboIndex`, the roots' first lane parity and the curse gap
 * in `ai.attackDir`, the curse centre in `ai.aimPoint`.
 */

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** The card played after `done` cards. */
export const treantCardAt = (def: TreantDef, done: number): TreantCard => def.cards[done % def.cards.length]!;

const laneCount = (def: TreantDef, width: number): number => Math.max(2, Math.floor(width / def.roots.laneWidth));

/** Lanes the current roots wave strikes (0-based, left to right): every other lane, alternating by wave. */
export function rootLanes(enemy: Pick<EnemyState, 'ai' | 'boss'>, width: number, def: TreantDef = TREVENANT): number[] {
  const parity = ((enemy.ai.attackDir.x < 0 ? 1 : 0) + (enemy.boss?.comboIndex ?? 0)) % 2;
  return Array.from({ length: laneCount(def, width) }, (_, i) => i).filter((i) => i % 2 === parity);
}

/** Direction of the curse ring's gap (from its centre). */
export const curseGapDir = (enemy: Pick<EnemyState, 'ai'>): Vec2 => enemy.ai.attackDir;

/** A wind-up; `pierceRoll` marks a positional one (its own warning sound: walk out of it). */
function windUp(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[], extra: Partial<AiState> = {}, pierceRoll = false): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs, ...(pierceRoll ? { pierceRoll: true as const } : {}) });
  return withAi(enemy, { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir, contact: 'none', ...extra });
}

/** The curse centre (the player) and its gap, away from the tree. */
function curseAim(enemy: EnemyState, target: Vec2): { aimPoint: Vec2; attackDir: Vec2 } {
  const away = normalize(sub(target, enemy.pos));
  return { aimPoint: target, attackDir: away.x === 0 && away.y === 0 ? vec(0, 1) : away };
}

function startCard(enemy: EnemyState, def: TreantDef, target: Vec2, width: number, events: GameEvent[]): EnemyState {
  const card = treantCardAt(def, enemy.boss!.combosDone);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  if (card === 'roots') {
    // The first wave takes the player's own lane: its parity rides in the aim's sign.
    const lane = Math.min(laneCount(def, width) - 1, Math.max(0, Math.floor(target.x / def.roots.laneWidth)));
    return windUp(next, 'roots', def.roots.telegraphMs, vec(lane % 2 === 1 ? -1 : 1, 0), events, {}, def.roots.spike.pierceRoll === true);
  }
  if (card === 'curse') return windUp(next, 'curse', def.curse.telegraphMs, vec(0, 1), events, curseAim(enemy, target));
  return windUp(next, 'spiral', def.spiral.telegraphMs, towardTarget(target, enemy), events);
}

/** Roots burst from the struck lanes, one every `spacing` px down each lane. */
function burstRoots(state: WorldState, enemy: EnemyState, def: TreantDef): WorldState {
  const { width, height } = state.arena;
  let next = state;
  for (const lane of rootLanes(enemy, width, def)) {
    const x = (lane + 0.5) * def.roots.laneWidth;
    for (let y = def.roots.spacing / 2; y < height; y += def.roots.spacing) next = spawnShot(next, enemy, { ...def.roots.spike, speed: 0 }, vec(0, 1), vec(x, y));
  }
  return next;
}

/** One burst of the spiral (or of both grove spirals). */
function spiralBurst(state: WorldState, enemy: EnemyState, def: TreantDef, burst: number): WorldState {
  const grove = enemy.boss!.stance === 'grove';
  const arms = grove ? def.grove.arms : def.spiral.arms;
  const turn = grove ? def.grove.turnDegrees : def.spiral.turnDegrees;
  const base = enemy.ai.attackDir;
  let next = state;
  for (const sign of grove ? [1, -1] : [1]) {
    for (const dir of spreadDirections(rotate(base, sign * turn * burst), arms, 360 - 360 / arms)) next = spawnShot(next, enemy, def.spiral.leaf, dir);
  }
  return next;
}

/** The curse ring around `aimPoint`, the shots next to the gap left out, all heading for the centre. */
function curseRing(state: WorldState, enemy: EnemyState, def: TreantDef): WorldState {
  const c = def.curse;
  const centre = enemy.ai.aimPoint!;
  const gap = enemy.ai.attackDir;
  const stepDeg = 360 / c.count;
  let next = state;
  // Slots evenly round the ring, set so the `gap` slots nearest the gap direction are the ones left out.
  const offset = c.gap % 2 === 0 ? stepDeg / 2 : 0;
  for (let i = 0; i < c.count; i++) {
    const angle = i * stepDeg + offset;
    const fromGap = Math.min(angle, 360 - angle);
    if (fromGap < (c.gap * stepDeg) / 2) continue;
    const out = rotate(gap, angle);
    const at = add(centre, scale(out, c.radius));
    next = spawnShot(next, enemy, { ...c.shot, lifetimeMs: (c.radius / c.shot.speed) * 1000 }, scale(out, -1), at);
  }
  return next;
}

function rest(enemy: EnemyState, recoverMs: number): EnemyState {
  const boss = enemy.boss!;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', recoverMs), contact: 'none' });
}

function updateSlamStance(state: WorldState, start: EnemyState, def: TreantDef, target: Vec2, ms: number, events: GameEvent[]) {
  let enemy = start;
  const ai = enemy.ai;
  const slam = def.slam;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  switch (ai.mode) {
    case 'approach': {
      if (dist <= slam.range || ai.modeMs >= slam.approachMs) {
        enemy = windUp({ ...enemy, facing: toPlayer }, 'slam', slam.telegraphMs, toPlayer, events);
        break;
      }
      const dir = pathDirection(state, enemy, target) ?? toPlayer;
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: dir };
      break;
    }
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'slam' });
        for (const dir of spreadDirections(toPlayer, slam.ring.count, 360 - 360 / slam.ring.count)) state = spawnShot(state, enemy, slam.ring.projectile, dir);
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', slam.slamMs), contact: 'none' });
      }
      break;
    case 'attack': {
      const hit = contactPlayer(state, enemy, slam.attack, slamTouches(enemy, state.player.pos, slam.radius), events);
      state = hit.state;
      enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(enemy.ai, 'recover', slam.recoverMs), contact: 'none' });
      break;
    }
    case 'recover':
      // The slam is over: the next spell card.
      if (modeOver(ai)) enemy = startCard(enemy, def, target, state.arena.width, events);
      break;
    default:
      enemy = withAi(enemy, enterMode(ai, 'approach'));
      break;
  }
  return { state, enemy };
}

function updateCard(state: WorldState, start: EnemyState, def: TreantDef, target: Vec2, events: GameEvent[]) {
  let enemy = start;
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const card = boss.stance as TreantCard;
  switch (ai.mode) {
    case 'telegraph':
      if (card === 'curse' && ai.modeDurationMs - ai.modeMs > def.curse.lockMs) enemy = withAi(enemy, { ...ai, ...curseAim(enemy, target) });
      if (card === 'spiral' || card === 'grove') enemy = { ...enemy, facing: towardTarget(target, enemy), ai: { ...ai, attackDir: towardTarget(target, enemy) } };
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: card });
      if (card === 'roots') {
        state = burstRoots(state, enemy, def);
        enemy = withAi(enemy, enterMode(enemy.ai, 'attack', def.roots.spike.lifetimeMs));
      } else if (card === 'curse') {
        state = curseRing(state, enemy, def);
        const next = boss.comboIndex + 1;
        enemy =
          next < def.curse.rings
            ? windUp(withBoss(enemy, { comboIndex: next }), 'curse', def.curse.ringGapMs, enemy.ai.attackDir, events, curseAim(enemy, target))
            : withAi(enemy, enterMode(enemy.ai, 'attack', (def.curse.radius / def.curse.shot.speed) * 1000));
      } else {
        state = spiralBurst(state, enemy, def, 0);
        enemy = withAi(withBoss(enemy, { comboIndex: 1 }), enterMode(enemy.ai, 'attack', def.spiral.everyMs));
      }
      break;
    case 'attack':
      if (!modeOver(ai)) break;
      if (card === 'roots') {
        const next = boss.comboIndex + 1;
        // The roots are gone: mark the other lanes, or rest.
        enemy = next < def.roots.waves ? windUp(withBoss(enemy, { comboIndex: next }), 'roots', def.roots.waveGapMs, ai.attackDir, events, {}, def.roots.spike.pierceRoll === true) : rest(enemy, def.roots.recoverMs);
      } else if (card === 'curse') {
        enemy = rest(enemy, def.curse.recoverMs);
      } else if (boss.comboIndex >= def.spiral.bursts) {
        enemy = rest(enemy, def.spiral.recoverMs);
      } else {
        state = spiralBurst(state, enemy, def, boss.comboIndex);
        enemy = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', def.spiral.everyMs));
      }
      break;
    case 'recover':
      // Back to walking in for a slam.
      if (modeOver(ai)) {
        events.push({ type: 'bossStance', enemyId: enemy.id, stance: 'slam' });
        enemy = withAi(withBoss(enemy, { stance: 'slam', stanceMs: 0, comboIndex: 0 }), enterMode(ai, 'approach'));
      }
      break;
    default:
      enemy = withAi(enemy, enterMode(ai, 'recover', 0));
      break;
  }
  return { state, enemy };
}

export function updateTreant(state: WorldState, start: EnemyState, def: TreantDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  // Normal and harder: hosted spell cards (data/hosted-cards.ts); every card walks in to slam between its moves, as it always did.
  const fight = def.spellCards;
  if (fight && !state.enemyScale?.echo) {
    const own = (card: Parameters<typeof hostedMoves>[0]): TreantDef => ({ ...def, spellCards: undefined, cards: hostedMoves<TreantCard>(card, def) });
    return updateHostedCardFight(state, start, fight, target, ms, events, (s, e, card) => updateTreant(s, e, own(card), target, ms, events), () => 'slam');
  }
  const enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  if (enemy.ai.mode === 'idle') {
    if (distance(enemy.pos, target) > def.aggroRange) return state;
    return replaceEnemy(state, withAi(enemy, enterMode(enemy.ai, 'approach')));
  }
  const result = enemy.boss!.stance === 'slam' ? updateSlamStance(state, enemy, def, target, ms, events) : updateCard(state, enemy, def, target, events);
  return replaceEnemy(result.state, result.enemy);
}
