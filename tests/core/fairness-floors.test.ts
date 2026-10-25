import { describe, expect, it } from 'vitest';
import { CHOICE_TELEGRAPH_FLOOR_MS, DIFFICULTIES, ELITE_TRAIT_DEFS, MAX_HIT_SHARE, TELEGRAPH_FLOOR, type Difficulty, type EliteTrait } from '../../src/data/difficulty';
import { POOCHYENA } from '../../src/data/enemies';
import { effectiveTelegraphMs, tickAiAt } from '../../src/core/difficulty';
import { initialAi } from '../../src/core/enemies';
import { landHitOnPlayer } from '../../src/core/hits';
import type { AiState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input } from './helpers';
import { CAVES, CRYPT, DUNGEONS, ECLIPSE, floorsOf, planAt, type DungeonDef } from '../../src/data/dungeons';
import { PROGRESSION } from '../../src/data/progression';
import { SPECIES } from '../../src/data/species';
import { expectedFloorXp, expectedLevel, hitCap, referenceMaxHp, speciesMaxHpAt } from '../../src/core/fairness';
import { enemyXp, levelForXp, MAX_LEVEL } from '../../src/core/progression';
import { startRun } from '../../src/core/run';
import { BANDS } from '../../src/sim/bands';

/**
 * The two global fairness rules of docs/souls-difficulty-research.md P5, as
 * the balance harness (src/sim/bands.ts) measures them: no single enemy hit
 * takes more than `MAX_HIT_SHARE` of the max HP a player of the floor's
 * expected level would have (not the victim's own: an under-levelled player
 * can be one-shot), and no wind-up is shorter than its floor after every
 * speed modifier.
 */

const world = (d: Difficulty, extra: Partial<WorldState> = {}): WorldState => {
  const base = createWorld({ seed: 3, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), difficulty: d });
  return { ...base, ...extra, player: { ...base.player, disguiseBroken: true } };
};

/** HP a hit of raw `damage` takes from `w`'s player. */
const hurt = (w: WorldState, damage: number): number => w.player.hp - landHitOnPlayer(w, { damage }, []).state.player.hp;

/** `w` with its player at `level` of the curve (max HP and HP full). */
const atLevel = (w: WorldState, level: number): WorldState => {
  const maxHp = speciesMaxHpAt(w.player.species, level);
  return { ...w, player: { ...w.player, level, maxHp, hp: maxHp } };
};

describe('reference max HP (the yardstick of the one-hit cap)', () => {
  it('is the species at the level expected from clearing the floors before', () => {
    expect(expectedLevel(CRYPT.id, 1, 'easy')).toBe(1);
    for (const d of DUNGEONS) {
      let previous = 1;
      for (let f = 1; f <= Math.min(10, floorsOf(d)); f++) {
        const level = expectedLevel(d.id, f, 'nightmare');
        expect(level, `${d.id} F${f}`).toBeGreaterThanOrEqual(previous);
        expect(level).toBeLessThanOrEqual(MAX_LEVEL);
        previous = level;
      }
      // Deep floors expect a levelled player.
      expect(expectedLevel(d.id, Math.min(5, floorsOf(d)), 'nightmare')).toBeGreaterThan(1);
    }
    expect(referenceMaxHp(CRYPT.id, 1, 'easy', 'mimikyu')).toBe(SPECIES.mimikyu.maxHp);
    const level = expectedLevel(CRYPT.id, 4, 'normal');
    expect(referenceMaxHp(CRYPT.id, 4, 'normal', 'zorua')).toBe(SPECIES.zorua.maxHp + PROGRESSION.hpPerLevel * (level - 1));
  });

  it('is a pure function of the data: the same on every call and every peer', () => {
    expect(expectedLevel(ECLIPSE.id, 9, 'hard')).toBe(expectedLevel(ECLIPSE.id, 9, 'hard'));
    expect(expectedFloorXp(ECLIPSE.id, 3, 'hard')).toBe(expectedFloorXp(ECLIPSE.id, 3, 'hard'));
  });

  it('a run sets it on every floor it enters', () => {
    const { world: w } = startRun(1, { difficulty: 'nightmare' }, 4, CAVES.id);
    expect(w.referenceLevel).toBe(expectedLevel(CAVES.id, 4, 'nightmare'));
  });
});

