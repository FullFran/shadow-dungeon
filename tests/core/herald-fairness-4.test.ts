import { describe, expect, it } from 'vitest';
import { auditSeeds, auditSeedCount } from './herald-audit';

const SEEDS = auditSeedCount();

/** Shard 4 of the herald fairness audit (80 seeds each, 480 in all, about 3000 cards; HERALD_AUDIT_SEEDS raises it): no unfair card survives generation. */
describe('herald fairness audit, shard 4', () => {
  it('every generated card passes the proof again', () => {
    const { cards, rejected } = auditSeeds(1 + 4 * SEEDS, SEEDS);
    expect(cards).toBeGreaterThan(SEEDS * 3);
    // The rejection sampling is at work: some drawn cards were thrown away.
    expect(rejected).toBeGreaterThan(0);
  }, 240_000);
});
