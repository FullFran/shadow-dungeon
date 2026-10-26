import type { EnemyAttackDef } from '../data/enemies';
import { SWAMP_SHOT_CAP, type QueenCard, type QueenDef, type UltraCard, type UltraDef } from '../data/swamp-enemies';
import { TUNING } from '../data/tuning';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, rotate, spawnShot, spreadDirections, telegraph, towardTarget, type EnemyShot } from './brain';
import { confineCircle } from './geometry';
import type { AiState, Arena, BossState, EnemyState, GameEvent, PlayerState, WorldState } from './state';
import { add, distance, normalize, scale, sub, vec, type Vec2 } from './vec';
import { spawnEnemy } from './world';
import { hostedMoves, updateHostedCardFight } from './cards';
import type { SpellCardDef } from '../data/cards';

/**
 * The Toxic Swamp's bosses (data/swamp-enemies.ts): Salazzle, the mid-boss
 * (`queen`), and Nihilego, the guardian (`ultra`), both on named spell cards
 * read from `boss.stance` (the HUD and guests see them). Patterns lean
 * bullet hell but every card leaves a safe path: alternating tendril lanes,
 * spiral arms with wide gaps that turn slower than a player walks near the
 * boss, rings whose gaps are wider than a player, safe pockets that can be
 * reached within their telegraph. Where a card is aimed (a wormhole, the
 * nearest pocket) travels in `ai.aimPoint`, its wave in `boss.comboIndex`
 * and its orientation in `ai.attackDir`, all already in the snapshot.
 * Enemy projectiles are capped per boss (`maxShots`, 140) under the global
 * `ENEMY_SHOT_CAP`. Harder tiers reach them as data (data/swamp-tricks.ts,
 * through `behaviourFor`); the positional cards (haze, wormhole, flood) wind
 * up with the shared pierce telegraph.
 */

const PLAYER_RADIUS = TUNING.player.radius;

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** Fires a shot unless the air already holds `cap` enemy projectiles (the boss's `maxShots`; `spawnShot` adds the global `ENEMY_SHOT_CAP`). */
export function spawnCapped(state: WorldState, enemy: EnemyState, shot: EnemyShot, dir: Vec2, at?: Vec2, cap: number = SWAMP_SHOT_CAP): WorldState {
  const flying = state.projectiles.reduce((n, p) => (p.owner === 'enemy' ? n + 1 : n), 0);
  return flying >= cap ? state : spawnShot(state, enemy, shot, dir, at);
}

// Shared geometry (host brains, guest victim side, renderer).

/** Centres of a `cols` x `rows` grid over the arena: where safe pockets may open. */
export function pocketGrid(arena: Pick<Arena, 'width' | 'height'>, cols: number, rows: number): Vec2[] {
  const out: Vec2[] = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) out.push(vec((arena.width * (x + 0.5)) / cols, (arena.height * (y + 0.5)) / rows));
  return out;
}

/** The grid spot nearest to `pos`. */
export function nearestSpot(spots: readonly Vec2[], pos: Vec2): Vec2 {
  return spots.reduce((best, s) => (distance(s, pos) < distance(best, pos) ? s : best), spots[0]!);
}

export const HAZE_GRID = { cols: 3, rows: 2 } as const;
export const FLOOD_GRID = { cols: 3, rows: 3 } as const;

/** Salazzle's haze: the pocket nearest the player and its mirror through the middle of the den. */
export const hazePockets = (arena: Pick<Arena, 'width' | 'height'>, aim: Vec2): Vec2[] => [aim, vec(arena.width - aim.x, arena.height - aim.y)];

/** Nihilego's flood: the pocket nearest the player and its mirrors across each axis. */
export const floodPockets = (arena: Pick<Arena, 'width' | 'height'>, aim: Vec2): Vec2[] => [aim, vec(arena.width - aim.x, aim.y), vec(aim.x, arena.height - aim.y)];

/** True when the whole player body is inside one of the pockets. */
export const sheltered = (pockets: readonly Vec2[], radius: number, pos: Vec2): boolean => pockets.some((p) => distance(p, pos) <= radius - PLAYER_RADIUS);

/** Tendril lanes run across the arena: rows when the aim is horizontal, columns otherwise. */
export const tendrilRows = (attackDir: Vec2): boolean => Math.abs(attackDir.x) >= Math.abs(attackDir.y);

