import { describe, expect, it } from 'vitest';
import { evaluate, failures, KNOWN_VIOLATIONS } from '../../src/sim/bands';
import { CI_SWEEP, runSweep } from '../../src/sim/sweep';

/**
 * The balance gate in CI (docs/gdd.md §9 "Arnés de balance"): the CI subset
 * of the sweep (every dungeon, easy and nightmare, perfect/average/masher
 * bots, solo, two seeds; about 10–15 s). Fairness invariants fail unless
 * recorded in `KNOWN_VIOLATIONS`; performance bands only warn. The full
 * sweep and its report are `npm run balance`.
 */
describe('balance gate (CI subset)', () => {
  it('no fairness invariant is broken beyond the known violations', () => {
    const checks = evaluate(runSweep(CI_SWEEP));
    expect(failures(checks)).toEqual([]);
    // Some bands are measured at all (a sweep that played nothing would pass vacuously).
    expect(checks.filter((c) => c.severity === 'fail').length).toBeGreaterThanOrEqual(CI_SWEEP.dungeons.length * CI_SWEEP.tiers.length * 6);
  }, 120_000);

  it('every known violation names a band that is a fairness invariant', () => {
    for (const k of KNOWN_VIOLATIONS) expect(['max-hit', 'telegraph-floor', 'choice-telegraph-floor', 'simultaneous-telegraphs', 'unseen-threats', 'blind-hits']).toContain(k.band);
  });
});
