import { CAPTURE, cardInfo, segmentFloorShare, type CardFightDef, type CardId, type CardOutcome, type CardStepDef, type SpellCardDef } from '../data/cards';
import type { DanmakuPattern, EnemyAttackDef } from '../data/enemies';
import { contactPlayer, enterMode, modeOver, moveEnemy, perpendicular, replaceEnemy, towardTarget } from './brain';
import { crossed, firePattern, laneGapOf, patternAttackMs, patternMelee, patternParts, ringDirections, shoot } from './danmaku';
import { confineCircle } from './geometry';
import type { AiState, BossState, EnemyState, GameEvent, WorldState } from './state';
import { add, distance, normalize, scale, vec, type Vec2 } from './vec';

/**
 * Spell-card fights (data/cards.ts): the engine any boss with a
 * `spellCards` field runs instead of its own state machine.
 *
 * - `idle`: waits for its target; then declares card 0.
 * - `transform`: a declaration (the card's name on screen, `ai.attack` says
 *   how the previous card ended); invulnerable, no attack.
 * - `approach` (rest), `telegraph`, `attack`, `recover`: the card's moves in
 *   order, looped; the move in play is `ai.attack` (its index), its part
 *   `boss.comboIndex`, as the caves' danmaku bosses do.
 *
 * Every step the card's clock runs (`boss.cardMs`, host only); the card ends
 * when the boss's HP reaches the card's floor (`boss.hpFloor`: hits never go
 * below it while the card plays) or when the timer runs out (the rest of the
 * segment is lost; on the last card that is the boss's end). A survival card
 * only ends with its timer. Ending clears every enemy shot and declares the
 * next card. Captures are judged by each peer for its own player
 * (`updateCapture`), from what the snapshots show.
 */

const withAi = (enemy: EnemyState, ai: AiState): EnemyState => ({ ...enemy, ai });
const withBoss = (enemy: EnemyState, boss: Partial<BossState>): EnemyState => ({ ...enemy, boss: { ...enemy.boss!, ...boss } });

/** Pause between a declaration and the card's first move. */
export const FIRST_MOVE_MS = 400;

/** The fight a behaviour carries, if it fights with spell cards. */
export const fightOf = (def: unknown): CardFightDef | undefined =>
  def !== null && typeof def === 'object' && 'spellCards' in def ? ((def as { spellCards?: CardFightDef }).spellCards ?? undefined) : undefined;

/** Share of max HP left once card `index` is over: the floor of its segment (shares are normalised; data/cards.ts `segmentFloorShare`). */
export const cardFloorShare = (fight: CardFightDef, index: number): number => segmentFloorShare(fight.cards.map((c) => c.hpShare), index);

/** Where each card's segment ends, as shares of max HP (the boss bar's notches; the last is 0). */
export const cardFloors = (fight: CardFightDef): number[] => fight.cards.map((_, i) => cardFloorShare(fight, i));

/** The card a boss plays or declares: by index on the host, by its stance (the id) on any peer. */
export function currentCard(fight: CardFightDef, boss: Pick<BossState, 'stance' | 'card'>): { card: SpellCardDef; index: number } | null {
  if (boss.card !== undefined && fight.cards[boss.card]?.id === boss.stance) return { card: fight.cards[boss.card]!, index: boss.card };
  const index = fight.cards.findIndex((c) => c.id === boss.stance);
  return index >= 0 ? { card: fight.cards[index]!, index } : null;
}

/** The move of the card in play (stance + `ai.attack`), while it winds up, strikes or recovers. */
export function cardStep(fight: CardFightDef, enemy: Pick<EnemyState, 'boss' | 'ai'>): CardStepDef | undefined {
  if (!enemy.boss || enemy.ai.mode === 'transform' || enemy.ai.mode === 'idle') return undefined;
  const found = currentCard(fight, enemy.boss);
  const index = Number(enemy.ai.attack);
  return found && Number.isInteger(index) ? found.card.steps[index] : undefined;
}

/** The lowest HP a hit may leave the boss at: the floor of the card in play (0 outside a card fight). */
export const cardHpFloor = (enemy: Pick<EnemyState, 'boss'>): number => enemy.boss?.hpFloor ?? 0;

/**
 * How a spell card guards (combat.ts asks before a hit lands): `all` while it
 * declares and during a survival card, `front` for a Shield card (not while
 * it recovers: the opening), null otherwise. Read from the stance alone, so a
 * guest's local hits agree with the host.
 */
export function cardGuard(enemy: Pick<EnemyState, 'boss' | 'ai'>): 'all' | 'front' | null {
  const info = cardInfo(enemy.boss?.stance);
  if (!info) return null;
  if (enemy.ai.mode === 'transform' || info.survival) return 'all';
  if (info.guard === 'front' && enemy.ai.mode !== 'recover') return 'front';
  return null;
}