/** The lanes a tendril wave lashes: every other lane, the set alternating with the wave; as [from, to] along the split axis. */
export function tendrilLanes(arena: Pick<Arena, 'width' | 'height'>, rows: boolean, lanes: number, wave: number): [number, number][] {
  const span = rows ? arena.height : arena.width;
  const size = span / lanes;
  const out: [number, number][] = [];
  for (let i = 0; i < lanes; i++) if (i % 2 === wave % 2) out.push([i * size, (i + 1) * size]);
  return out;
}

export function inTendril(arena: Pick<Arena, 'width' | 'height'>, rows: boolean, lanes: number, wave: number, pos: Vec2): boolean {
  const at = rows ? pos.y : pos.x;
  return tendrilLanes(arena, rows, lanes, wave).some(([from, to]) => at + PLAYER_RADIUS > from && at - PLAYER_RADIUS < to);
}

/** Centres of the downpour's circles for a wave: a checkerboard of the arena's cells, the other half on the next wave. */
export function downpourCircles(arena: Pick<Arena, 'width' | 'height'>, cols: number, rows: number, wave: number): Vec2[] {
  return pocketGrid(arena, cols, rows).filter((_, i) => (Math.floor(i / cols) + (i % cols)) % 2 === wave % 2);
}

/** Directions of a spiral's arms after `ms` of turning (Nihilego's phase-2 spores spin back halfway). */
export function spiralDirs(base: Vec2, arms: number, degPerSec: number, ms: number, reverseAfterMs?: number): Vec2[] {
  const t = reverseAfterMs !== undefined && ms > reverseAfterMs ? 2 * reverseAfterMs - ms : ms;
  return spreadDirections(rotate(base, (degPerSec * t) / 1000), arms, 360 - 360 / arms);
}

// Salazzle.

/** Salazzle's rotation (nightmare's court is already in `def` through `behaviourFor`). */
export const queenCards = (def: QueenDef): QueenCard[] => [...def.cards];

export const queenCardAt = (def: QueenDef, done: number): QueenCard => {
  const cards = queenCards(def);
  return cards[done % cards.length]!;
};

export const danceDashes = (def: QueenDef): number => def.dance.dashes;

/** Salazzle's attack in progress against one player position, or null (shared with the guest's victim side). */
export function queenAttack(arena: Pick<Arena, 'width' | 'height'>, enemy: EnemyState, def: QueenDef, pos: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  if (enemy.ai.mode !== 'attack') return null;
  const stance = enemy.boss?.stance;
  if (stance === 'dance') return { attack: def.dance.attack, touches: distance(enemy.pos, pos) <= enemy.radius + PLAYER_RADIUS };
  if (stance === 'haze' && enemy.ai.aimPoint) return { attack: def.haze.attack, touches: !sheltered(hazePockets(arena, enemy.ai.aimPoint), def.haze.pocketRadius, pos) };
  return null;
}

function drift(state: WorldState, enemy: EnemyState, target: Vec2, keep: number, speed: number, ms: number): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  const dist = distance(enemy.pos, target);
  const radial = dist < keep - 30 ? scale(toPlayer, -1) : dist > keep + 60 ? toPlayer : vec(0, 0);
  const dir = normalize(add(radial, scale(perpendicular(toPlayer, enemy.ai.strafeSign), 0.6)));
  return { ...moveEnemy(state, enemy, scale(dir, (speed * ms) / 1000)), facing: toPlayer };
}

const middle = (state: WorldState, enemy: EnemyState): Vec2 => confineCircle(state.arena, vec(state.arena.width / 2, state.arena.height / 2), enemy.radius);

function startQueenCard(state: WorldState, enemy: EnemyState, def: QueenDef, target: Vec2, events: GameEvent[]): EnemyState {
  const card = queenCardAt(def, enemy.boss!.combosDone);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  const toPlayer = towardTarget(target, next);
  if (card === 'dance') return telegraph(next, 'dance', def.dance.telegraphMs, toPlayer, events);
  if (card === 'spiral') {
    // A leap to the middle of the den, then the wind-up.
    const pos = middle(state, next);
    return telegraph({ ...next, pos }, 'spiral', def.spiral.telegraphMs, towardTarget(target, { ...next, pos }), events);
  }
  if (card === 'haze') {
    const aim = nearestSpot(pocketGrid(state.arena, HAZE_GRID.cols, HAZE_GRID.rows), target);
    const winding = telegraph(next, 'haze', def.haze.telegraphMs, toPlayer, events, def.haze.attack.pierceRoll === true);
    return withAi(winding, { ...winding.ai, aimPoint: aim });
  }
  return telegraph(next, 'escort', def.escort.telegraphMs, toPlayer, events);
}

