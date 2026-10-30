import { describe, expect, it } from 'vitest';
import type { WorldState } from '../../src/core/state';
import { evaluate, failures, type KnownViolation } from '../../src/sim/bands';
import type { FloorResult, Scenario } from '../../src/sim/runner';
import { runFloor } from '../../src/sim/runner';
import { CI_SWEEP, type SweepResults } from '../../src/sim/sweep';

const scenario: Scenario = { dungeon: 'crypt-of-the-sword-king', tier: 'easy', bot: 'perfect', party: 1, seed: 1 };

/** A clean arena result to tweak. */
const floor = (patch: Partial<FloorResult> = {}): FloorResult => ({
  floor: 6,
  kind: 'room',
  boss: 'aegislash',
  items: 0,
  outcome: 'cleared',
  timeMs: 60_000,
  damage: 10,
  hpStart: 100,
  hpEnd: 90,
  maxHp: 100,
  hits: 1,
  hitsPierce: 0,
  maxHitShare: 0.1,
  kills: 1,
  enemyTtkMs: [60_000],
  bossTtkMs: 60_000,
  telegraphMs: [500],
  choiceTelegraphMs: [600],
  maxSimultaneousTelegraphs: 1,
  unseenAttacks: 0,
  maxSimultaneousUnseen: 0,
  untelegraphedAttacks: 0,
  blindHits: 0,
  ...patch,
});

const sweepOf = (result: FloorResult, s: Scenario = scenario): SweepResults => ({ config: CI_SWEEP, runs: [], arenas: [{ scenario: s, result }] });

/**
 * The planted unwinnable pattern: every 300 ms a positional enemy burst lands
 * right on the player with no wind-up at all. No player can avoid it, so the
 * perfect bot must die and the fairness gate must fail. Without this test the
 * gate could pass because it checks nothing.
 */
const planted = (world: WorldState): WorldState =>
  world.tick % 18 !== 0
    ? world
    : {
        ...world,
        projectiles: [
          ...world.projectiles,
          {
            id: `planted${world.tick}`,
            owner: 'enemy',
            type: 'dark',
            attackerTypes: ['dark'],
            power: 60,
            damageMultiplier: 1,
            pos: world.player.pos,
            vel: { x: 0, y: 0 },
            radius: 40,
            remainingMs: 120,
            hitstunMs: 0,
            knockback: 0,
            hitIds: [],
            pierceRoll: true,
          },
        ],
      };

describe('balance bands', () => {
  it('a clean arena passes every band it is measured by', () => {
    const checks = evaluate(sweepOf(floor()), []);
    expect(failures(checks)).toEqual([]);
    expect(checks.filter((c) => c.severity === 'fail').map((c) => c.band)).toEqual(['max-hit', 'telegraph-floor', 'choice-telegraph-floor', 'simultaneous-telegraphs', 'unseen-threats', 'blind-hits']);
  });

  it('each fairness invariant fails on its own violation (telegraph floors allow one tick of slack)', () => {
    const failing = (patch: Partial<FloorResult>) => failures(evaluate(sweepOf(floor(patch)), [])).map((c) => c.band);
    expect(failing({ maxHitShare: 0.36 })).toEqual(['max-hit']);
    expect(failing({ telegraphMs: [250] })).toEqual(['telegraph-floor']);
    expect(failing({ telegraphMs: [267] })).toEqual([]);
    expect(failing({ choiceTelegraphMs: [350] })).toEqual(['choice-telegraph-floor']);
    expect(failing({ maxSimultaneousTelegraphs: 3 })).toEqual(['simultaneous-telegraphs']);
    expect(failures(evaluate(sweepOf(floor({ maxSimultaneousTelegraphs: 3 }), { ...scenario, tier: 'nightmare' }), []))).toEqual([]);
    expect(failing({ maxSimultaneousUnseen: 2 })).toEqual(['unseen-threats']);
    expect(failing({ blindHits: 1 })).toEqual(['blind-hits']);
  });

  it('a known violation is reported as a warning with its reason, and only for its dungeon', () => {
    const known: KnownViolation[] = [{ band: 'max-hit', dungeon: 'crypt-of-the-sword-king', reason: 'test' }];
    const crypt = evaluate(sweepOf(floor({ maxHitShare: 0.5 })), known).find((c) => c.band === 'max-hit')!;
    expect(crypt).toMatchObject({ status: 'warn', known: 'test' });
    const forest = evaluate(sweepOf(floor({ maxHitShare: 0.5 }), { ...scenario, dungeon: 'misty-forest' }), known).find((c) => c.band === 'max-hit')!;
    expect(forest.status).toBe('fail');
  });

  it('the planted unwinnable pattern kills the perfect bot and fails the gate', () => {
    const result = runFloor(scenario, 1, { inject: planted, floorTimeoutMs: 60_000 });
    expect(result.outcome).toBe('died');
    expect(result.blindHits).toBeGreaterThan(0);
    expect(result.hitsPierce).toBe(result.hits);
    const checks = evaluate(sweepOf(result), []);
    expect(failures(checks).map((c) => c.band)).toContain('blind-hits');
    expect(checks.find((c) => c.band === 'perfect-never-dies')).toMatchObject({ status: 'warn' });
    // The same floor without the planted pattern: the perfect bot lives and no hit comes unannounced.
    const fair = runFloor(scenario, 1, { floorTimeoutMs: 60_000 });
    expect(fair.outcome).not.toBe('died');
    expect(fair.blindHits).toBe(0);
    expect(failures(evaluate(sweepOf(fair), [])).map((c) => c.band)).not.toContain('blind-hits');
  });
});