/** Time left on the card in play (host: the snapshot does not carry the clock), or null. */
export function cardTimeLeftMs(fight: CardFightDef, enemy: Pick<EnemyState, 'boss' | 'ai'>): number | null {
  const boss = enemy.boss;
  if (!boss || boss.cardMs === undefined || enemy.ai.mode === 'transform') return null;
  const found = currentCard(fight, boss);
  return found ? Math.max(0, found.card.timerMs - boss.cardMs) : null;
}

const scaled = (attack: EnemyAttackDef, power: number): EnemyAttackDef => (power === 1 ? attack : { ...attack, power: Math.round(attack.power * power) });

/** The melee part (sweep or zone) of the move in play against `player`, at the fight's power. */
export function cardMelee(enemy: EnemyState, fight: CardFightDef, player: Vec2): { attack: EnemyAttackDef; touches: boolean } | null {
  const step = cardStep(fight, enemy);
  const melee = step ? patternMelee(enemy, step.pattern, player) : null;
  return melee ? { ...melee, attack: scaled(melee.attack, fight.power) } : null;
}

/** Announces card `index` (its name: `bossStance`) and starts its declaration; `outcome` says how the previous card ended. */
function declare(enemy: EnemyState, fight: CardFightDef, index: number, outcome: CardOutcome, events: GameEvent[]): EnemyState {
  const card = fight.cards[index]!;
  const ms = card.phase2 ? fight.phase2BreakMs : fight.breakMs;
  events.push({ type: 'bossStance', enemyId: enemy.id, stance: card.id });
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: 'declare', durationMs: ms });
  const hpFloor = enemy.maxHp * cardFloorShare(fight, index);
  const { aimPoint: _aim, chain: _chain, ...ai } = enemy.ai;
  const next = withBoss(enemy, { stance: card.id, card: index, cardMs: 0, hpFloor, comboIndex: 0, combosDone: 0, stanceMs: 0, stanceDamage: 0 });
  return withAi(next, { ...enterMode(ai, 'transform', ms), contact: 'none', attack: outcome });
}

/** Card `index` is over: its shots vanish, a timed-out segment is lost, and the next card is declared (or the boss falls). */
function endCard(state: WorldState, enemy: EnemyState, fight: CardFightDef, index: number, outcome: Exclude<CardOutcome, 'start'>, events: GameEvent[]): WorldState {
  events.push({ type: 'spellCardEnd', enemyId: enemy.id, card: fight.cards[index]!.id, outcome });
  const cleared = { ...state, projectiles: state.projectiles.filter((p) => p.owner !== 'enemy') };
  const hp = outcome === 'timeout' ? Math.min(enemy.hp, enemy.boss!.hpFloor ?? 0) : enemy.hp;
  if (hp <= 0) {
    events.push({ type: 'enemyDefeated', enemyId: enemy.id });
    return replaceEnemy(cleared, { ...enemy, hp: 0, alive: false });
  }
  const following = Math.min(index + 1, fight.cards.length - 1);
  return replaceEnemy(cleared, declare({ ...enemy, hp }, fight, following, outcome, events));
}

/** Every pattern a move fires: its own and its layers. */
const patternsOf = (step: CardStepDef): readonly DanmakuPattern[] => [step.pattern, ...(step.layers ?? [])];

/** Length of a move's attack window: the longest of its pattern and layers. */
export const stepAttackMs = (step: CardStepDef): number => Math.max(...patternsOf(step).map(patternAttackMs));

function startStep(state: WorldState, enemy: EnemyState, card: SpellCardDef, index: number, target: Vec2, events: GameEvent[]): EnemyState {
  const step = card.steps[index]!;
  const p = step.pattern;
  const pierce = (p.kind === 'sweep' || p.kind === 'zone') ? p.attack.pierceRoll === true : 'shot' in p && p.shot.pierceRoll === true;
  events.push({ type: 'enemyTelegraph', enemyId: enemy.id, attack: card.id, durationMs: step.telegraphMs, ...(pierce ? { pierceRoll: true as const } : {}) });
  const toPlayer = towardTarget(target, enemy);
  let attackDir = toPlayer;
  let aimPoint: Vec2 | undefined;
  if (p.kind === 'zone') aimPoint = p.at === 'self' ? enemy.pos : target;
  // Closing walls: the gap row is the one the player stands in now.
  if (p.kind === 'walls') aimPoint = vec(0, target.y);
  if (p.kind === 'lanes') {
    // The wall starts at the far end from the player and comes at them; the mark is the safe lane.
    attackDir = target.y > state.arena.height / 2 ? vec(0, 1) : vec(0, -1);
    aimPoint = vec(laneGapOf(p, state.arena.width, target.x, 0), attackDir.y > 0 ? 0 : state.arena.height);
  }
  const { aimPoint: _old, ...ai } = enemy.ai;
  const next = withBoss(enemy, { comboIndex: 0 });
  return { ...next, facing: toPlayer, ai: { ...enterMode(ai, 'telegraph', step.telegraphMs), attackDir, contact: 'none', attack: String(index), ...(aimPoint ? { aimPoint } : {}) } };
}

