import { describe, expect, it } from 'vitest';
import { cardGuard, isDeclaring } from '../../src/core/cards';
import { FIXED_DT_MS } from '../../src/core/timestep';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { vec } from '../../src/core/vec';
import { IDLE } from '../core/helpers';
import { cardWorld, fightIn, FRAME_MS, PROOF_CASES, replay, search, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * The liveness half of the beatability argument (docs/gdd.md "Garantía de
 * que todo se puede pasar"): if every card can be survived, the fight can be
 * won with zero damage dealt, because the framework guarantees that
 * - every card has a finite timer and ends when it runs out;
 * - a timed-out card loses its segment, and the last card timing out fells the boss;
 * - a survival card owns no HP (it ends only by its timer) and nothing hurts the boss during it;
 * - a declaration is an invulnerable break with no threat in the room;
 * so a fight lasts at most the sum of its timers and declarations.
 * These tests assert those invariants for every card boss on every card tier.
 */

const fights = PROOF_CASES.flatMap((p) => p.tiers.map((tier) => ({ c: p.case, tier })));
const bossOf = (s: WorldState, c: BossCase) => s.enemies.find((e) => e.species === c.species && e.boss)!;

function runFor(c: BossCase, state: WorldState, ms: number, each?: (s: WorldState, events: readonly GameEvent[]) => void): WorldState {
  let s = state;
  for (let i = 0; i < ms / FIXED_DT_MS; i++) {
    s = step({ ...s, player: { ...s.player, hp: s.player.maxHp } }, IDLE, FIXED_DT_MS);
    each?.(s, s.events);
    if (!bossOf(s, c).alive) break;
  }
  return s;
}

describe('liveness: the framework invariants that make survivability enough', () => {
  for (const { c, tier } of fights) {
    const label = `${c.label ?? c.species} ${tier}`;
    it(`${label}: every card has a finite timer, survival cards own no HP, and the whole fight is bounded`, () => {
      const f = fightIn(cardWorld(c, tier, 0), c.species)!;
      expect(f.cards.length).toBeGreaterThan(0);
      for (const card of f.cards) {
        expect(Number.isFinite(card.timerMs) && card.timerMs > 0, card.id).toBe(true);
        if (card.survival) expect(card.hpShare, card.id).toBe(0);
      }
      const bound = f.cards.reduce((sum, k) => sum + k.timerMs + Math.max(f.breakMs, f.phase2BreakMs), 0);
      expect(bound).toBeLessThan(10 * 60_000);
    });

    it(`${label}: declarations are invulnerable and threat-free; survival cards cannot be hurt; every timeout moves on, and the last one fells the boss`, () => {
      const f = fightIn(cardWorld(c, tier, 0), c.species)!;
      f.cards.forEach((card, index) => {
        let s = cardWorld(c, tier, index);
        // The declaration: guarded all round, no enemy shot, no hit, until the card starts.
        for (let i = 0; i < 4000 / FIXED_DT_MS && isDeclaring(bossOf(s, c)); i++) {
          expect(cardGuard(bossOf(s, c)), `${card.id} declaration guard`).toBe('all');
          expect(s.projectiles.filter((p) => p.owner === 'enemy'), `${card.id} shots while declaring`).toHaveLength(0);
          s = step(s, IDLE, FIXED_DT_MS);
          expect(s.events.some((e) => e.type === 'playerHurt'), `${card.id} hurt while declaring`).toBe(false);
        }
        expect(isDeclaring(bossOf(s, c)), `${card.id} declaration ends`).toBe(false);
        // Wait the card out, idle (the player unkillable).
        const hpAtStart = bossOf(s, c).hp;
        let ended: GameEvent | undefined;
        let guarded = true;
        s = runFor(c, s, card.timerMs + 1500, (x, events) => {
          ended ??= events.find((e) => e.type === 'spellCardEnd');
          if (card.survival && !ended && !isDeclaring(bossOf(x, c))) guarded &&= cardGuard(bossOf(x, c)) === 'all';
        });
        expect(ended, `${card.id} ends`).toMatchObject({ card: card.id, outcome: card.survival ? 'survived' : 'timeout' });
        if (card.survival) expect(guarded, `${card.id} survival guard`).toBe(true);
        const boss = bossOf(s, c);
        if (index === f.cards.length - 1) expect(boss.alive, `${card.id} last timeout fells it`).toBe(false);
        else {
          expect(boss.alive).toBe(true);
          expect(boss.hp, `${card.id} segment lost`).toBeLessThanOrEqual(card.survival ? hpAtStart : boss.maxHp * (1 - f.cards.slice(0, index + 1).reduce((a, k) => a + k.hpShare, 0) / f.cards.reduce((a, k) => a + k.hpShare, 0)) + 1e-6);
        }
      });
    }, 60_000);
  }
});

describe('the proof can fail', () => {
  it('a wall of shots with no gap has no walk-only witness; a gap gives one', () => {
    const wall = (gapAt: number | null): WorldState => {
      const s0 = cardWorld({ species: 'aegislash', room: 'boss' }, 'normal', 0, vec(400, 520));
      const w = s0.arena.width;
      const shots = Array.from({ length: Math.ceil(w / 14) }, (_, i) => i * 14 + 7)
        .filter((x) => gapAt === null || Math.abs(x - gapAt) > 45)
        .map((x, i) => ({ id: `wall${i}`, owner: 'enemy' as const, type: 'ghost' as const, attackerTypes: ['ghost' as const], power: 10, damageMultiplier: 1, pos: vec(x, 300), vel: vec(0, 120), radius: 6, remainingMs: 8000, hitstunMs: 0, knockback: 0, hitIds: [] }));
      // The boss stays declaring (no shots of its own), the wall is the only threat.
      const boss = { ...bossOf(s0, { species: 'aegislash', room: 'boss' }) };
      return { ...s0, enemies: [{ ...boss, ai: { ...boss.ai, modeDurationMs: 1e9 } }], projectiles: shots, arena: { ...s0.arena, obstacles: [] } };
    };
    // The wall reaches the player in under 2 s; surviving 4 s means it went past.
    const opts = { species: 'aegislash' as const, mode: 'survive' as const, done: (s: WorldState) => s.timeMs >= 4000, maxMs: 5000 };
    expect(search(wall(null), opts, [24]).ok).toBe(false);
    const through = search(wall(400), opts, [24]);
    expect(through.ok).toBe(true);
    // And the witness it found is checked by replaying it: the same moves, no hit.
    expect(replay(wall(400), through.moves, opts).hitAt).toBeNull();
    // A witness for one wall does not carry over to the other.
    expect(replay(wall(null), through.moves, opts).hitAt).not.toBeNull();
    // A search: seconds alone, longer beside the whole suite.
  }, 60_000);

  it('standing still is not a witness for a real card (the replay finds the hit)', () => {
    const c = { species: 'lanturn' as const, room: 'grotto' as const };
    const start = startsOf(c)[0]!;
    const s0 = cardWorld(c, 'nightmare', 0, start);
    expect(replay(s0, '0'.repeat(Math.ceil(35_000 / FRAME_MS)), { species: c.species, mode: 'survive' }).hitAt).not.toBeNull();
  });
});
