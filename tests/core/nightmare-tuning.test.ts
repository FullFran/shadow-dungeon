import { describe, expect, it } from 'vitest';
import { ALL_ELITE_TRAITS, DIFFICULTIES, TIERS, type Difficulty, type EliteTrait } from '../../src/data/difficulty';
import { RUN } from '../../src/data/dungeon';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { ITEM_EFFECTS, ORAN_BERRY } from '../../src/data/items';
import { COINS } from '../../src/data/coins';
import type { SpeciesId } from '../../src/data/species';
import { placeBerries } from '../../src/core/berries';
import { turnMsFor } from '../../src/core/cards';
import { generateFloor } from '../../src/core/dungeon';
import { drawElite, tierEliteRule, tierHealing } from '../../src/core/difficulty';
import { addItem, onHitDealt, onTick } from '../../src/core/items';
import { floorSeed, progressRun, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { openGate } from './helpers';

/**
 * Nightmare tuning (odd/tasks/nightmare-tuning.md, docs/research/items-and-prep.md
 * §3.3, owner option 5(a)): every lever pinned, and the three easier tiers
 * proven unmoved.
 */

const SEED = 20261025;
const LOWER: readonly Difficulty[] = ['easy', 'normal', 'hard'];

const toStairs = (world: WorldState): WorldState => ({
  ...openGate(world),
  player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) },
});

const arena = (difficulty: Difficulty, items: Parameters<typeof addItem>[1][] = []): WorldState => {
  const state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), difficulty });
  return { ...state, player: items.reduce(addItem, { ...state.player, hp: 10 }) };
};

describe('Nightmare tuning: the levers', () => {
  it('N2: a Nightmare elite may draw every one of the six traits (volley only on casters); the telegraph floor stays the shared one', () => {
    expect([...tierEliteRule('nightmare').traits].sort()).toEqual([...ALL_ELITE_TRAITS].sort());
    const caster = (Object.keys(ENEMY_BEHAVIOUR) as SpeciesId[]).find((s) => ENEMY_BEHAVIOUR[s]?.kind === 'caster')!;
    const seen = new Set<EliteTrait>();
    for (let seed = 1; seed <= 400; seed++) {
      for (let i = 0; i < 6; i++) {
        const e = drawElite(seed, i, tierEliteRule('nightmare'), caster);
        if (e) seen.add(e.trait);
      }
    }
    expect([...seen].sort()).toEqual([...ALL_ELITE_TRAITS].sort());
  });

  it('N3: Nightmare heals less for free: floor entry 15 %, Oran Berry chance 20 %, item sustain ceiling 1.5 %/s', () => {
    expect(tierHealing('nightmare')).toEqual({ floorHeal: 0.15, berryChance: 0.2, sustainPerSecond: 0.015 });
  });

  it('N3: the floor-entry heal is the tier\'s (a run on Nightmare heals 15 % of max HP on the next floor)', () => {
    const { run, world } = startRun(SEED, { difficulty: 'nightmare' });
    const hurt = { ...world, player: { ...world.player, hp: 40 } };
    const next = progressRun(run, toStairs(hurt));
    expect(next.entered).toBe(true);
    expect(next.world.player.hp).toBeCloseTo(40 + 0.15 * world.player.maxHp);
  });

  it('N3: Oran Berries lie in fewer rooms on Nightmare, always a subset of the rooms that hold one on the easier tiers (same seed)', () => {
    let nightmare = 0;
    let base = 0;
    for (let s = 1; s <= 40; s++) {
      const seed = floorSeed(SEED + s, 2);
      const floor = generateFloor(seed, 2);
      const rich = placeBerries(floor, seed, 2);
      const poor = placeBerries(floor, seed, 2, tierHealing('nightmare').berryChance);
      expect(poor.every((b) => rich.some((r) => r.id === b.id))).toBe(true);
      nightmare += poor.length;
      base += rich.length;
    }
    expect(nightmare).toBeLessThan(base);
    expect(nightmare / base).toBeGreaterThan(0.4);
    expect(nightmare / base).toBeLessThan(0.75);
  });

  it('N3: on Nightmare two Leftovers heal at the 1.5 %/s ceiling, not 2 %/s', () => {
    const state = arena('nightmare', ['leftovers', 'leftovers']);
    const after = onTick(state, 1000, []);
    expect(after.player.hp).toBeCloseTo(10 + 0.015 * state.player.maxHp, 5);
  });

  it('N3: on Nightmare Shell Bell\'s budget follows the 1.5 %/s ceiling', () => {
    const player = arena('nightmare', ['shell-bell', 'shell-bell']).player;
    const healed = onHitDealt(player, 10_000, true, tierHealing('nightmare').sustainPerSecond);
    expect(healed.hp - player.hp).toBeCloseTo(0.015 * player.maxHp * ITEM_EFFECTS.shellBellBurstSeconds, 5);
  });

  it('N4: the Nightmare turn ("tu turno") lasts 700 ms, its floor', () => {
    expect(TIERS.nightmare.turnMs).toBe(700);
    expect(turnMsFor({ difficulty: 'nightmare' })).toBe(700);
  });

  it('N5: Nightmare pays ×2.5', () => {
    expect(TIERS.nightmare.coins).toBe(2.5);
    expect(COINS.difficulty.nightmare).toBe(2.5);
  });
});

