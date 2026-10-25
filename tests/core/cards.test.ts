import { describe, expect, it } from 'vitest';
import { CAPTURE, cardInfo, registerCards, type CardFightDef } from '../../src/data/cards';
import { spellCardKey } from '../../src/data/enemies';
import { blocksHit } from '../../src/core/boss';
import { cardFloors, cardFloorShare, cardGuard, cardHpFloor, cardStep, FIRST_MOVE_MS, updateCapture, updateCardFight } from '../../src/core/cards';
import { coinBreakdown, emptyTally, tallyStep } from '../../src/core/coins';
import { loadRoom } from '../../src/core/rooms';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { applyHitClaims } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';

const SHOT = { power: 10, type: 'ghost' as const, speed: 100, radius: 6, lifetimeMs: 3000 };

/** A small fight for the engine alone: two HP cards around a survival card. */
const FIGHT: CardFightDef = registerCards({
  aggroRange: 900,
  breakMs: 600,
  phase2BreakMs: 1200,
  maxShots: 60,
  walkSpeed: 40,
  keepDistance: 150,
  power: 1,
  cards: [
    { id: 'sc-test-rings', nameKey: 'spell.test.rings', hpShare: 0.6, timerMs: 8000, guard: 'front', restMs: 500, steps: [{ telegraphMs: 500, recoverMs: 400, pattern: { kind: 'rings', rings: 2, perRing: 12, gap: 3, gapTurnDeg: 30, gapMs: 300, shot: SHOT } }] },
    { id: 'sc-test-survive', nameKey: 'spell.test.survive', hpShare: 0, timerMs: 3000, survival: true, restMs: 300, steps: [{ telegraphMs: 500, recoverMs: 300, pattern: { kind: 'spiral', arms: 3, everyMs: 150, durationMs: 1200, turnDegPerShot: 12, shot: SHOT } }] },
    { id: 'sc-test-last', nameKey: 'spell.test.last', hpShare: 0.4, timerMs: 6000, lastSpell: true, phase2: true, restMs: 400, steps: [{ telegraphMs: 500, recoverMs: 400, pattern: { kind: 'rings', rings: 1, perRing: 16, gap: 4, gapTurnDeg: 0, gapMs: 300, shot: SHOT } }] },
  ],
});

function throne(): WorldState {
  const state = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), 'boss');
  return { ...state, player: { ...state.player, pos: vec(400, 540), disguiseBroken: true } };
}

const bossOf = (state: WorldState): EnemyState => state.enemies[0]!;

/** Runs the engine alone for `ticks` steps against a still player, collecting events. */
function play(state: WorldState, ticks: number, until?: (s: WorldState) => boolean) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks && !(until && until(current)); i++) {
    const enemy = bossOf(current);
    if (!enemy.alive) break;
    const ai = { ...enemy.ai, modeMs: enemy.ai.modeMs + FIXED_DT_MS, cooldownMs: Math.max(0, enemy.ai.cooldownMs - FIXED_DT_MS) };
    current = updateCardFight(current, { ...enemy, ai }, FIGHT, current.player.pos, FIXED_DT_MS, events);
  }
  return { state: current, events };
}

const withHp = (state: WorldState, hp: number): WorldState => ({ ...state, enemies: state.enemies.map((e, i) => (i === 0 ? { ...e, hp } : e)) });

describe('spell cards: segments', () => {
  it('splits the HP by the cards\' shares; a survival card owns none', () => {
    expect(cardFloors(FIGHT)).toEqual([0.4, 0.4, 0]);
    expect(cardFloorShare(FIGHT, 0)).toBeCloseTo(0.4);
  });

  it('names every card from its id alone (banner and guard on any peer)', () => {
    expect(cardInfo('sc-test-rings')).toEqual({ nameKey: 'spell.test.rings', guard: 'front' });
    expect(cardInfo('sc-test-survive')?.survival).toBe(true);
    expect(spellCardKey('aegislash', 'sc-test-last')).toBe('spell.test.last');
    expect(cardInfo('shield')).toBeUndefined();
  });
});

