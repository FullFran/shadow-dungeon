import { AEGISLASH, ENEMY_BEHAVIOUR, type AegislashCard, type AegislashDef, type ComboHitDef } from '../data/enemies';
import { atLeast, type Difficulty } from '../data/difficulty';
import { worldDifficulty } from './difficulty';
import { cardFloors, cardGuard, cardTimeLeftMs, fightOf, updateCardFight } from './cards';
import { cardInfo } from '../data/cards';
import { behaviourFor } from './tricks';
import type { SpeciesId } from '../data/species';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, replaceEnemy, spawnShot, spreadDirections, towardTarget } from './brain';
import { bashTouches, bladeTouches, slamTouches } from './victim';
import type { AiState, BossStance, BossState, EnemyState, GameEvent, WorldState } from './state';
import { angleOf, distance, dot, fromAngle, length, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Aegislash (docs/gdd.md §4): two stances, as in its Stance Change.
 * Shield: blocks hits from the front, turns slowly (flank it), walks slowly
 * and bashes. Blade: chases fast and chains a telegraphed three-blow combo,
 * then stays open. Shield turns into Blade after a while or after taking
 * enough damage; Blade goes back after its combos. The change itself is a
 * telegraphed transformation that neither blocks nor attacks.
 *
 * Phase 2 ("El Rey desenvaina", data `AEGISLASH.phase2`): at half HP a long
 * unsheathing that neither blocks nor attacks, then faster swaps, and after
 * every Blade stance one named spell card in turn (Midnight, Oaths, Shadow),
 * each telegraphed and followed by an opening, then back to Shield.
 */
const PLAYER_RADIUS = TUNING.player.radius;
const DEG = Math.PI / 180;

/** A boss's starting state: Aegislash in Shield, Decidueye and Sableye on their first spell card, Trevenant walking in to slam. */
export function initialBoss(species?: SpeciesId): BossState {
  const def = species ? ENEMY_BEHAVIOUR[species] : undefined;
  const stance: BossStance =
    def?.kind === 'archer' || def?.kind === 'thief' || def?.kind === 'danmaku' || def?.kind === 'queen' || def?.kind === 'eclipse'
      ? def.cards[0]!
      : def?.kind === 'ultra'
        ? def.phase1[0]!
        : def?.kind === 'treant'
          ? 'slam'
          : 'shield';
  return { stance, stanceMs: 0, stanceDamage: 0, comboIndex: 0, combosDone: 0 };
}

/** Enemies that carry boss state (stances, spell cards). */
export const hasBossState = (species: SpeciesId): boolean => {
  const kind = ENEMY_BEHAVIOUR[species]?.kind;
  return kind === 'boss' || kind === 'archer' || kind === 'thief' || kind === 'treant' || kind === 'danmaku' || kind === 'queen' || kind === 'ultra' || kind === 'eclipse';
};

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
  // A spell card's guard (core/cards.ts): all round while declaring or in a survival card, the front in a Shield card.
  const guard = cardGuard(enemy);
  if (guard === 'all') return true;
  if (guard === 'front') {
    const incoming = sub(from, enemy.pos);
    return length(incoming) > 0 && angleBetween(enemy.facing, incoming) <= (AEGISLASH.shield.blockArcDegrees * DEG) / 2;
  }
  // Oaths: the planted shield guards every side while it fires; it lowers to recover.
  if (enemy.boss?.stance === 'oaths') return enemy.ai.mode === 'telegraph' || enemy.ai.mode === 'attack';
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
  /** Null for a mid-boss without stances (Trevenant). */
  stance: BossStance | null;
  /** Spell-card fights: where each card's segment ends, in HP (the bar's notches), and the time left on the card in play (host only). */
  segments?: readonly number[];
  cardLeftMs?: number;
}

const showsBar = (enemy: EnemyState): boolean => {
  const def = ENEMY_BEHAVIOUR[enemy.species];
  return enemy.boss !== undefined || (def !== undefined && 'bar' in def && def.bar === true);
};