/** Fires part `index` of every pattern of the move that has one. */
function fireParts(state: WorldState, enemy: EnemyState, fight: CardFightDef, step: CardStepDef, before: number, now: number, target: Vec2): { state: WorldState; last: number | null } {
  let next = state;
  let last: number | null = null;
  for (const [i, p] of patternsOf(step).entries()) {
    const parts = patternParts(p);
    if (!parts) continue;
    const ks = before < 0 ? [0] : crossed(before, now, parts.every, parts.count);
    for (const k of ks) {
      next = firePattern(next, enemy, fight.maxShots, p, k, fight.power, target);
      if (i === 0) last = k;
    }
  }
  return { state: next, last };
}

/** One step of the moves of the card in play. */
function playCard(state: WorldState, start: EnemyState, fight: CardFightDef, card: SpellCardDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  let enemy = start;
  const ai = enemy.ai;
  const boss = enemy.boss!;
  const toPlayer = towardTarget(target, enemy);
  const step = cardStep(fight, enemy);
  switch (ai.mode) {
    case 'approach': {
      if (ai.cooldownMs <= 0) {
        enemy = startStep(state, enemy, card, boss.combosDone % card.steps.length, target, events);
        break;
      }
      // Rest: drift to keep its distance, circling a little.
      const dist = distance(enemy.pos, target);
      const radial = dist < fight.keepDistance - 30 ? scale(toPlayer, -1) : dist > fight.keepDistance + 60 ? toPlayer : vec(0, 0);
      const dir = normalize(add(radial, scale(perpendicular(toPlayer, ai.strafeSign), 0.6)));
      enemy = { ...moveEnemy(state, enemy, scale(dir, (fight.walkSpeed * ms) / 1000)), facing: toPlayer };
      break;
    }
    case 'telegraph': {
      if (!step) {
        enemy = withAi(enemy, enterMode(ai, 'approach'));
        break;
      }
      const p = step.pattern;
      if (p.kind === 'rings' || p.kind === 'spiral' || p.kind === 'sweep' || p.kind === 'fan') enemy = { ...enemy, facing: toPlayer, ai: { ...ai, attackDir: toPlayer } };
      // A mark on the player follows them, then holds still for the last `lockMs` (walk out of it).
      if (p.kind === 'zone' && p.at === 'target' && ai.modeDurationMs - ai.modeMs > p.lockMs) enemy = withAi(enemy, { ...enemy.ai, aimPoint: target });
      if (!modeOver(ai)) break;
      events.push({ type: 'enemyAttack', enemyId: enemy.id, attack: card.id });
      if (p.kind === 'zone' && p.at === 'target' && enemy.ai.aimPoint) enemy = { ...enemy, pos: confineCircle(state.arena, enemy.ai.aimPoint, enemy.radius) };
      enemy = withAi(enemy, { ...enterMode(enemy.ai, 'attack', stepAttackMs(step)), contact: 'none' });
      state = fireParts(state, enemy, fight, step, -1, 0, target).state;
      break;
    }
    case 'attack': {
      if (!step) {
        enemy = withAi(enemy, enterMode(ai, 'approach'));
        break;
      }
      const fired = fireParts(state, enemy, fight, step, ai.modeMs - ms, ai.modeMs, target);
      state = fired.state;
      if (fired.last !== null) enemy = withBoss(enemy, { comboIndex: fired.last });
      const melee = cardMelee(enemy, fight, state.player.pos);
      if (melee) {
        const hit = contactPlayer(state, enemy, melee.attack, melee.touches, events);
        state = hit.state;
        enemy = withAi(enemy, { ...enemy.ai, contact: hit.contact });
      }
      if (modeOver(ai)) {
        const p = step.pattern;
        if (p.kind === 'zone' && p.ring) {
          const from = enemy.ai.aimPoint ?? enemy.pos;
          for (const dir of ringDirections(toPlayer, p.ring.count, p.ring.gap, 0, 0)) state = shoot(state, enemy, fight.maxShots, p.ring.shot, dir, add(from, scale(dir, enemy.radius + p.ring.shot.radius)), fight.power);
        }
        enemy = withAi(withBoss(enemy, { combosDone: boss.combosDone + 1 }), { ...enterMode(enemy.ai, 'recover', step.recoverMs), contact: 'none' });
      }
      break;
    }
    case 'recover':
      if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: card.restMs, strafeSign: ai.strafeSign === 1 ? -1 : 1 });
      break;
    default:
      enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: card.restMs });
      break;
  }
  return replaceEnemy(state, enemy);
}