describe('Nightmare tuning: Easy, Normal and Hard did not move', () => {
  it('their tier numbers are exactly the shipped ones', () => {
    expect(TIERS.easy).toEqual({ hp: 1, damage: 1, telegraph: 1, extraPerRoom: 0, cooldown: 1, eliteChance: 0, restartsPerFloor: null, bonfireRespawns: null, coins: 1, encounters: { frequency: 1, extraWaves: 0 }, roll: { iframes: 1, stamina: 1 }, turnMs: 1600 });
    expect(TIERS.normal).toEqual({ hp: 1.15, damage: 1.15, telegraph: 0.95, extraPerRoom: 0, cooldown: 0.9, eliteChance: 0.1, restartsPerFloor: null, bonfireRespawns: 3, coins: 1.3, encounters: { frequency: 1.2, extraWaves: 0 }, roll: { iframes: 1, stamina: 1 }, turnMs: 1300 });
    expect(TIERS.hard).toEqual({ hp: 1.3, damage: 1.3, telegraph: 0.9, extraPerRoom: 0, cooldown: 0.8, eliteChance: 0.2, restartsPerFloor: 1, bonfireRespawns: 1, coins: 1.7, encounters: { frequency: 1.5, extraWaves: 0 }, roll: { iframes: 0.9, stamina: 1.1 }, turnMs: 1000 });
  });

  it('their elites draw only tough and frenzied, and they heal as before (25 %, 35 %, 2 %/s)', () => {
    for (const d of LOWER) {
      expect(tierEliteRule(d).traits).toEqual(['tough', 'frenzied']);
      expect(tierHealing(d)).toEqual({ floorHeal: 0.25, berryChance: 0.35, sustainPerSecond: 0.02 });
    }
    expect(RUN.floorHeal).toBe(0.25);
    expect(ORAN_BERRY.roomChance).toBe(0.35);
    expect(ITEM_EFFECTS.sustainPerSecond).toBe(0.02);
  });

  it('their floor heal, berries and Leftovers play as before', () => {
    for (const d of LOWER) {
      const { run, world } = startRun(SEED, { difficulty: d });
      const hurt = { ...world, player: { ...world.player, hp: 40 } };
      expect(progressRun(run, toStairs(hurt)).world.player.hp).toBeCloseTo(40 + 0.25 * world.player.maxHp);
      const state = arena(d, ['leftovers', 'leftovers']);
      expect(onTick(state, 1000, []).player.hp).toBeCloseTo(10 + 0.02 * state.player.maxHp, 5);
    }
    const seed = floorSeed(SEED, 2);
    const floor = generateFloor(seed, 2);
    expect(placeBerries(floor, seed, 2, tierHealing('hard').berryChance)).toEqual(placeBerries(floor, seed, 2));
  });

  it('every tier still pays more than the one below it', () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) expect(TIERS[DIFFICULTIES[i]!].coins).toBeGreaterThan(TIERS[DIFFICULTIES[i - 1]!].coins);
  });
});