/** Data for the HUD boss bar: the first living boss (or mid-boss), if any. */
export function bossBar(state: WorldState): BossBar | null {
  const enemy = state.enemies.find((e) => e.alive && showsBar(e));
  if (!enemy) return null;
  const bar: BossBar = { enemyId: enemy.id, species: enemy.species, hp: enemy.hp, maxHp: enemy.maxHp, stance: enemy.boss?.stance ?? null };
  const fight = cardInfo(enemy.boss?.stance) ? fightOf(behaviourFor(enemy.species, worldDifficulty(state))) : undefined;
  if (!fight) return bar;
  const left = cardTimeLeftMs(fight, enemy);
  return { ...bar, segments: cardFloors(fight).slice(0, -1).map((share) => share * enemy.maxHp), ...(left !== null ? { cardLeftMs: left } : {}) };
}

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

function telegraph(enemy: EnemyState, attack: string, durationMs: number, events: GameEvent[]): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs });
  return withAi(enemy, { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: enemy.facing });
}

function wantsStanceChange(boss: BossState, def: AegislashDef): boolean {
  const p2 = boss.phase === 2 ? def.phase2 : null;
  if (boss.stance === 'shield') return boss.stanceMs >= (p2?.shieldMaxMs ?? def.shield.maxMs) || boss.stanceDamage >= (p2?.shieldDamageToBreak ?? def.shield.damageToBreak);
  return boss.stanceMs >= (p2?.bladeMaxMs ?? def.blade.maxMs) || boss.combosDone >= (p2?.bladeCombosPerStance ?? def.blade.combosPerStance);
}

const isCard = (stance: BossStance): stance is AegislashCard => stance === 'midnight' || stance === 'oaths' || stance === 'shadow' || stance === 'judgement';

/** The Blade combo at tier `d`: its blows plus the ones harder tiers add (hard: the feint). */
export const bladeCombo = (def: AegislashDef, d: Difficulty): readonly ComboHitDef[] => [...def.blade.combo, ...def.blade.extraBlows.filter((b) => atLeast(d, b.minDifficulty))];

/** Blow `index` of the Blade combo (the extra blows after the base ones), for hitboxes and looks on any peer. */
export const bladeBlow = (index: number, def: AegislashDef = AEGISLASH): ComboHitDef =>
  def.blade.combo[index] ?? def.blade.extraBlows[index - def.blade.combo.length] ?? def.blade.combo[0]!;

/** Phase 2's spell card rotation at tier `d` (nightmare adds Judgement). */
export const phase2Cards = (def: AegislashDef, d: Difficulty): readonly AegislashCard[] => [...def.phase2.cards, ...def.phase2.extraCards.filter((c) => atLeast(d, c.minDifficulty)).map((c) => c.card)];

/** Midnight's spin as it lands at tier `d`: positional from `pierceRollFrom` on. */
export const midnightAttack = (def: AegislashDef, d: Difficulty) => (atLeast(d, def.phase2.midnight.pierceRollFrom) ? { ...def.phase2.midnight.attack, pierceRoll: true } : def.phase2.midnight.attack);

/** Whether a card's wind-up is a positional attack (its own telegraph and sound). */
const cardPierces = (def: AegislashDef, card: AegislashCard, d: Difficulty): boolean =>
  card === 'shadow' || card === 'judgement' ? def.phase2.shadow.sword.pierceRoll === true : card === 'midnight' && atLeast(d, def.phase2.midnight.pierceRollFrom);

/** Centre of the gap in the shadow-sword wall for `lane` (the room split into `lanes` equal lanes). */
export const shadowGapX = (width: number, lane: number, lanes = AEGISLASH.phase2.shadow.lanes): number => (width * (lane + 0.5)) / lanes;

