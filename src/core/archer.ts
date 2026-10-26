import type { ArcherCard, ArcherDef } from '../data/enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, rotate, spawnShot, spreadDirections, towardTarget } from './brain';
import { fightFor, updateCardFight } from './cards';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { diveTouches } from './victim';
import { add, distance, normalize, scale, sub, vec, type Vec2 } from './vec';

/**
 * Decidueye, guardian of the Misty Forest: spell cards played in a fixed
 * order, each one announced (its name shows on screen: the HUD reads the card
 * from `boss.stance`) and telegraphed.
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
 * Phase 2 (data `phase2`): at half HP, once and never mid-blow, "El Arquero
 * se desvanece en la niebla" (stance `mist`: a long fade, the opening), then
 * a denser order: Rain (arrows pour down every lane but one; the safe lane
 * moves over each wave), Fan, Feathers (arms of feathers from the middle of
 * the clearing), Dive, Stitch (it and two shadow clones in the far corners
 * fire lines of arrows into one locked spot, three times). Never in a Sima
 * echo. The safe lane and the stitch spot travel in `ai.aimPoint`; the phase
 * itself is host-only.
 *
 * Between cards it rests, drifting to keep its distance.
 */

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** The card played after `done` cards (of phase 2's order once it has started). */
export const cardAt = (def: ArcherDef, done: number, phase2 = false): ArcherCard => {
  const cards = phase2 ? def.phase2.cards : def.cards;
  return cards[done % cards.length]!;
};

/** Aim of the dive locks this long before it starts: the lane on the ground stops following the player. */
export const DIVE_LOCK_MS = 380;

/** Where the fan card reappears: of the clearing's four edge midpoints (inset), the farthest from the player. */
export function fanPerch(arena: { width: number; height: number }, player: Vec2, inset: number): Vec2 {
  const points = [vec(arena.width / 2, inset), vec(arena.width - inset, arena.height / 2), vec(arena.width / 2, arena.height - inset), vec(inset, arena.height / 2)];
  let best = points[0]!;
  for (const p of points) if (distance(p, player) > distance(best, player)) best = p;
  return best;
}

/** Lane of the clearing (0-based, left to right) the current rain wave spares. */
export const rainSafeLane = (enemy: Pick<EnemyState, 'ai'>, width: number, lanes = 8): number =>
  Math.min(lanes - 1, Math.max(0, Math.floor((enemy.ai.aimPoint?.x ?? 0) / (width / lanes))));

/** Who fires the stitch: the archer, then its two shadow clones in the corners away from the locked spot. */
export function stitchSources(enemy: Pick<EnemyState, 'pos' | 'ai'>, arena: { width: number; height: number }, inset = 60): Vec2[] {
  const aim = enemy.ai.aimPoint ?? enemy.pos;
  const y = aim.y > arena.height / 2 ? inset : arena.height - inset;
  return [enemy.pos, vec(inset, y), vec(arena.width - inset, y)];
}

/** A wind-up; `pierceRoll` marks a positional one (its own warning sound: walk out of it). */
function windUp(enemy: EnemyState, attack: string, durationMs: number, dir: Vec2, events: GameEvent[], extra: Partial<AiState> = {}, pierceRoll = false): EnemyState {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack, durationMs, ...(pierceRoll ? { pierceRoll: true as const } : {}) });
  return { ...enemy, facing: dir, ai: { ...enterMode(enemy.ai, 'telegraph', durationMs), attackDir: dir, ...extra } };
}

const vanish = (enemy: EnemyState, ms: number, events: GameEvent[]): EnemyState => {
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'vanish', durationMs: ms });
  return withAi(enemy, enterMode(enemy.ai, 'transform', ms));
};

/** The first rain wave spares the lane next to the player's (so it has to step); it sweeps on from there. */
function rainStart(def: ArcherDef, width: number, target: Vec2): { aimPoint: Vec2; attackDir: Vec2 } {
  const lanes = def.phase2.rain.lanes;
  const laneW = width / lanes;
  const own = Math.min(lanes - 1, Math.max(0, Math.floor(target.x / laneW)));
  const dir = own + 1 < lanes ? 1 : -1;
  return { aimPoint: vec((own + dir + 0.5) * laneW, 0), attackDir: vec(dir, 0) };
}

function rainNext(def: ArcherDef, width: number, enemy: EnemyState): { aimPoint: Vec2; attackDir: Vec2 } {
  const lanes = def.phase2.rain.lanes;
  const laneW = width / lanes;
  const safe = rainSafeLane(enemy, width, lanes);
  let dir = enemy.ai.attackDir.x < 0 ? -1 : 1;
  if (safe + dir < 0 || safe + dir >= lanes) dir = -dir;
  return { aimPoint: vec((safe + dir + 0.5) * laneW, 0), attackDir: vec(dir, 0) };
}

