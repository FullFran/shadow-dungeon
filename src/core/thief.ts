import type { ThiefCard, ThiefDef } from '../data/enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, rotate, spawnShot, spreadDirections, towardTarget } from './brain';
import { confineCircle } from './geometry';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { stealItem } from './stolen';
import { thiefTouches } from './victim';
import { add, distance, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Sableye, the Crypt's mid-boss "el ladrón de gemas" (data/enemies.ts
 * `ThiefDef`): two spell cards in a fixed order, announced by name (the HUD
 * reads the card from `boss.stance`).
 *
 * - Glint: it blinks out (`transform`), glints at the spot beside the player
 *   where it will strike (`telegraph`, the aim follows the player), then
 *   slashes in a straight line (`attack`); three blinks, each a third of a
 *   turn around the player from the last. A slash that hurts steals the last
 *   held item (stolen.ts).
 * - Gems: it blinks to the middle of the vault, winds up and throws rings of
 *   gems; every other ring is turned by half a gap.
 *
 * Between cards it rests, drifting to keep its distance (the opening).
 */

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

export const thiefCardAt = (def: ThiefDef, done: number): ThiefCard => def.cards[done % def.cards.length]!;

/** Where a blink reappears: `distance` from the player, a third of a turn around from the thief's side (alternating). */
export function blinkSpot(state: WorldState, enemy: EnemyState, target: Vec2, def: ThiefDef, index: number): Vec2 {
  const from = normalize(sub(enemy.pos, target));
  const side = length2(from) > 0 ? from : vec(0, -1);
  const spot = add(target, scale(rotate(side, index % 2 === 0 ? 120 : -120), def.blink.distance));
  return confineCircle(state.arena, spot, enemy.radius + 8);
}

const length2 = (v: Vec2): number => v.x * v.x + v.y * v.y;

function vanish(enemy: EnemyState, ms: number, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'vanish', durationMs: ms });
  return withAi(enemy, { ...enterMode(enemy.ai, 'transform', ms), contact: 'none' });
}

function windUp(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return { ...enemy, facing: dir, ai: { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir, contact: 'none' } };
}

function startCard(enemy: EnemyState, def: ThiefDef, events: GameEvent[]): EnemyState {
  const card = thiefCardAt(def, enemy.boss!.combosDone);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  return vanish(next, card === 'glint' ? def.blink.vanishMs : def.gems.vanishMs, events);
}

function rest(enemy: EnemyState, def: ThiefDef): EnemyState {
  const boss = enemy.boss!;
  const recover = boss.stance === 'glint' ? def.blink.recoverMs : def.gems.recoverMs;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', recover), contact: 'none' });
}

/** Every other ring turns by half the gap between gems. */
export const ringOffset = (def: ThiefDef, index: number): number => (index % 2 === 1 ? 180 / def.gems.perRing : 0);

function throwRing(state: WorldState, enemy: EnemyState, def: ThiefDef, aim: Vec2, index: number): WorldState {
  let next = state;
  const count = def.gems.perRing;
  for (const dir of spreadDirections(aim, count, 360 - 360 / count, ringOffset(def, index))) next = spawnShot(next, enemy, def.gems.gem, dir);
  return next;
}

export function updateThief(state: WorldState, start: EnemyState, def: ThiefDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  let enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    case 'approach': {
      if (ai.cooldownMs <= 0) {
        enemy = startCard(enemy, def, events);
        break;
      }
      const radial = dist < def.keepDistance - 30 ? scale(toPlayer, -1) : dist > def.keepDistance + 60 ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.6)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'transform':
      // Blinked out: it reappears beside the player (Glint) or in the middle of the vault (Gems) and winds up.
      if (modeOver(ai)) {
        if (boss.stance === 'glint') {
          const pos = blinkSpot(state, enemy, target, def, boss.comboIndex);
          enemy = windUp({ ...enemy, pos }, 'glint', def.blink.telegraphMs, towardTarget(target, { ...enemy, pos }), events);
        } else {
          const pos = confineCircle(state.arena, vec(state.arena.width / 2, state.arena.height / 2), enemy.radius);
          enemy = windUp({ ...enemy, pos }, 'gems', def.gems.telegraphMs, towardTarget(target, { ...enemy, pos }), events);
        }
      }
      break;
    case 'telegraph':
      enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: boss.stance });
        if (boss.stance === 'glint') {
          enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.blink.slashMs), contact: 'none' });
        } else {
          state = throwRing(state, enemy, def, enemy.ai.attackDir, 0);
          enemy = withAi(withBoss(enemy, { comboIndex: 1 }), enterMode(enemy.ai, 'attack', def.gems.gapMs));
        }
      }
      break;
    case 'attack': {
      if (boss.stance === 'glint') {
        enemy = moveEnemy(state, enemy, scale(ai.attackDir, (def.blink.slashDistance / def.blink.slashMs) * ms));
        const before = enemy.ai.contact;
        const hit = contactPlayer(state, enemy, def.blink.attack, thiefTouches(enemy, state.player.pos, def), events);
        state = hit.state;
        if (before === 'none' && hit.contact === 'hit') state = { ...state, player: stealItem(state.player, enemy.id, def.stealMs, events) };
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
        if (modeOver(ai)) {
          const next = boss.comboIndex + 1;
          enemy = next < def.blink.blinks ? vanish(withBoss(enemy, { comboIndex: next }), def.blink.vanishMs, events) : rest(enemy, def);
        }
        break;
      }
      if (!modeOver(ai)) break;
      if (boss.comboIndex >= def.gems.rings) {
        enemy = rest(enemy, def);
        break;
      }
      state = throwRing(state, enemy, def, toPlayer, boss.comboIndex);
      enemy = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', def.gems.gapMs));
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