function queenRest(enemy: EnemyState, def: QueenDef, recoverMs: number): EnemyState {
  const { aimPoint: _aim, ...ai } = enemy.ai;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: enemy.boss!.combosDone + 1 }), { ...enterMode(ai, 'recover', recoverMs), contact: 'none', cooldownMs: def.restMs });
}

export function updateQueen(state: WorldState, start: EnemyState, def: QueenDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  // Normal and harder: hosted spell cards (data/hosted-cards.ts); the court and its patterns stay hers.
  const fight = def.spellCards;
  if (fight && !state.enemyScale?.echo) {
    const own = (card: SpellCardDef): QueenDef => ({ ...def, spellCards: undefined, cards: hostedMoves<QueenCard>(card, def) });
    return updateHostedCardFight(state, start, fight, target, ms, events, (s, e, card) => updateQueen(s, e, own(card), target, ms, events), (card) => own(card).cards[0]!);
  }
  let enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardTarget(target, enemy);
  switch (ai.mode) {
    case 'idle':
      if (distance(enemy.pos, target) <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    case 'approach':
      enemy = ai.cooldownMs <= 0 ? startQueenCard(state, enemy, def, target, events) : drift(state, enemy, target, def.keepDistance, def.walkSpeed, ms);
      break;
    case 'telegraph':
      if (boss.stance === 'dance' && ai.modeDurationMs - ai.modeMs > def.dance.lockMs) enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: boss.stance });
      if (boss.stance === 'dance') enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.dance.dashMs), contact: 'none', aimPoint: enemy.pos });
      else if (boss.stance === 'spiral') enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.spiral.durationMs), contact: 'none' });
      else if (boss.stance === 'haze') enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.haze.activeMs), contact: 'none' });
      else {
        // Escort: two Salandit at her sides, never more than that alive at once.
        const alive = state.enemies.filter((e) => e.alive && e.species === def.escort.species).length;
        for (let i = alive; i < def.escort.count; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          state = spawnEnemy(state, def.escort.species, confineCircle(state.arena, add(enemy.pos, scale(perpendicular(toPlayer, side), 70)), 12));
        }
        enemy = queenRest(enemy, def, def.escort.recoverMs);
      }
      break;
    case 'attack': {
      if (boss.stance === 'spiral') {
        const fired = Math.floor(ai.modeMs / def.spiral.everyMs);
        for (let n = boss.comboIndex; n < fired; n++) {
          for (const dir of spiralDirs(ai.attackDir, def.spiral.arms, def.spiral.degPerSec, n * def.spiral.everyMs)) state = spawnCapped(state, enemy, def.spiral.flame, dir, undefined, def.maxShots);
        }
        enemy = withBoss(enemy, { comboIndex: Math.max(boss.comboIndex, fired) });
        if (modeOver(ai)) enemy = queenRest(enemy, def, def.spiral.recoverMs);
        break;
      }
      if (boss.stance === 'dance') {
        const from = enemy.pos;
        enemy = moveEnemy(state, enemy, scale(ai.attackDir, (def.dance.dashDistance / def.dance.dashMs) * ms));
        const origin = ai.aimPoint ?? from;
        if (Math.floor(distance(origin, enemy.pos) / def.dance.smoke.everyPx) > Math.floor(distance(origin, from) / def.dance.smoke.everyPx)) {
          state = spawnCapped(state, enemy, { ...def.dance.smoke.puff, speed: 0 }, ai.attackDir, enemy.pos, def.maxShots);
        }
      }
      const active = queenAttack(state.arena, enemy, def, state.player.pos);
      if (active) {
        const hit = contactPlayer(state, enemy, active.attack, active.touches, events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      }
      if (!modeOver(ai)) break;
      if (boss.stance === 'dance' && boss.comboIndex + 1 < danceDashes(def)) {
        const { aimPoint: _from, ...rest } = enemy.ai;
        enemy = telegraph(withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), rest), 'dance', def.dance.telegraphMs, towardTarget(target, enemy), events);
        break;
      }
      enemy = queenRest(enemy, def, boss.stance === 'dance' ? def.dance.recoverMs : def.haze.recoverMs);
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), strafeSign: ai.strafeSign === 1 ? -1 : 1 });
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