function startCard(state: WorldState, enemy: EnemyState, def: ArcherDef, target: Vec2, toPlayer: Vec2, events: GameEvent[]): EnemyState {
  const phase2 = enemy.boss!.phase === 2;
  const card = cardAt(def, enemy.boss!.combosDone, phase2);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  const p2 = def.phase2;
  if (card === 'volley') return windUp(next, 'volley', def.volley.telegraphMs, toPlayer, events);
  if (card === 'dive') return windUp(next, 'dive', def.dive.telegraphMs, toPlayer, events);
  if (card === 'rain') return windUp(next, 'rain', p2.rain.telegraphMs, toPlayer, events, rainStart(def, state.arena.width, target), p2.rain.arrow.pierceRoll === true);
  if (card === 'stitch') return windUp(next, 'stitch', p2.stitch.telegraphMs, toPlayer, events, { aimPoint: target });
  // Fan and Feathers: it fades into the fog first.
  return vanish(next, card === 'feathers' ? p2.feathers.vanishMs : def.fan.vanishMs, events);
}

const fanOffset = (def: ArcherDef, index: number): number => (index % 2 === 1 ? def.fan.spreadDegrees / (def.fan.leaves - 1) / 2 : 0);

function fire(state: WorldState, enemy: EnemyState, def: ArcherDef, dir: Vec2, index: number): WorldState {
  const stance = enemy.boss!.stance;
  if (stance === 'volley') return spawnShot(state, enemy, def.volley.arrow, dir);
  let next = state;
  if (stance === 'feathers') {
    const f = def.phase2.feathers;
    for (const d of spreadDirections(rotate(dir, f.turnDegrees * index), f.arms, 360 - 360 / f.arms)) next = spawnShot(next, enemy, f.feather, d);
    return next;
  }
  for (const d of spreadDirections(dir, def.fan.leaves, def.fan.spreadDegrees, fanOffset(def, index))) next = spawnShot(next, enemy, def.fan.leaf, d);
  return next;
}

/** One row of the rain: arrows at the top of every lane but the safe one, falling straight down. */
function rainRow(state: WorldState, enemy: EnemyState, def: ArcherDef): WorldState {
  const rain = def.phase2.rain;
  const laneW = state.arena.width / rain.lanes;
  const safe = rainSafeLane(enemy, state.arena.width, rain.lanes);
  let next = state;
  for (let lane = 0; lane < rain.lanes; lane++) {
    if (lane === safe) continue;
    for (let c = 0; c < rain.columnsPerLane; c++) {
      next = spawnShot(next, enemy, rain.arrow, vec(0, 1), vec(lane * laneW + (laneW * (c + 0.5)) / rain.columnsPerLane, rain.arrow.radius + 1));
    }
  }
  return next;
}

/** The stitch: from the archer and each clone, a line of arrows into the locked spot. */
function stitch(state: WorldState, enemy: EnemyState, def: ArcherDef): WorldState {
  const s = def.phase2.stitch;
  const aim = enemy.ai.aimPoint ?? enemy.pos;
  let next = state;
  for (const [i, from] of stitchSources(enemy, state.arena, s.inset).entries()) {
    const dir = normalize(sub(aim, from));
    if (dir.x === 0 && dir.y === 0) continue;
    const start = i === 0 ? add(from, scale(dir, enemy.radius + s.arrow.radius)) : from;
    for (let k = 0; k < s.arrowsPerLine; k++) next = spawnShot(next, enemy, s.arrow, dir, add(start, scale(dir, -k * 18)));
  }
  return next;
}

const recoverOf = (def: ArcherDef, stance: string): number => {
  const p2 = def.phase2;
  if (stance === 'volley') return def.volley.recoverMs;
  if (stance === 'fan') return def.fan.recoverMs;
  if (stance === 'rain') return p2.rain.recoverMs;
  if (stance === 'feathers') return p2.feathers.recoverMs;
  if (stance === 'stitch') return p2.stitch.recoverMs;
  return def.dive.recoverMs;
};

function rest(enemy: EnemyState, def: ArcherDef): EnemyState {
  const boss = enemy.boss!;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', recoverOf(def, boss.stance)), contact: 'none' });
}

const restMsOf = (def: ArcherDef, enemy: EnemyState): number => (enemy.boss?.phase === 2 ? def.phase2.restMs : def.restMs);