/**
 * Meaningful encounters (odd/tasks/integrate-encounters.md) changed how many
 * enemies a floor holds, the experience per role and the leader's bonus; the
 * yardstick must read the same spawns and the same experience rule as a run.
 */
describe('reference level after meaningful encounters', () => {
  const lastFloor = (d: DungeonDef): number => Math.min(10, floorsOf(d));
  const generated = (d: DungeonDef, f: number): boolean => planAt(d, f)?.kind === 'generated';
  /** Experience of every enemy a run really places on floor `f` (what clearing it pays, without gate or set pieces). */
  const realFloorXp = (d: DungeonDef, f: number, seed: number, tier: Difficulty): number =>
    startRun(seed, { difficulty: tier }, f, d.id).world.enemies.reduce((sum, e) => sum + enemyXp(e, f), 0);

  it('a regular dungeon\'s generated floor pays exactly what the run places on its reference seeds (counts, roles, leaders)', () => {
    for (const d of DUNGEONS.filter((x) => !x.endless))
      for (const tier of ['easy', 'nightmare'] as const)
        for (let f = 2; f <= lastFloor(d); f++) {
          if (!generated(d, f)) continue;
          const mean = [1, 2, 3, 4, 5, 6, 7, 8].reduce((sum, seed) => sum + realFloorXp(d, f, seed, tier), 0) / 8;
          expect(expectedFloorXp(d.id, f, tier), `${d.id} F${f} ${tier}`).toBeCloseTo(mean, 6);
        }
  });

  it('the expected level is within one level of what real run seeds reach, floor by floor, in every dungeon', () => {
    const seeds = Array.from({ length: 16 }, (_, i) => 101 + i);
    for (const d of DUNGEONS)
      for (const tier of ['easy', 'nightmare'] as const) {
        let xp = 0;
        for (let f = 1; f <= lastFloor(d); f++) {
          const real = levelForXp(xp);
          expect(Math.abs(expectedLevel(d.id, f, tier) - real), `${d.id} F${f} ${tier}: expected ${expectedLevel(d.id, f, tier)} real ${real}`).toBeLessThanOrEqual(1);
          xp += generated(d, f) ? seeds.reduce((sum, seed) => sum + realFloorXp(d, f, seed, tier), 0) / seeds.length : expectedFloorXp(d.id, f, tier);
        }
      }
  });

});

describe('one-hit cap (P5.6)', () => {
  it('caps a hit at the share of the reference HP, after tier, depth, party and pact multipliers', () => {
    const pact = { id: 'sand' as const, floorsLeft: 2, playerDamage: 1, enemySpeed: 1, enemyDamage: 1.3 };
    const deep = world('nightmare', { enemyScale: { hp: 2, damage: 2 }, simaPact: pact, referenceLevel: 5 });
    const cap = hitCap(speciesMaxHpAt(deep.player.species, 5));
    expect(cap).toBe(Math.floor(speciesMaxHpAt(deep.player.species, 5) * MAX_HIT_SHARE));
    expect(hurt(atLevel(deep, 5), 30)).toBe(cap);
    // Every tier, one huge raw hit: a player of the expected level never loses more than the share.
    for (const d of DIFFICULTIES) {
      const w = atLevel(world(d, { referenceLevel: 3 }), 3);
      expect(hurt(w, 500) / w.player.maxHp, d).toBeLessThanOrEqual(MAX_HIT_SHARE);
    }
  });

  it('a levelled player is never one-shot from full HP; an under-levelled one can be', () => {
    const w = world('nightmare', { referenceLevel: MAX_LEVEL });
    const levelled = atLevel(w, MAX_LEVEL);
    expect(landHitOnPlayer(levelled, { damage: 9999 }, []).state.player.hp).toBeGreaterThan(0);
    // Level 1 where the top level is expected: the cap (35 % of that HP) is more than its 40 HP left.
    const low = atLevel(w, 1);
    const under = { ...low, player: { ...low.player, hp: 40 } };
    expect(hitCap(speciesMaxHpAt(w.player.species, MAX_LEVEL))).toBeGreaterThan(40);
    expect(landHitOnPlayer(under, { damage: 9999 }, []).state.player.hp).toBe(0);
  });

  it('an over-levelled player takes the same absolute damage (a smaller share)', () => {
    const w = world('hard', { referenceLevel: 2 });
    const expected = hurt(atLevel(w, 2), 500);
    const over = atLevel(w, MAX_LEVEL);
    expect(hurt(over, 500)).toBe(expected);
    expect(expected / over.player.maxHp).toBeLessThan(MAX_HIT_SHARE);
  });

  it('leaves ordinary hits alone', () => {
    expect(hurt(world('easy'), 20)).toBe(20);
  });

  it('is the share the harness band checks', () => {
    expect(MAX_HIT_SHARE).toBe(BANDS.maxHitShare);
  });
});

