import { AEGISLASH, type AegislashDef } from '../data/enemies';
import type { SpeciesId } from '../data/species';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, replaceEnemy, towardPlayer } from './brain';
import type { AiState, BossStance, BossState, EnemyState, GameEvent, WorldState } from './state';
import { angleOf, distance, dot, fromAngle, length, normalize, scale, sub, type Vec2 } from './vec';

/**
 * Aegislash (docs/gdd.md §4): two stances, as in its Stance Change.
 * Shield: blocks hits from the front, turns slowly (flank it), walks slowly
 * and bashes. Blade: chases fast and chains a telegraphed three-blow combo,
 * then stays open. Shield turns into Blade after a while or after taking
 * enough damage; Blade goes back after its combos. The change itself is a
 * telegraphed transformation that neither blocks nor attacks.
 */
const PLAYER_RADIUS = TUNING.player.radius;
const DEG = Math.PI / 180;

export function initialBoss(): BossState {
  return { stance: 'shield', stanceMs: 0, stanceDamage: 0, comboIndex: 0, combosDone: 0 };
}

/** Angle in radians between two non-zero directions, in [0, π]. */
function angleBetween(a: Vec2, b: Vec2): number {
  const cos = dot(normalize(a), normalize(b));
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/** Turns `facing` towards `target` by at most `maxRadians`. */
export function rotateToward(facing: Vec2, target: Vec2, maxRadians: number): Vec2 {
  const from = angleOf(facing);
  let delta = angleOf(target) - from;
  delta = Math.atan2(Math.sin(delta), Math.cos(delta)); // wrap to [-π, π]
  if (Math.abs(delta) <= maxRadians) return normalize(target);
  return fromAngle(from + Math.sign(delta) * maxRadians);
}

/** Whether a hit coming from `from` is stopped by the Shield stance's frontal guard. */
export function blocksHit(enemy: EnemyState, from: Vec2): boolean {
  if (enemy.boss?.stance !== 'shield' || enemy.ai.mode === 'transform') return false;
  const incoming = sub(from, enemy.pos);
  if (length(incoming) === 0) return false;
  return angleBetween(enemy.facing, incoming) <= (AEGISLASH.shield.blockArcDegrees * DEG) / 2;
}

/** Bookkeeping after the boss takes damage (stance-break counter). */
export function onBossDamaged(enemy: EnemyState, damage: number): EnemyState {
  if (!enemy.boss) return enemy;
  return { ...enemy, boss: { ...enemy.boss, stanceDamage: enemy.boss.stanceDamage + damage } };
}

export interface BossBar {
  enemyId: string;
  species: SpeciesId;
  hp: number;
  maxHp: number;
  stance: BossStance;
}

/** Data for the HUD boss bar: the first living boss, if any. */
export function bossBar(state: WorldState): BossBar | null {
  const enemy = state.enemies.find((e) => e.boss && e.alive);
  if (!enemy?.boss) return null;
  return { enemyId: enemy.id, species: enemy.species, hp: enemy.hp, maxHp: enemy.maxHp, stance: enemy.boss.stance };
}

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

function telegraph(enemy: EnemyState, attack: string, durationMs: number, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return withAi(enemy, { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: enemy.facing });
}

function wantsStanceChange(boss: BossState, def: AegislashDef): boolean {
  if (boss.stance === 'shield') return boss.stanceMs >= def.shield.maxMs || boss.stanceDamage >= def.shield.damageToBreak;
  return boss.stanceMs >= def.blade.maxMs || boss.combosDone >= def.blade.combosPerStance;
}

/**
 * Advances along the attack direction without stepping into the player:
 * a lunge stops at body contact instead of passing through.
 */
function lunge(state: WorldState, enemy: EnemyState, distancePx: number): EnemyState {
  const stop = enemy.radius + PLAYER_RADIUS;
  const ahead = dot(sub(state.player.pos, enemy.pos), enemy.ai.attackDir);
  const near = distance(state.player.pos, enemy.pos) <= stop + 2;
  const step = near && ahead > 0 ? 0 : distancePx;
  return moveEnemy(state, enemy, scale(enemy.ai.attackDir, step));
}

function updateShield(state: WorldState, start: EnemyState, def: AegislashDef, ms: number, events: GameEvent[]) {
  const shield = def.shield;
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardPlayer(state, enemy);
  const dist = distance(enemy.pos, state.player.pos);
  const turn = shield.turnRateDegPerSec * DEG * (ms / 1000);

  switch (ai.mode) {
    case 'approach': {
      enemy = { ...enemy, facing: rotateToward(enemy.facing, toPlayer, turn) };
      const inFront = angleBetween(enemy.facing, toPlayer) <= (shield.blockArcDegrees * DEG) / 2;
      if (ai.cooldownMs <= 0 && dist <= shield.bashRange && inFront) {
        enemy = telegraph(enemy, 'bash', shield.bashTelegraphMs, events);
      } else if (dist > shield.bashRange * 0.7) {
        enemy = moveEnemy(state, enemy, scale(toPlayer, (shield.walkSpeed * ms) / 1000));
      }
      break;
    }
    case 'telegraph':
      // The guard keeps turning slowly while it winds up; the bash goes where it faces.
      enemy = { ...enemy, facing: rotateToward(enemy.facing, toPlayer, turn) };
      enemy = withAi(enemy, { ...enemy.ai, attackDir: enemy.facing });
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: 'bash' });
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', shield.bashMs), contact: 'none' });
      }
      break;
    case 'attack': {
      enemy = lunge(state, enemy, (shield.bashDistance / shield.bashMs) * ms);
      const touches = distance(enemy.pos, state.player.pos) <= enemy.radius + PLAYER_RADIUS + 4;
      const hit = contactPlayer(state, enemy, shield.bash, touches, events);
      state = hit.state;
      enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      if (hit.contact === 'hit' || modeOver(ai)) {
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'recover', shield.bashRecoverMs), cooldownMs: shield.bashCooldownMs });
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, enterMode(ai, 'approach'));
      break;
    default:
      break;
  }
  return { state, enemy };
}