export function updateArcher(state: WorldState, start: EnemyState, def: ArcherDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  // Normal and harder: the spell-card fight (core/cards.ts); a Sima echo keeps the lighter cards above.
  const fight = fightFor(state, def.spellCards);
  if (fight) return updateCardFight(state, start, fight, target, ms, events);
  let enemy = start.boss ? withBoss(start, { stanceMs: start.boss.stanceMs + ms }) : start;
  if (!enemy.boss) return state;
  const ai = enemy.ai;
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const boss = enemy.boss;
  const p2 = def.phase2;

  // Half HP: "El Arquero se desvanece en la niebla", once, never mid-blow (not in a Sima echo).
  if (ai.mode !== 'idle' && !state.enemyScale?.echo && boss.phase !== 2 && enemy.hp <= enemy.maxHp * p2.threshold && ai.mode !== 'attack') {
    events.push({ type: 'bossStance', enemyId: enemy.id, stance: 'mist' });
    events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'mist', durationMs: p2.mistMs });
    enemy = withBoss(enemy, { phase: 2, stance: 'mist', stanceMs: 0, comboIndex: 0, combosDone: 0 });
    const { aimPoint: _gone, ...rest } = enemy.ai;
    return replaceEnemy(state, withAi(enemy, { ...enterMode(rest, 'transform', p2.mistMs), contact: 'none' }));
  }

  switch (ai.mode) {
    case 'idle':
      if (dist <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    case 'approach': {
      if (ai.cooldownMs <= 0) {
        enemy = startCard(state, enemy, def, target, toPlayer, events);
        break;
      }
      // Rest: drift to keep its distance, circling a little.
      const radial = dist < def.keepDistance - 30 ? scale(toPlayer, -1) : dist > def.keepDistance + 60 ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.6)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (def.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'transform':
      if (!modeOver(ai)) break;
      if (boss.stance === 'mist') {
        // Out of the mist at the top of the clearing, in its second phase.
        const pos = vec(state.arena.width / 2, def.fan.edgeInset);
        enemy = withAi({ ...enemy, pos }, { ...enterMode(ai, 'approach'), cooldownMs: p2.restMs });
      } else if (boss.stance === 'feathers') {
        const pos = vec(state.arena.width / 2, state.arena.height / 2);
        enemy = windUp({ ...enemy, pos }, 'feathers', p2.feathers.telegraphMs, towardTarget(target, { ...enemy, pos }), events);
      } else {
        // Fan card: faded out; it reappears at the far edge and starts aiming.
        const perch = fanPerch(state.arena, target, def.fan.edgeInset);
        const aim = towardTarget(target, { ...enemy, pos: perch });
        enemy = windUp({ ...enemy, pos: perch }, 'fan', def.fan.telegraphMs, aim, events);
      }
      break;
    case 'telegraph': {
      const left = ai.modeDurationMs - ai.modeMs;
      const locked = (boss.stance === 'dive' && left <= DIVE_LOCK_MS) || boss.stance === 'rain';
      if (!locked) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (boss.stance === 'rain') enemy = { ...enemy, facing: toPlayer };
      if (boss.stance === 'stitch' && left > p2.stitch.lockMs) enemy = withAi(enemy, { ...enemy.ai, aimPoint: target });
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: boss.stance });
      if (boss.stance === 'dive') {
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.dive.diveMs), contact: 'none' });
      } else if (boss.stance === 'rain') {
        state = rainRow(state, enemy, def);
        enemy = withAi(enemy, enterMode(enemy.ai, 'attack', p2.rain.spawnMs + (state.arena.height / p2.rain.arrow.speed) * 1000));
      } else if (boss.stance === 'stitch') {
        state = stitch(state, enemy, def);
        const next = boss.comboIndex + 1;
        enemy = next < p2.stitch.stitches ? windUp(withBoss(enemy, { comboIndex: next }), 'stitch', p2.stitch.gapMs, toPlayer, events, { aimPoint: target }) : rest(enemy, def);
      } else {
        state = fire(state, enemy, def, enemy.ai.attackDir, 0);
        const gap = boss.stance === 'volley' ? def.volley.gapMs : boss.stance === 'feathers' ? p2.feathers.everyMs : def.fan.gapMs;
        enemy = withAi(withBoss(enemy, { comboIndex: 1 }), enterMode(enemy.ai, 'attack', gap));
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
      if (boss.stance === 'rain') {
        // A row every `everyMs` while it pours; then the arrows fall clear and the next wave is marked.
        const rain = p2.rain;
        for (let k = 1; k * rain.everyMs < rain.spawnMs; k++) {
          const at = k * rain.everyMs;
          if (ai.modeMs - ms < at && ai.modeMs >= at) state = rainRow(state, enemy, def);
        }
        if (!modeOver(ai)) break;
        const next = boss.comboIndex + 1;
        enemy =
          next < rain.waves
            ? windUp(withBoss(enemy, { comboIndex: next }), 'rain', rain.waveTelegraphMs, enemy.ai.attackDir, events, rainNext(def, state.arena.width, enemy), rain.arrow.pierceRoll === true)
            : rest(enemy, def);
        break;
      }
      if (!modeOver(ai)) break;
      const total = boss.stance === 'volley' ? def.volley.shots : boss.stance === 'feathers' ? p2.feathers.bursts : def.fan.fans;
      if (boss.comboIndex >= total) {
        enemy = rest(enemy, def);
        break;
      }
      if (boss.stance === 'feathers') {
        // The arms keep winding from the first aim.
        state = fire(state, enemy, def, enemy.ai.attackDir, boss.comboIndex);
        enemy = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', p2.feathers.everyMs));
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
      if (modeOver(ai)) {
        const { aimPoint: _done, ...rest } = ai;
        enemy = withAi(enemy, { ...enterMode(rest, 'approach'), cooldownMs: restMsOf(def, enemy) });
      }
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}