/** The lane farthest from the player: where the gap goes. */
function farLane(width: number, playerX: number, lanes: number): number {
  let best = 0;
  for (let lane = 0; lane < lanes; lane++) if (Math.abs(shadowGapX(width, lane, lanes) - playerX) > Math.abs(shadowGapX(width, best, lanes) - playerX)) best = lane;
  return best;
}

function cardWindUp(enemy: EnemyState, card: AegislashCard, durationMs: number, dir: Vec2, comboIndex: number, events: GameEvent[], pierceRoll = false): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: card, durationMs, ...(pierceRoll ? { pierceRoll: true as const } : {}) });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex });
  return { ...next, facing: length(dir) > 0 && dir.x !== 0 ? dir : next.facing, ai: { ...enterMode(next.ai, 'telegraph', durationMs), attackDir: dir, contact: 'none' } };
}

/** After Blade in phase 2: the next spell card, announced (`bossStance`) and telegraphed. */
function startCard(state: WorldState, enemy: EnemyState, def: AegislashDef, target: Vec2, events: GameEvent[]): EnemyState {
  const p2 = def.phase2;
  const tier = worldDifficulty(state);
  const cards = phase2Cards(def, tier);
  const played = enemy.boss!.cardsPlayed ?? 0;
  const card = cards[played % cards.length]!;
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const counted = withBoss(enemy, { cardsPlayed: played + 1, combosDone: 0, stanceDamage: 0 });
  const toPlayer = towardTarget(target, enemy);
  const pierces = cardPierces(def, card, tier);
  if (card === 'midnight') return cardWindUp(counted, card, p2.midnight.telegraphMs, toPlayer, 0, events, pierces);
  if (card === 'oaths') return cardWindUp(counted, card, p2.oaths.telegraphMs, toPlayer, 0, events);
  // Shadow (and Judgement's first wall): the swords come from the end of the room away from the player; the gap is the lane farthest from it.
  const down = target.y > state.arena.height / 2;
  const windUpMs = card === 'judgement' ? p2.judgement.telegraphMs : p2.shadow.telegraphMs;
  return cardWindUp(counted, card, windUpMs, vec(0, down ? 1 : -1), farLane(state.arena.width, target.x, p2.shadow.lanes), events, pierces);
}

/** The shadow-sword wall: one sword every `spacing` px across the room, none in the gap, from the far end. */
function sweep(state: WorldState, enemy: EnemyState, def: AegislashDef): WorldState {
  const shadow = def.phase2.shadow;
  const { width, height } = state.arena;
  const gap = shadowGapX(width, enemy.boss!.comboIndex, shadow.lanes);
  const dir = enemy.ai.attackDir;
  const y = dir.y > 0 ? shadow.sword.radius + 1 : height - shadow.sword.radius - 1;
  let next = state;
  for (let x = shadow.spacing / 2; x < width; x += shadow.spacing) {
    if (Math.abs(x - gap) < shadow.gapWidth / 2) continue;
    next = spawnShot(next, enemy, shadow.sword, dir, vec(x, y));
  }
  return next;
}