/** The boss already on card `index` (its segment full, the declaration starting): the dev `?card=N` and tests. */
export function atCard(enemy: EnemyState, fight: CardFightDef, index: number, events: GameEvent[] = []): EnemyState {
  const i = Math.max(0, Math.min(fight.cards.length - 1, Math.floor(index)));
  const hp = Math.max(1, enemy.maxHp * (i === 0 ? 1 : cardFloorShare(fight, i - 1)));
  return declare({ ...enemy, hp }, fight, i, 'start', events);
}

/** One step of a spell-card fight (host): the declaration, the card's clock and its end, then the card's moves. */
export function updateCardFight(state: WorldState, start: EnemyState, fight: CardFightDef, target: Vec2, ms: number, events: GameEvent[]): WorldState {
  if (!start.boss || fight.cards.length === 0) return state;
  let enemy = start;
  const ai = enemy.ai;
  if (ai.mode === 'idle') {
    if (distance(enemy.pos, target) <= fight.aggroRange) enemy = declare(enemy, fight, 0, 'start', events);
    return replaceEnemy(state, enemy);
  }
  const found = currentCard(fight, enemy.boss!);
  if (!found) return replaceEnemy(state, declare(enemy, fight, 0, 'start', events));
  if (ai.mode === 'transform') {
    if (modeOver(ai)) enemy = withAi(enemy, { ...enterMode(ai, 'approach'), cooldownMs: FIRST_MOVE_MS, contact: 'none' });
    return replaceEnemy(state, enemy);
  }
  const { card, index } = found;
  const cardMs = (enemy.boss!.cardMs ?? 0) + ms;
  enemy = withBoss(enemy, { cardMs, card: index });
  const floor = enemy.boss!.hpFloor ?? 0;
  const broken = !card.survival && enemy.hp <= floor;
  if (broken || cardMs >= card.timerMs) return endCard(state, enemy, fight, index, card.survival ? 'survived' : broken ? 'broken' : 'timeout', events);
  return playCard(state, enemy, fight, card, target, ms, events);
}

/**
 * Every peer, for its own player, after each step: follows the spell card
 * in play and whether the player was hurt during it; when the card ends
 * broken or survived (the declaration that follows says so in `ai.attack`,
 * or the boss fell) and the player was never hit, the card is captured: a
 * share of max HP back now and the coins at the end (core/coins.ts counts
 * `cardCaptured`). A timed-out card, or one whose end was not seen, gives
 * nothing.
 */
export function updateCapture(state: WorldState, events: GameEvent[]): WorldState {
  // Any hit counts, whatever slot or shield took it: a Disguise breaking is a hit too.
  const hurt = events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
  let capture = state.capture;
  let player = state.player;
  if (capture) {
    const watched = capture;
    const boss = state.enemies.find((e) => e.id === watched.enemyId);
    const declaring = boss?.alive === true && boss.ai.mode === 'transform';
    const over = !boss || !boss.alive || boss.boss?.stance !== watched.card || declaring;
    if (over) {
      // A boss that fell on a timed-out last card (a herald fading) seen in this step's events captures nothing.
      const fadedOut = events.some((e) => e.type === 'spellCardEnd' && e.enemyId === watched.enemyId && e.outcome === 'timeout');
      const outcome = !boss ? null : !boss.alive ? (fadedOut ? 'timeout' : 'broken') : declaring ? boss.ai.attack : null;
      const won = !watched.hit && !hurt && player.hp > 0 && (outcome === 'broken' || outcome === 'survived');
      if (won) {
        const heal = Math.min(player.maxHp - player.hp, Math.round(player.maxHp * CAPTURE.healShare));
        player = { ...player, hp: player.hp + heal };
        events.push({ type: 'cardCaptured', enemyId: watched.enemyId, card: watched.card, heal });
      }
      capture = undefined;
    } else if (hurt && !watched.hit) capture = { ...watched, hit: true };
  }
  if (!capture) {
    const boss = state.enemies.find((e) => e.alive && e.boss && cardInfo(e.boss.stance) && e.ai.mode !== 'transform' && e.ai.mode !== 'idle');
    if (boss) capture = { enemyId: boss.id, card: boss.boss!.stance as CardId, hit: hurt };
  }
  if (capture === state.capture && player === state.player) return state;
  const { capture: _old, ...rest } = state;
  return { ...rest, player, ...(capture ? { capture } : {}) };
}