/** Real ms a wind-up of `durationMs` lasts when the enemy's clock runs `pace` times faster (elite, pact). */
function windupRealMs(durationMs: number, d: Difficulty, pace: number, elite?: EliteTrait, positional = false): number {
  let ai: AiState = { ...initialAi(), mode: 'telegraph', modeMs: 0, modeDurationMs: durationMs };
  let real = 0;
  while (ai.modeMs < durationMs) {
    ai = tickAiAt(ai, FIXED_DT_MS * pace, d, elite, { pace, positional });
    real += FIXED_DT_MS;
    if (real > 10_000) throw new Error('never ends');
  }
  return real;
}

describe('telegraph floor applied last (P5)', () => {
  it('a swift or enraged elite never winds up faster than the floor, on any tier', () => {
    const pace = ELITE_TRAIT_DEFS.enrage.enrage!.pace * 1.2; // enraged, under a Sima pact's quickening curse
    for (const d of DIFFICULTIES) {
      for (const base of [320, 400, 550]) {
        const real = windupRealMs(base, d, pace, 'enrage');
        expect(real, `${d} ${base}`).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
      }
    }
  });

  it('a positional (pierceRoll) wind-up keeps the choice floor', () => {
    const real = windupRealMs(600, 'nightmare', 1.8, 'swift', true);
    expect(real).toBeGreaterThanOrEqual(CHOICE_TELEGRAPH_FLOOR_MS);
  });

  it('never lengthens a wind-up that no modifier shortened, nor authored content already under the floor', () => {
    expect(effectiveTelegraphMs(550, 'easy', 1, false)).toBe(550);
    expect(effectiveTelegraphMs(260, 'nightmare', 1, false)).toBe(260);
    expect(effectiveTelegraphMs(260, 'nightmare', 2, false)).toBe(260);
    // Slow-mo (pace under 1) still stretches it.
    expect(effectiveTelegraphMs(550, 'easy', 0.5, false)).toBe(1100);
  });

  it('holds in play: an enraged Poochyena under a quickening pact, on nightmare', () => {
    const pact = { id: 'edge' as const, floorsLeft: 2, playerDamage: 1, enemySpeed: 1.2, enemyDamage: 1 };
    let w = spawnEnemy(world('nightmare', { simaPact: pact }), 'poochyena', vec(400, 200), { elite: 'enrage' });
    w = { ...w, enemies: w.enemies.map((e) => ({ ...e, hp: e.maxHp * 0.1 })) };
    let started: number | null = null;
    let ms: number | null = null;
    for (let i = 0; i < 600 && ms === null; i++) {
      w = step(w, input(), FIXED_DT_MS);
      if (started === null && w.events.some((e) => e.type === 'enemyTelegraph')) started = w.timeMs;
      if (started !== null && w.events.some((e) => e.type === 'enemyAttack')) ms = w.timeMs - started;
    }
    expect(ms).not.toBeNull();
    // Before the fix: 550 × 0.85 / (1.5 × 1.2) ≈ 260 ms.
    expect(POOCHYENA.telegraphMs * 0.85 / 1.8).toBeLessThan(TELEGRAPH_FLOOR.minMs);
    expect(ms!).toBeGreaterThanOrEqual(TELEGRAPH_FLOOR.minMs);
  });
});
