import { describe, expect, it } from 'vitest';
import { auditSeeds, auditSeedCount } from './herald-audit';

const SEEDS = auditSeedCount();

/** Shard 2 of the herald fairness audit (80 seeds each, 240 in all, about 1500 cards; HERALD_AUDIT_SEEDS raises it): no unfair card survives generation. */
describe('herald fairness audit, shard 2', () => {
  it('every generated card passes the proof again', () => {
    const { cards, rejected } = auditSeeds(1 + 2 * SEEDS, SEEDS);
    expect(cards).toBeGreaterThan(SEEDS * 3);
    // The rejection sampling is at work: some drawn cards were thrown away.
    expect(rejected).toBeGreaterThan(0);
  }, 240_000);
});
