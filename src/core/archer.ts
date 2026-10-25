import type { ArcherCard, ArcherDef } from '../data/enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, spawnShot, spreadDirections, towardTarget } from './brain';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { diveTouches } from './victim';
import { add, distance, normalize, scale, vec, type Vec2 } from './vec';

/**
 * Decidueye, guardian of the Misty Forest: three spell cards played in a
 * fixed order, each one announced (its name shows on screen: the HUD reads
 * the card from `boss.stance`) and telegraphed.
 *
 * - Volley: a long aim, then arrows one after another, each aimed where the
 *   player is when it leaves: keep moving.
 * - Fan: it fades out, reappears at the edge of the clearing farthest from
 *   the player, aims, and fires fans of leaves; every other fan is shifted by
 *   half a gap, so standing still in a gap does not work twice.
 * - Dive: it tracks the player, the aim locks `lockMs` before the dive (the
 *   lane stops moving), then it dives straight across; a long recovery
 *   follows (the punish window).
 *
 * Between cards it rests, drifting to keep its distance.
 */

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** The card played after `done` cards. */
export const cardAt = (def: ArcherDef, done: number): ArcherCard => def.cards[done % def.cards.length]!;

/** Aim of the dive locks this long before it starts: the lane on the ground stops following the player. */
export const DIVE_LOCK_MS = 380;

/** Where the fan card reappears: of the clearing's four edge midpoints (inset), the farthest from the player. */
export function fanPerch(arena: { width: number; height: number }, player: Vec2, inset: number): Vec2 {
  const points = [vec(arena.width / 2, inset), vec(arena.width - inset, arena.height / 2), vec(arena.width / 2, arena.height - inset), vec(inset, arena.height / 2)];
  let best = points[0]!;
  for (const p of points) if (distance(p, player) > distance(best, player)) best = p;
  return best;
}

function windUp(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return { ...enemy, facing: dir, ai: { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir } };
}

function startCard(enemy: EnemyState, def: ArcherDef, toPlayer: Vec2, events: GameEvent[]): EnemyState {
  const card = cardAt(def, enemy.boss!.combosDone);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  if (card === 'volley') return windUp(next, 'volley', def.volley.telegraphMs, toPlayer, events);
  if (card === 'dive') return windUp(next, 'dive', def.dive.telegraphMs, toPlayer, events);
  // Fan: it fades into the fog first.
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'vanish', durationMs: def.fan.vanishMs });
  return withAi(next, enterMode(next.ai, 'transform', def.fan.vanishMs));
}

const fanOffset = (def: ArcherDef, index: number): number => (index % 2 === 1 ? def.fan.spreadDegrees / (def.fan.leaves - 1) / 2 : 0);

function fire(state: WorldState, enemy: EnemyState, def: ArcherDef, dir: Vec2, index: number): WorldState {
  if (enemy.boss!.stance === 'volley') return spawnShot(state, enemy, def.volley.arrow, dir);
  let next = state;
  for (const d of spreadDirections(dir, def.fan.leaves, def.fan.spreadDegrees, fanOffset(def, index))) next = spawnShot(next, enemy, def.fan.leaf, d);
  return next;
}

function rest(enemy: EnemyState, def: ArcherDef): EnemyState {
  const boss = enemy.boss!;
  const recover = boss.stance === 'volley' ? def.volley.recoverMs : boss.stance === 'fan' ? def.fan.recoverMs : def.dive.recoverMs;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', recover), contact: 'none' });
}

export function updateArcher(state: WorldState, start: EnemyState, def: ArcherDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start.boss ? withBoss(start, { stanceMs: start.boss.stanceMs + ms }) : start;
  if (!enemy.boss) return state;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const boss = enemy.boss;

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    case 'approach': {
      if (ai.cooldownMs <= 0) {
        enemy = startCard(enemy, def, toPlayer, events);
        break;
      }
      // Rest: drift to keep its distance, circling a little.
      const radial = dist < def.keepDistance - 30 ? scale(toPlayer, -1) : dist > def.keepDistance + 60 ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.6)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'transform':
      // Fan card: faded out; it reappears at the far edge and starts aiming.
      if (modeOver(ai)) {
        const perch = fanPerch(state.arena, target, def.fan.edgeInset);
        const aim = towardTarget(target, { ...enemy, pos: perch });
        enemy = windUp({ ...enemy, pos: perch }, 'fan', def.fan.telegraphMs, aim, events);
      }
      break;
    case 'telegraph': {
      const locked = boss.stance === 'dive' && ai.modeDurationMs - ai.modeMs <= DIVE_LOCK_MS;
      if (!locked) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: boss.stance });
        if (boss.stance === 'dive') {
          enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.dive.diveMs), contact: 'none' });
        } else {
          state = fire(state, enemy, def, enemy.ai.attackDir, 0);
          const gap = boss.stance === 'volley' ? def.volley.gapMs : def.fan.gapMs;
          enemy = withAi(withBoss(enemy, { comboIndex: 1 }), enterMode(enemy.ai, 'attack', gap));
        }
      }
      break;
    }
    case 'attack': {
      if (boss.stance === 'dive') {
        enemy = moveEnemy(state, enemy, scale(ai.attackDir, (def.dive.distance / def.dive.diveMs) * ms));
        const hit = contactPlayer(state, enemy, def.dive.attack, diveTouches(enemy, state.player.pos, def), events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
        if (modeOver(ai)) enemy = rest(enemy, def);
        break;
      }
      if (!modeOver(ai)) break;
      const total = boss.stance === 'volley' ? def.volley.shots : def.fan.fans;
      if (boss.comboIndex >= total) {
        enemy = rest(enemy, def);
        break;
      }
      // Each next arrow (or fan) aims where the player is now.
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      state = fire(state, enemy, def, toPlayer, boss.comboIndex);
      const gap = boss.stance === 'volley' ? def.volley.gapMs : def.fan.gapMs;
      enemy = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', gap));
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}