function updateCard(state: WorldState, start: EnemyState, def: AegislashDef, target: Vec2, ms: number, events: GameEvent[]) {
  const p2 = def.phase2;
  let enemy = start;
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const card = boss.stance as AegislashCard;
  const toPlayer = towardTarget(target, enemy);
  switch (ai.mode) {
    case 'telegraph':
      // Midnight and Oaths keep facing the player while winding up; Shadow's (and Judgement's) direction and gap are fixed.
      if (card !== 'shadow' && card !== 'judgement') enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: card });
      if (card === 'midnight') {
        for (const dir of spreadDirections(enemy.ai.attackDir, p2.midnight.blades.count, 360 - 360 / p2.midnight.blades.count)) state = spawnShot(state, enemy, p2.midnight.blades.shot, dir);
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', p2.midnight.strikeMs), contact: 'none' });
      } else if (card === 'oaths') {
        for (const dir of spreadDirections(enemy.ai.attackDir, p2.oaths.perVolley, p2.oaths.spreadDegrees)) state = spawnShot(state, enemy, p2.oaths.blade, dir);
        enemy = withAi(withBoss(enemy, { comboIndex: 1 }), enterMode(enemy.ai, 'attack', p2.oaths.gapMs));
      } else {
        state = sweep(state, enemy, def);
        enemy = withAi(enemy, enterMode(enemy.ai, 'attack', card === 'judgement' ? p2.judgement.sweepMs : p2.shadow.sweepMs));
      }
      break;
    case 'attack':
      if (card === 'judgement') {
        if (!modeOver(ai)) break;
        if (ai.chain === 1) {
          const { chain: _second, ...rest } = enemy.ai;
          enemy = withAi(enemy, enterMode(rest, 'recover', p2.judgement.recoverMs));
          break;
        }
        // The second wall: from the other end, its gap the lane farthest from the player now, after its own wind-up.
        const back = vec(0, -enemy.ai.attackDir.y || 1);
        const lane = farLane(state.arena.width, target.x, p2.shadow.lanes);
        events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'judgement2', durationMs: p2.judgement.secondTelegraphMs, pierceRoll: true });
        enemy = withAi(withBoss(enemy, { comboIndex: lane }), { ...enterMode(enemy.ai, 'telegraph', p2.judgement.secondTelegraphMs), attackDir: back, chain: 1, contact: 'none' });
        break;
      }
      if (card === 'midnight') {
        const hit = contactPlayer(state, enemy, midnightAttack(def, worldDifficulty(state)), slamTouches(enemy, state.player.pos, p2.midnight.radius), events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
        if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(enemy.ai, 'recover', p2.midnight.recoverMs), contact: 'none' });
      } else if (card === 'oaths') {
        if (!modeOver(ai)) break;
        if (boss.comboIndex >= p2.oaths.volleys) {
          enemy = withAi(enemy, enterMode(enemy.ai, 'recover', p2.oaths.recoverMs));
          break;
        }
        for (const dir of spreadDirections(toPlayer, p2.oaths.perVolley, p2.oaths.spreadDegrees)) state = spawnShot(state, enemy, p2.oaths.blade, dir);
        enemy = withAi(withBoss({ ...enemy, facing: toPlayer }, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', p2.oaths.gapMs));
      } else if (modeOver(ai)) {
        enemy = withAi(enemy, enterMode(enemy.ai, 'recover', p2.shadow.recoverMs));
      }
      break;
    case 'recover':
      // The opening is over: back to Shield through the (phase-2) stance change.
      if (modeOver(ai)) {
        events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'transform', durationMs: p2.transformMs });
        enemy = withAi(enemy, enterMode(ai, 'transform', p2.transformMs));
      }
      break;
    default:
      enemy = withAi(enemy, enterMode(ai, 'recover', 0));
      break;
  }
  return { state, enemy };
}

/**
 * Advances along the attack direction without stepping into its target:
 * a lunge stops at body contact instead of passing through.
 */
function lunge(state: WorldState, enemy: EnemyState, target: Vec2, distancePx: number): EnemyState {
  const stop = enemy.radius + PLAYER_RADIUS;
  const ahead = dot(sub(target, enemy.pos), enemy.ai.attackDir);
  const near = distance(target, enemy.pos) <= stop + 2;
  const step = near && ahead > 0 ? 0 : distancePx;
  return moveEnemy(state, enemy, scale(enemy.ai.attackDir, step));
}

