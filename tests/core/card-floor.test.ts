import { describe, expect, it } from 'vitest';
import { CARD_FLOOR, registerCards, type CardFightDef } from '../../src/data/cards';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { cardHolds, cardHpFloor, HOLD_HP, holdFloor, isDeclaring, updateCardFight } from '../../src/core/cards';
import { loadRoom } from '../../src/core/rooms';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { applyHitClaims, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import type { Difficulty } from '../../src/data/difficulty';

/**
 * The card floor (data/cards.ts `CARD_FLOOR`, odd/tasks/type-balance.md):
 * no spell card can be broken before its tier's share of its timer, however
 * hard the player hits; the floor never makes a card outlast its timer, and
 * survival cards and last spells keep their rules.
 */

const SHOT = { power: 10, type: 'ghost' as const, speed: 100, radius: 6, lifetimeMs: 3000 };
const RINGS = [{ telegraphMs: 500, recoverMs: 400, pattern: { kind: 'rings' as const, rings: 1, perRing: 8, gap: 3, gapTurnDeg: 0, gapMs: 300, shot: SHOT } }];

const FIGHT: CardFightDef = registerCards({
  aggroRange: 900,
  breakMs: 600,
  phase2BreakMs: 600,
  maxShots: 60,
  walkSpeed: 40,
  keepDistance: 150,
  power: 1,
  cards: [
    { id: 'sc-floor-a', nameKey: 'spell.test.rings', hpShare: 0.6, timerMs: 8000, restMs: 500, steps: RINGS },
    { id: 'sc-floor-survive', nameKey: 'spell.test.survive', hpShare: 0, timerMs: 3000, survival: true, restMs: 300, steps: RINGS },
    { id: 'sc-floor-last', nameKey: 'spell.test.last', hpShare: 0.4, timerMs: 6000, lastSpell: true, restMs: 400, steps: RINGS },
  ],
});

function arena(tier: Difficulty): WorldState {
  const state = loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: tier }), 'boss');
  return { ...state, player: { ...state.player, pos: vec(400, 540), disguiseBroken: true } };
}

const bossOf = (state: WorldState): EnemyState => state.enemies[0]!;

interface CardEnd {
  card: string;
  outcome: string;
  cardMs: number;
}

/**
 * Runs the fight with a hit of `damage` landing every tick the boss can be
 * hurt (a host applying a claim: the clamp every hit path shares), until the
 * boss falls. Returns how and when (card clock) every card ended.
 */
function slug(tier: Difficulty, damage: number, maxTicks = 4000): { ends: CardEnd[]; events: GameEvent[]; fell: number | null } {
  let state = arena(tier);
  const events: GameEvent[] = [];
  const ends: CardEnd[] = [];
  let fell: number | null = null;
  for (let i = 0; i < maxTicks; i++) {
    const enemy = bossOf(state);
    if (!enemy.alive) break;
    const ai = { ...enemy.ai, modeMs: enemy.ai.modeMs + FIXED_DT_MS, cooldownMs: Math.max(0, enemy.ai.cooldownMs - FIXED_DT_MS) };
    const before = bossOf(state).boss?.cardMs ?? 0;
    const step: GameEvent[] = [];
    state = updateCardFight({ ...state, events: [] }, { ...enemy, ai }, FIGHT, state.player.pos, FIXED_DT_MS, step);
    for (const e of step) if (e.type === 'spellCardEnd') ends.push({ card: e.card, outcome: e.outcome, cardMs: before + FIXED_DT_MS });
    events.push(...step);
    const boss = bossOf(state);
    const info = FIGHT.cards[boss.boss?.card ?? 0];
    if (boss.alive && !isDeclaring(boss) && boss.ai.mode !== 'idle' && !info?.survival && damage > 0) {
      const claim = { id: `t${i}`, playerId: 'p2', enemyId: boss.id, damage, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false };
      state = applyHitClaims({ ...state, events: [] }, [claim]);
      events.push(...state.events);
      if (!bossOf(state).alive) fell = bossOf(state).boss?.cardMs ?? 0;
    }
  }
  return { ends, events, fell };
}

