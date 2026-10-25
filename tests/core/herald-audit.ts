import { expect } from 'vitest';
import type { Difficulty } from '../../src/data/difficulty';
import { HERALD_ARENA, HERALD_RADIUS } from '../../src/data/herald';
import { checkCard } from '../../src/core/herald/fairness';
import { generateBoss, originsOf } from '../../src/core/herald/generate';

const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/**
 * Seeds per shard: 80 by default (240 over the three shards, about 1500
 * cards, within the suite's time); a deep audit sets HERALD_AUDIT_SEEDS
 * (e.g. 800 for 2400 seeds). Anything unset, empty or not a positive
 * number is the default.
 */
export function auditSeedCount(): number {
  const raw = Number.parseInt(process.env.HERALD_AUDIT_SEEDS ?? '', 10);
  return Number.isFinite(raw) && raw > 0 && raw <= 5000 ? raw : 80;
}

/**
 * The fairness audit over many seeds (sharded over several test files so
 * they run in parallel): every card a generated herald can play, phase 1
 * and phase 2, re-checked from scratch with the same proof; none may fail.
 * Returns how many cards the generator threw away on the way (rejection
 * sampling at work).
 */
export function auditSeeds(from: number, count: number): { cards: number; rejected: number } {
  let cards = 0;
  let rejected = 0;
  const unfair: string[] = [];
  for (let s = from; s < from + count; s++) {
    const tier = TIERS[s % TIERS.length]!;
    const depth = 22 + (s % 9) * 10;
    const stats = { checked: 0, rejected: 0 };
    const def = generateBoss(s * 7919, depth, tier, stats);
    rejected += stats.rejected;
    const played = [
      ...def.cards.map((card) => ({ card, move: def.move })),
      ...def.phase2.cards.slice(def.phase2.fromCard).map((card) => ({ card, move: def.phase2.move })),
    ];
    for (const { card, move } of played) {
      cards++;
      const report = checkCard(card, { arena: HERALD_ARENA, origins: originsOf(def, move), bossRadius: HERALD_RADIUS, tier, maxShots: def.maxShots });
      if (!report.ok) unfair.push(`seed ${s * 7919} depth ${depth} ${tier} ${card.id}: ${report.failures.join('; ')}`);
      // The opening after an attack lasts until its shots are gone (the next cycle never overlaps them).
      if (card.attackMs + card.recoverMs < report.clearMs) unfair.push(`seed ${s * 7919} ${card.id}: next cycle overlaps its shots`);
    }
  }
  expect(unfair).toEqual([]);
  return { cards, rejected };
}