describe('spell cards: sequencing', () => {
  it('declares card 0 when the target comes near: invulnerable, then its moves', () => {
    const { state, events } = play(throne(), 1);
    const boss = bossOf(state);
    expect(boss.boss!.stance).toBe('sc-test-rings');
    expect(boss.ai.mode).toBe('transform');
    expect(boss.ai.attack).toBe('start');
    expect(events).toContainEqual({ type: 'bossStance', enemyId: boss.id, stance: 'sc-test-rings' });
    expect(cardHpFloor(boss)).toBeCloseTo(boss.maxHp * 0.4);
    // Declaring: every hit is blocked, whatever the side.
    expect(cardGuard(boss)).toBe('all');
    expect(blocksHit(boss, vec(boss.pos.x, boss.pos.y + 100))).toBe(true);
    expect(blocksHit(boss, vec(boss.pos.x, boss.pos.y - 100))).toBe(true);
    // After the declaration and the first pause, the card's move winds up.
    const later = play(state, Math.ceil((FIGHT.breakMs + FIRST_MOVE_MS) / FIXED_DT_MS) + 2).state;
    expect(bossOf(later).ai.mode).toBe('telegraph');
    expect(cardStep(FIGHT, bossOf(later))?.pattern.kind).toBe('rings');
    // A Shield card guards its front only.
    const b = bossOf(later);
    expect(cardGuard(b)).toBe('front');
    expect(blocksHit(b, vec(b.pos.x + b.facing.x * 80, b.pos.y + b.facing.y * 80))).toBe(true);
    expect(blocksHit(b, vec(b.pos.x - b.facing.x * 80, b.pos.y - b.facing.y * 80))).toBe(false);
  });

  it('ends a card once its segment is empty: shots cleared, the next card declared as broken', () => {
    let state = play(throne(), 110).state;
    expect(state.projectiles.some((p) => p.owner === 'enemy')).toBe(true);
    const boss = bossOf(state);
    state = withHp(state, boss.boss!.hpFloor!);
    const { state: next, events } = play(state, 1);
    expect(events).toContainEqual({ type: 'spellCardEnd', enemyId: boss.id, card: 'sc-test-rings', outcome: 'broken' });
    expect(next.projectiles.filter((p) => p.owner === 'enemy')).toEqual([]);
    expect(bossOf(next).boss!.stance).toBe('sc-test-survive');
    expect(bossOf(next).ai).toMatchObject({ mode: 'transform', attack: 'broken' });
  });

  it('times a card out: the rest of its segment is lost and nothing is captured', () => {
    const start = play(throne(), 1).state;
    const { state, events } = play(start, Math.ceil((FIGHT.breakMs + 8000) / FIXED_DT_MS) + 5, (s) => bossOf(s).boss!.stance !== 'sc-test-rings');
    const boss = bossOf(state);
    expect(events.some((e) => e.type === 'spellCardEnd' && e.outcome === 'timeout')).toBe(true);
    expect(boss.hp).toBeCloseTo(boss.maxHp * 0.4);
    expect(boss.ai.attack).toBe('timeout');
  });

  it('a survival card takes no damage and ends with its timer; the phase-2 card declares for longer', () => {
    let state = play(throne(), 1).state;
    state = withHp(state, bossOf(state).boss!.hpFloor!);
    state = play(state, Math.ceil((2 * FIGHT.breakMs) / FIXED_DT_MS) + 20).state;
    const boss = bossOf(state);
    expect(boss.boss!.stance).toBe('sc-test-survive');
    expect(boss.ai.mode).not.toBe('transform');
    expect(cardGuard(boss)).toBe('all');
    expect(blocksHit(boss, vec(boss.pos.x - boss.facing.x * 80, boss.pos.y - boss.facing.y * 80))).toBe(true);
    const { state: after, events } = play(state, Math.ceil(3000 / FIXED_DT_MS) + 5, (s) => bossOf(s).boss!.stance === 'sc-test-last');
    expect(events.some((e) => e.type === 'spellCardEnd' && e.card === 'sc-test-survive' && e.outcome === 'survived')).toBe(true);
    expect(events).toContainEqual({ type: 'enemyTelegraph', enemyId: boss.id, attack: 'declare', durationMs: FIGHT.phase2BreakMs });
    expect(bossOf(after).hp).toBeCloseTo(boss.hp);
  });

  it('the last card timing out is the boss\'s end', () => {
    let state = play(throne(), 1).state;
    const boss = bossOf(state);
    state = { ...state, enemies: [{ ...boss, hp: boss.maxHp * 0.3, boss: { ...boss.boss!, stance: 'sc-test-last', card: 2, hpFloor: 0 } }] };
    const { state: end, events } = play(state, Math.ceil((FIGHT.phase2BreakMs + 6000) / FIXED_DT_MS) + 10);
    expect(bossOf(end).alive).toBe(false);
    expect(events.some((e) => e.type === 'enemyDefeated')).toBe(true);
  });

  it('a hit never takes the boss below the floor of the card in play (host claims too)', () => {
    const state = play(throne(), 1).state;
    const boss = bossOf(state);
    const struck = applyHitClaims({ ...state, role: 'host' }, [{ id: 'c1', playerId: 'g', enemyId: boss.id, damage: boss.maxHp, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false }]);
    expect(bossOf(struck).hp).toBeCloseTo(boss.boss!.hpFloor!);
    expect(bossOf(struck).alive).toBe(true);
  });
});