function updateBlade(state: WorldState, start: EnemyState, def: AegislashDef, ms: number, events: GameEvent[]) {
  const blade = def.blade;
  let enemy = start;
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardPlayer(state, enemy);
  const dist = distance(enemy.pos, state.player.pos);
  const turn = blade.turnRateDegPerSec * DEG * (ms / 1000);
  const blow = blade.combo[boss.comboIndex]!;

  switch (ai.mode) {
    case 'approach':
      enemy = { ...enemy, facing: rotateToward(enemy.facing, toPlayer, turn) };
      if (ai.cooldownMs <= 0 && dist <= blade.engageRange) {
        enemy = telegraph(withBoss(enemy, { comboIndex: 0 }), 'combo1', blade.combo[0]!.telegraphMs, events);
      } else if (dist > enemy.radius + PLAYER_RADIUS + 10) {
        enemy = moveEnemy(state, enemy, scale(toPlayer, (blade.walkSpeed * ms) / 1000));
      }
      break;
    case 'telegraph':
      enemy = { ...enemy, facing: rotateToward(enemy.facing, toPlayer, turn) };
      enemy = withAi(enemy, { ...enemy.ai, attackDir: enemy.facing });
      if (modeOver(ai)) {
        events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: `combo${boss.comboIndex + 1}` });
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', blow.strikeMs), contact: 'none' });
      }
      break;
    case 'attack': {
      enemy = lunge(state, enemy, (blow.lungeDistance / blow.strikeMs) * ms);
      const offset = sub(state.player.pos, enemy.pos);
      const reach = length(offset) <= blow.range + PLAYER_RADIUS;
      const inArc = length(offset) <= enemy.radius || angleBetween(enemy.ai.attackDir, offset) <= (blow.arcDegrees * DEG) / 2;
      const hit = contactPlayer(state, enemy, blow.attack, reach && inArc, events);
      state = hit.state;
      enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      if (modeOver(ai)) {
        const next = boss.comboIndex + 1;
        if (next < blade.combo.length) {
          enemy = telegraph(withBoss(enemy, { comboIndex: next }), `combo${next + 1}`, blade.combo[next]!.telegraphMs, events);
        } else {
          enemy = withBoss(enemy, { comboIndex: 0, combosDone: boss.combosDone + 1 });
          enemy = withAi(enemy, { ...enterMode(enemy.ai, 'recover', blade.recoverMs), cooldownMs: blade.comboCooldownMs });
        }
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, enterMode(ai, 'approach'));
      break;
    default:
      break;
  }
  return { state, enemy };
}

/** One step of Aegislash: stance timers, the stance change, then the current stance's state machine. */
export function updateBoss(state: WorldState, start: EnemyState, def: AegislashDef, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  if (ai.mode === 'idle') {
    if (distance(enemy.pos, state.player.pos) <= def.aggroRange) enemy = withAi(enemy, enterMode(ai, 'approach'));
    return replaceEnemy(state, enemy);
  }
  enemy = withBoss(enemy, { stanceMs: enemy.boss!.stanceMs + ms });

  if (ai.mode === 'transform') {
    if (modeOver(ai)) {
      const stance: BossStance = enemy.boss!.stance === 'shield' ? 'blade' : 'shield';
      events.push({ type: 'bossStance', enemyId: enemy.id, stance });
      enemy = withBoss(enemy, { stance, stanceMs: 0, stanceDamage: 0, comboIndex: 0, combosDone: 0 });
      enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: 0 });
    }
    return replaceEnemy(state, enemy);
  }
  if (ai.mode === 'approach' && wantsStanceChange(enemy.boss!, def)) {
    events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'transform', durationMs: def.transformMs });
    return replaceEnemy(state, withAi(enemy, enterMode(ai, 'transform', def.transformMs)));
  }

  const result =
    enemy.boss!.stance === 'shield' ? updateShield(state, enemy, def, ms, events) : updateBlade(state, enemy, def, ms, events);
  return replaceEnemy(result.state, result.enemy);
}