// Nihilego.

export const tendrilWaves = (def: UltraDef): number => def.tendrils.waves;
export const shardRings = (def: UltraDef): number => def.shards.rings;

/** The cards of a phase in order (on nightmare `behaviourFor` closes each turn with the downpour). */
export function ultraCards(def: UltraDef, phase: 1 | 2): UltraCard[] {
  return [...(phase === 2 ? def.phase2.cards : def.phase1)];
}

export const ultraCardAt = (def: UltraDef, phase: 1 | 2, done: number): UltraCard => {
  const cards = ultraCards(def, phase);
  return cards[done % cards.length]!;
};

/** Nihilego's attack in progress against one player position, or null (shared with the guest's victim side). */
export function ultraAttack(arena: Pick<Arena, 'width' | 'height'>, enemy: EnemyState, def: UltraDef, pos: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  if (enemy.ai.mode !== 'attack' || !enemy.boss) return null;
  const { stance, comboIndex } = enemy.boss;
  if (stance === 'tendrils') return { attack: def.tendrils.attack, touches: inTendril(arena, tendrilRows(enemy.ai.attackDir), def.tendrils.lanes, comboIndex, pos) };
  if (stance === 'wormhole') return { attack: def.wormhole.attack, touches: distance(enemy.pos, pos) <= def.wormhole.radius + PLAYER_RADIUS };
  if (stance === 'flood' && enemy.ai.aimPoint) return { attack: def.flood.attack, touches: !sheltered(floodPockets(arena, enemy.ai.aimPoint), def.flood.pocketRadius, pos) };
  if (stance === 'downpour') {
    const circles = downpourCircles(arena, def.downpour.cols, def.downpour.rows, comboIndex);
    return { attack: def.downpour.attack, touches: circles.some((c) => distance(c, pos) <= def.downpour.radius + PLAYER_RADIUS) };
  }
  return null;
}

const phaseOf = (enemy: EnemyState): 1 | 2 => (enemy.boss?.phase === 2 ? 2 : 1);

function startUltraCard(state: WorldState, enemy: EnemyState, def: UltraDef, target: Vec2, events: GameEvent[]): EnemyState {
  // The awakening: once, at half HP, between cards (never mid-pattern; never in a Sima echo: phase 1 only).
  if (!state.enemyScale?.echo && phaseOf(enemy) === 1 && enemy.hp <= def.phase2.threshold * enemy.maxHp) {
    events.push({ type: 'bossStance', enemyId: enemy.id, stance: 'ultra' });
    events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'ultra', durationMs: def.phase2.awakenMs });
    const awakening = withBoss(enemy, { stance: 'ultra', stanceMs: 0, comboIndex: 0, combosDone: 0, phase: 2 });
    return withAi(awakening, { ...enterMode(enemy.ai, 'transform', def.phase2.awakenMs), contact: 'none' });
  }
  const phase = phaseOf(enemy);
  const card = ultraCardAt(def, phase, enemy.boss!.combosDone);
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card });
  const next = withBoss(enemy, { stance: card, stanceMs: 0, comboIndex: 0 });
  return windUltra(state, next, def, card, 0, target, events);
}