describe('card floor: data', () => {
  it('has a share for every tier, none on Easy, never half a timer or more', () => {
    for (const tier of DIFFICULTIES) {
      expect(CARD_FLOOR[tier]).toBeGreaterThanOrEqual(0);
      expect(CARD_FLOOR[tier]).toBeLessThan(0.5);
    }
    expect(CARD_FLOOR.easy).toBe(0);
    expect(CARD_FLOOR.nightmare).toBeGreaterThan(0);
  });

  it('keeps the segment\'s last HP until share x timer, then lets it go', () => {
    expect(holdFloor(100, 40, 0, 8000, 0.35)).toBe(40 + HOLD_HP);
    expect(holdFloor(100, 40, 2799, 8000, 0.35)).toBe(40 + HOLD_HP);
    expect(holdFloor(100, 40, 2800, 8000, 0.35)).toBe(40);
    expect(holdFloor(40.5, 40, 0, 8000, 0.35)).toBe(40.5);
    expect(holdFloor(100, 40, 5000, 8000, 0.35)).toBe(40);
    expect(holdFloor(100, 40, 0, 8000, 0)).toBe(40);
  });
});

describe('card floor: no card ends before its floor', () => {
  for (const tier of ['normal', 'hard', 'nightmare'] as const) {
    it(`${tier}: an overwhelming hit every tick breaks each card at its floor, not before; survival and last spell keep their rules`, () => {
      const share = CARD_FLOOR[tier];
      const { ends, fell, events } = slug(tier, 1e6);
      const first = ends.find((e) => e.card === 'sc-floor-a')!;
      expect(first.outcome).toBe('broken');
      expect(first.cardMs).toBeGreaterThanOrEqual(share * 8000);
      expect(first.cardMs).toBeLessThanOrEqual(share * 8000 + 3 * FIXED_DT_MS);
      // The survival card still lasts its whole timer and is survived.
      const survival = ends.find((e) => e.card === 'sc-floor-survive')!;
      expect(survival.outcome).toBe('survived');
      expect(survival.cardMs).toBeGreaterThanOrEqual(3000);
      // The last spell: the boss falls, never before the floor.
      expect(fell).not.toBeNull();
      expect(fell!).toBeGreaterThanOrEqual(share * 6000);
      expect(fell!).toBeLessThanOrEqual(share * 6000 + 3 * FIXED_DT_MS);
      // The player is told why the hits stopped landing.
      expect(events.some((e) => e.type === 'cardHold')).toBe(true);
    });
  }

  it('easy: no floor, a card breaks on the first hit that empties its segment', () => {
    const { ends, events } = slug('easy', 1e6);
    expect(ends.find((e) => e.card === 'sc-floor-a')!.cardMs).toBeLessThan(200);
    expect(events.some((e) => e.type === 'cardHold')).toBe(false);
  });

  it('never makes a card outlast its timer: without damage every card times out on time', () => {
    const { ends } = slug('nightmare', 0);
    const first = ends.find((e) => e.card === 'sc-floor-a')!;
    expect(first.outcome).toBe('timeout');
    expect(first.cardMs).toBeGreaterThanOrEqual(8000);
    expect(first.cardMs).toBeLessThanOrEqual(8000 + FIXED_DT_MS);
  });

  it('a player who would not empty the segment before the floor never meets it: every hit lands whole', () => {
    // 1 HP per tick for 10 s: under the 0.6-share segment, so the card ends after its floor anyway.
    const { events } = slug('nightmare', 1, 600);
    expect(events.some((e) => e.type === 'cardHold')).toBe(false);
  });

  it('the hold is the host\'s clamp and reaches guests through the snapshot', () => {
    let state = arena('nightmare');
    // Into card 0's play, then pinned on its hold.
    for (let i = 0; i < 200 && (isDeclaring(bossOf(state)) || bossOf(state).ai.mode === 'idle' || (bossOf(state).boss?.cardMs ?? 0) < 1000); i++) {
      const enemy = bossOf(state);
      state = updateCardFight(state, { ...enemy, ai: { ...enemy.ai, modeMs: enemy.ai.modeMs + FIXED_DT_MS, cooldownMs: Math.max(0, enemy.ai.cooldownMs - FIXED_DT_MS) } }, FIGHT, state.player.pos, FIXED_DT_MS, []);
    }
    const boss = bossOf(state);
    const pace = boss.boss!.holdFloor!;
    expect(pace).toBe(boss.boss!.hpFloor! + HOLD_HP);
    expect(cardHpFloor(boss)).toBe(pace);
    expect(cardHolds(boss, boss.hp - pace + 5)).toBe(true);
    expect(cardHolds(boss, 1)).toBe(false);
    const pinned = { ...state, enemies: [{ ...boss, hp: pace }] };
    const next = updateCardFight(pinned, bossOf(pinned), FIGHT, state.player.pos, FIXED_DT_MS, []);
    expect(bossOf(next).boss!.held).toBe(true);
    expect(hostSnapshot(next).enemies[0]!.boss!.held).toBe(true);
  });
});