describe('spell cards: capture', () => {
  /** A boss on `card` in `mode` (and `attack` for a declaration). */
  const at = (state: WorldState, stance: 'sc-test-rings' | 'sc-test-survive' | 'sc-test-last', mode: EnemyState['ai']['mode'], attack?: string): WorldState => ({
    ...state,
    enemies: state.enemies.map((e) => ({ ...e, boss: { ...e.boss!, stance }, ai: { ...e.ai, mode, ...(attack ? { attack } : {}) } })),
  });
  const hurt: GameEvent = { type: 'playerHurt', damage: 10 };

  it('captures a card broken without a hit: a heal and the event (coins at the end)', () => {
    let state = throne();
    state = { ...state, player: { ...state.player, hp: 50 } };
    state = updateCapture(at(state, 'sc-test-rings', 'telegraph'), []);
    expect(state.capture).toEqual({ enemyId: bossOf(state).id, card: 'sc-test-rings', hit: false });
    const events: GameEvent[] = [];
    state = updateCapture(at(state, 'sc-test-survive', 'transform', 'broken'), events);
    const heal = Math.round(state.player.maxHp * CAPTURE.healShare);
    expect(events).toEqual([{ type: 'cardCaptured', enemyId: bossOf(state).id, card: 'sc-test-rings', heal }]);
    expect(state.player.hp).toBe(50 + heal);
    expect(state.capture).toBeUndefined();
  });

  it('a hit during the card, or a timeout, gives nothing', () => {
    let state = updateCapture(at(throne(), 'sc-test-rings', 'attack'), []);
    state = updateCapture(state, [hurt]);
    expect(state.capture?.hit).toBe(true);
    const events: GameEvent[] = [];
    updateCapture(at(state, 'sc-test-survive', 'transform', 'broken'), events);
    expect(events).toEqual([]);
    const clean = updateCapture(at(throne(), 'sc-test-rings', 'attack'), []);
    updateCapture(at(clean, 'sc-test-survive', 'transform', 'timeout'), events);
    expect(events).toEqual([]);
  });

  it('a survived survival card and the boss falling both count; nothing happens without a card fight', () => {
    const events: GameEvent[] = [];
    const survived = updateCapture(at(throne(), 'sc-test-survive', 'attack'), []);
    updateCapture(at(survived, 'sc-test-last', 'transform', 'survived'), events);
    const last = updateCapture(at(throne(), 'sc-test-last', 'attack'), []);
    updateCapture({ ...last, enemies: last.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) }, events);
    expect(events.map((e) => e.type === 'cardCaptured' && e.card)).toEqual(['sc-test-survive', 'sc-test-last']);
    const plain = throne();
    expect(updateCapture(plain, [hurt])).toBe(plain);
  });

  it('every capture pays CAPTURE.coins on the end screen', () => {
    const tally = tallyStep(emptyTally(), { credited: [] }, { credited: [], depth: 6, events: [{ type: 'cardCaptured', enemyId: 'e', card: 'sc-test-rings', heal: 0 }] }, 0);
    expect(tally.captures).toBe(1);
    expect(coinBreakdown(tally, 'defeat').guardian).toBe(CAPTURE.coins);
    expect(coinBreakdown(emptyTally(), 'defeat').guardian).toBe(0);
  });
});