/** The wind-up of a card's `index`-th wave or jump. */
function windUltra(state: WorldState, enemy: EnemyState, def: UltraDef, card: UltraCard, index: number, target: Vec2, events: GameEvent[]): EnemyState {
  const toPlayer = towardTarget(target, enemy);
  if (card === 'tendrils') {
    // Phase 2 alternates rows and columns; phase 1 keeps the first orientation of the card.
    const rows = phaseOf(enemy) === 2 ? index % 2 === 0 : Math.abs(toPlayer.x) < Math.abs(toPlayer.y);
    return telegraph(enemy, 'tendrils', def.tendrils.telegraphMs, rows ? vec(1, 0) : vec(0, 1), events);
  }
  if (card === 'spores') return telegraph(enemy, 'spores', def.spores.telegraphMs, toPlayer, events);
  if (card === 'shards') return telegraph(enemy, 'shards', def.shards.telegraphMs, toPlayer, events);
  if (card === 'wormhole') {
    const aim = confineCircle(state.arena, target, def.wormhole.radius * 0.5);
    const winding = telegraph(enemy, 'wormhole', def.wormhole.telegraphMs, toPlayer, events, def.wormhole.attack.pierceRoll === true);
    return withAi(winding, { ...winding.ai, aimPoint: aim });
  }
  if (card === 'flood') {
    const aim = nearestSpot(pocketGrid(state.arena, FLOOD_GRID.cols, FLOOD_GRID.rows), target);
    const winding = telegraph(enemy, 'flood', def.flood.telegraphMs, toPlayer, events, def.flood.attack.pierceRoll === true);
    return withAi(winding, { ...winding.ai, aimPoint: aim });
  }
  return telegraph(enemy, 'downpour', def.downpour.telegraphMs, toPlayer, events);
}

function ultraRest(enemy: EnemyState, def: UltraDef, recoverMs: number): EnemyState {
  const { aimPoint: _aim, ...ai } = enemy.ai;
  const rest = phaseOf(enemy) === 2 ? def.phase2.restMs : def.restMs;
  return withAi(withBoss(enemy, { comboIndex: 0, combosDone: enemy.boss!.combosDone + 1 }), { ...enterMode(ai, 'recover', recoverMs), contact: 'none', cooldownMs: rest });
}

function throwRing(state: WorldState, enemy: EnemyState, def: UltraDef, aim: Vec2, index: number): WorldState {
  let next = state;
  const count = def.shards.perRing;
  for (const dir of spreadDirections(aim, count, 360 - 360 / count, index % 2 === 1 ? 180 / count : 0)) next = spawnCapped(next, enemy, def.shards.shard, dir, undefined, def.maxShots);
  return next;
}

/** Nihilego restricted to a hosted card's moves, in the phase the card plays (its phase-2 moves are faster); it never awakens on its own. */
export function hostedUltra(def: UltraDef, card: SpellCardDef, phase2: boolean): UltraDef {
  const moves = hostedMoves<UltraCard>(card, def);
  const { spellCards: _cards, ...base } = def;
  return { ...base, phase1: phase2 ? def.phase1 : moves, phase2: { ...def.phase2, threshold: -1, cards: phase2 ? moves : def.phase2.cards } };
}