function updateShield(state: WorldState, start: EnemyState, def: AegislashDef, target: Vec2, ms: number, events: GameEvent[]) {
  const shield = def.shield;
  let enemy = start;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
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
      enemy = lunge(state, enemy, target, (shield.bashDistance / shield.bashMs) * ms);
      const hit = contactPlayer(state, enemy, shield.bash, bashTouches(enemy, state.player.pos), events);
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

function updateBlade(state: WorldState, start: EnemyState, def: AegislashDef, target: Vec2, ms: number, events: GameEvent[]) {
  const blade = def.blade;
  let enemy = start;
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const turn = blade.turnRateDegPerSec * DEG * (ms / 1000);
  // Harder tiers lengthen the combo (hard: a fourth blow behind a delayed feint).
  const combo = bladeCombo(def, worldDifficulty(state));
  const blow = combo[boss.comboIndex] ?? combo[0]!;

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
      enemy = lunge(state, enemy, target, (blow.lungeDistance / blow.strikeMs) * ms);
      const hit = contactPlayer(state, enemy, blow.attack, bladeTouches(enemy, state.player.pos), events);
      state = hit.state;
      enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      if (modeOver(ai)) {
        const next = boss.comboIndex + 1;
        if (next < combo.length) {
          enemy = telegraph(withBoss(enemy, { comboIndex: next }), `combo${next + 1}`, combo[next]!.telegraphMs, events);
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
export function updateBoss(state: WorldState, start: EnemyState, def: AegislashDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  // Normal and harder: the spell-card fight (core/cards.ts); a Sima echo keeps the lighter stance duel.
  if (def.spellCards && !state.enemyScale?.echo) return updateCardFight(state, start, def.spellCards, target, ms, events);
  let enemy = start;
  const ai = enemy.ai;
  if (ai.mode === 'idle') {
    if (distance(enemy.pos, target) <= def.aggroRange) enemy = withAi(enemy, enterMode(ai, 'approach'));
    return replaceEnemy(state, enemy);
  }
  enemy = withBoss(enemy, { stanceMs: enemy.boss!.stanceMs + ms });

  // Half HP: "El Rey desenvaina", once, never in the middle of a blow (not in a Sima echo: phase 1 only).
  if (!state.enemyScale?.echo && enemy.boss!.phase !== 2 && enemy.hp <= enemy.maxHp * def.phase2.threshold && ai.mode !== 'attack') {
    events.push({ type: 'bossStance', enemyId: enemy.id, stance: 'unsheathe' });
    events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'unsheathe', durationMs: def.phase2.unsheatheMs });
    enemy = withBoss(enemy, { phase: 2, stance: 'unsheathe', stanceMs: 0, comboIndex: 0, combosDone: 0, cardsPlayed: 0 });
    return replaceEnemy(state, withAi(enemy, { ...enterMode(ai, 'transform', def.phase2.unsheatheMs), contact: 'none' }));
  }

  if (ai.mode === 'transform') {
    if (modeOver(ai)) {
      const now = enemy.boss!.stance;
      // Unsheathed: straight into Blade; Shield turns into Blade; Blade and every card end in Shield.
      const stance: BossStance = now === 'unsheathe' || now === 'shield' ? 'blade' : 'shield';
      events.push({ type: 'bossStance', enemyId: enemy.id, stance });
      enemy = withBoss(enemy, { stance, stanceMs: 0, stanceDamage: 0, comboIndex: 0, combosDone: 0 });
      enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: 0 });
    }
    return replaceEnemy(state, enemy);
  }
  if (isCard(enemy.boss!.stance)) {
    const card = updateCard(state, enemy, def, target, ms, events);
    return replaceEnemy(card.state, card.enemy);
  }
  if (ai.mode === 'approach' && wantsStanceChange(enemy.boss!, def)) {
    // Phase 2: Blade ends in a spell card instead of a plain stance change.
    if (enemy.boss!.phase === 2 && enemy.boss!.stance === 'blade') return replaceEnemy(state, startCard(state, enemy, def, target, events));
    const transformMs = enemy.boss!.phase === 2 ? def.phase2.transformMs : def.transformMs;
    events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'transform', durationMs: transformMs });
    return replaceEnemy(state, withAi(enemy, enterMode(ai, 'transform', transformMs)));
  }

  const result =
    enemy.boss!.stance === 'shield' ? updateShield(state, enemy, def, target, ms, events) : updateBlade(state, enemy, def, target, ms, events);
  return replaceEnemy(result.state, result.enemy);
}