export function updateUltra(state: WorldState, start: EnemyState, def: UltraDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss) return state;
  // Normal and harder: hosted spell cards (data/hosted-cards.ts).
  const fight = def.spellCards;
  if (fight && !state.enemyScale?.echo) {
    const own = (card: SpellCardDef, e: EnemyState) => hostedUltra(def, card, card.phase2 === true || e.boss?.phase === 2);
    return updateHostedCardFight(state, start, fight, target, ms, events, (s, e, card) => updateUltra(s, e, own(card, e), target, ms, events), (card) => hostedMoves<UltraCard>(card, def)[0]!);
  }
  let enemy = withBoss(start, { stanceMs: start.boss.stanceMs + ms });
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const stance = boss.stance as UltraCard;
  switch (ai.mode) {
    case 'idle':
      if (distance(enemy.pos, target) <= def.aggroRange) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.restMs });
      break;
    case 'approach':
      enemy = ai.cooldownMs <= 0 ? startUltraCard(state, enemy, def, target, events) : drift(state, enemy, target, def.keepDistance, def.walkSpeed, ms);
      break;
    case 'transform':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: def.phase2.restMs });
      break;
    case 'telegraph':
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: stance });
      if (stance === 'spores') enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.spores.durationMs), contact: 'none' });
      else if (stance === 'shards') {
        state = throwRing(state, enemy, def, enemy.ai.attackDir, 0);
        enemy = withAi(withBoss(enemy, { comboIndex: 1 }), { ...enterMode(enemy.ai, 'attack', def.shards.gapMs), contact: 'none' });
      } else if (stance === 'wormhole') {
        // Out of the wormhole: it emerges at the marked spot with a burst of shards, and the mouth bites.
        const pos = enemy.ai.aimPoint ?? enemy.pos;
        enemy = { ...enemy, pos };
        for (const dir of spreadDirections(enemy.ai.attackDir, def.wormhole.burst.count, 360 - 360 / def.wormhole.burst.count)) state = spawnCapped(state, enemy, def.wormhole.burst.shot, dir, undefined, def.maxShots);
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', def.wormhole.strikeMs), contact: 'none' });
      } else {
        const activeMs = stance === 'tendrils' ? def.tendrils.strikeMs : stance === 'flood' ? def.flood.activeMs : def.downpour.strikeMs;
        enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', activeMs), contact: 'none' });
      }
      break;
    case 'attack': {
      if (stance === 'spores') {
        const arms = phaseOf(enemy) === 2 ? def.spores.arms2 : def.spores.arms;
        const reverse = phaseOf(enemy) === 2 ? def.spores.durationMs / 2 : undefined;
        const fired = Math.floor(ai.modeMs / def.spores.everyMs);
        for (let n = boss.comboIndex; n < fired; n++) {
          for (const dir of spiralDirs(ai.attackDir, arms, def.spores.degPerSec, n * def.spores.everyMs, reverse)) state = spawnCapped(state, enemy, def.spores.spore, dir, undefined, def.maxShots);
        }
        enemy = withBoss(enemy, { comboIndex: Math.max(boss.comboIndex, fired) });
        if (modeOver(ai)) enemy = ultraRest(enemy, def, def.spores.recoverMs);
        break;
      }
      if (stance === 'shards') {
        if (!modeOver(ai)) break;
        if (boss.comboIndex >= shardRings(def)) {
          enemy = ultraRest(enemy, def, def.shards.recoverMs);
          break;
        }
        state = throwRing(state, enemy, def, towardTarget(target, enemy), boss.comboIndex);
        enemy = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), enterMode(enemy.ai, 'attack', def.shards.gapMs));
        break;
      }
      const active = ultraAttack(state.arena, enemy, def, state.player.pos);
      if (active) {
        const hit = contactPlayer(state, enemy, active.attack, active.touches, events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      }
      if (!modeOver(ai)) break;
      const waves = stance === 'tendrils' ? tendrilWaves(def) : stance === 'wormhole' ? def.wormhole.jumps : stance === 'downpour' ? 2 : 1;
      if (boss.comboIndex + 1 < waves) {
        const { aimPoint: _aim, ...rest } = enemy.ai;
        const next = withAi(withBoss(enemy, { comboIndex: boss.comboIndex + 1 }), rest);
        enemy = windUltra(state, next, def, stance, boss.comboIndex + 1, target, events);
        // Phase 1 tendrils keep one orientation: the second wave lashes the other set of the same lanes.
        if (stance === 'tendrils' && phaseOf(enemy) === 1) enemy = withAi(enemy, { ...enemy.ai, attackDir: ai.attackDir });
        break;
      }
      const recoverMs = stance === 'tendrils' ? def.tendrils.recoverMs : stance === 'wormhole' ? def.wormhole.recoverMs : stance === 'flood' ? def.flood.recoverMs : def.downpour.recoverMs;
      enemy = ultraRest(enemy, def, recoverMs);
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), strafeSign: ai.strafeSign === 1 ? -1 : 1 });
      break;
    default:
      break;
  }
  return replaceEnemy(state, enemy);
}

/**
 * The open Ultra wormhole pulls gently on the local player within its range
 * while it is marked (every peer applies it to its own player, from the
 * boss state in the snapshot). The pull is slower than walking, so walking
 * out always works.
 */
export function wormholePull(state: WorldState, dtMs: number, def: UltraDef): WorldState {
  let player: PlayerState = state.player;
  for (const enemy of state.enemies) {
    if (!enemy.alive || enemy.species !== 'nihilego' || enemy.boss?.stance !== 'wormhole' || enemy.ai.mode !== 'telegraph' || !enemy.ai.aimPoint) continue;
    const toward = sub(enemy.ai.aimPoint, player.pos);
    const dist = distance(enemy.ai.aimPoint, player.pos);
    if (dist > def.wormhole.pullRange || dist < 1) continue;
    const stepPx = Math.min(dist, (def.wormhole.pullSpeed * dtMs) / 1000);
    player = { ...player, pos: confineCircle(state.arena, add(player.pos, scale(normalize(toward), stepPx)), PLAYER_RADIUS) };
  }
  return player === state.player ? state : { ...state, player };
}
