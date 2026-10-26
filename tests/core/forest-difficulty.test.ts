import { describe, expect, it } from 'vitest';
import { DECIDUEYE_CARDS_NORMAL } from '../../src/data/decidueye-cards';
import { TREVENANT_CARDS_NORMAL } from '../../src/data/hosted-cards';
import { updateTreant } from '../../src/core/treant';
import { tickAiAt } from '../../src/core/difficulty';
import { FIXED_DT_MS as TICK_MS } from '../../src/core/timestep';
import type { TreantDef } from '../../src/data/enemies';
import type { GameEvent as Ev } from '../../src/core/state';
import type { Difficulty } from '../../src/data/difficulty';
import { DECIDUEYE, ENEMY_BEHAVIOUR, TREVENANT } from '../../src/data/enemies';
import { FOREST_SPECIES, FOREST_TRICKS } from '../../src/data/forest-tricks';
import { behaviourFor } from '../../src/core/tricks';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, ticksFor } from './helpers';

const arena = (species: EnemyState['species'], pos: Vec2, difficulty?: Difficulty, playerPos = vec(400, 300), size = { width: 800, height: 600 }): WorldState => {
  const base = spawnEnemy(createWorld({ seed: 1, arena: size, playerPos }), species, pos);
  return difficulty ? { ...base, difficulty } : base;
};
const first = (s: WorldState) => s.enemies[0]!;

/** Steps with the player kept alive, collecting events and the most projectiles seen at once. */
function watch(state: WorldState, ms: number, until: (s: WorldState) => boolean = () => false) {
  let current = state;
  const events: GameEvent[] = [];
  let most = 0;
  const seen = new Set<string>();
  for (let i = 0; i < ticksFor(ms) && !until(current); i++) {
    current = step({ ...current, player: { ...current.player, hp: current.player.maxHp } }, IDLE, FIXED_DT_MS);
    events.push(...current.events);
    for (const p of current.projectiles) seen.add(p.id);
    most = Math.max(most, current.projectiles.length);
  }
  return { state: current, events, most, seen: seen.size };
}
const telegraphs = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'enemyTelegraph' ? [e.attack] : []));
const stances = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'bossStance' ? [e.stance] : []));

describe('forest difficulty hooks', () => {
  // Normal plays no forest trick (same behaviour object) but does feel the tier table (telegraphs, cooldowns, HP), so only easy is step-for-step identical.
  it('easy and normal play no trick (the same behaviour objects), and easy is the same fight, step for step', () => {
    for (const species of FOREST_SPECIES) {
      expect(behaviourFor(species, 'easy')).toBe(ENEMY_BEHAVIOUR[species]);
      // The guardian fights with spell cards from normal on (data/guardian-tricks.ts); nothing else changes on normal.
      if (species === 'decidueye') expect(behaviourFor(species, 'normal')).toEqual({ ...ENEMY_BEHAVIOUR[species], spellCards: DECIDUEYE_CARDS_NORMAL });
      else if (species === 'trevenant') expect(behaviourFor(species, 'normal')).toEqual({ ...ENEMY_BEHAVIOUR[species], spellCards: TREVENANT_CARDS_NORMAL });
      else expect(behaviourFor(species, 'normal')).toBe(ENEMY_BEHAVIOUR[species]);
      const tricks = FOREST_TRICKS[species] ?? [];
      expect(tricks.length, species).toBeGreaterThan(0);
      for (const t of tricks) expect(['hard', 'nightmare']).toContain(t.minDifficulty);
    }
    for (const species of FOREST_SPECIES) {
      const pos = vec(470, 300);
      const plain = watch(arena(species, pos), 6000).state;
      for (const tier of ['easy'] as const) {
        const tiered = watch(arena(species, pos, tier), 6000).state;
        expect({ ...tiered, difficulty: undefined }, `${species} ${tier}`).toEqual({ ...plain, difficulty: undefined });
      }
    }
  });

  it('every forest enemy has one extra trick on hard', () => {
    const once = (species: EnemyState['species'], difficulty: Difficulty | undefined, ms = 6000, pos = vec(470, 300)) => watch(arena(species, pos, difficulty), ms);
    // Phantump and Hoothoot: a second, re-aimed lunge.
    for (const species of ['phantump', 'hoothoot'] as const) {
      expect(telegraphs(once(species, undefined).events)).not.toContain('lunge2');
      expect(telegraphs(once(species, 'hard').events)).toContain('lunge2');
    }
    // Pumpkaboo Small: a ghost flame where its lunge ends.
    const still = (s: WorldState) => s.projectiles.filter((p) => p.vel.x === 0 && p.vel.y === 0).length;
    expect(still(once('pumpkaboo-small', undefined, 2500).state)).toBe(0);
    expect(once('pumpkaboo-small', 'hard', 2500, vec(440, 300)).seen).toBeGreaterThan(0);
    // Spinarak: five threads; Pumpkaboo Super: a ring with the slam; Foongus: a ring of spores; Shroomish: spores on landing; Drifloon: a second ring.
    const firstVolley = (species: EnemyState['species'], difficulty: Difficulty | undefined, pos: Vec2) => watch(arena(species, pos, difficulty), 6000, (s) => s.projectiles.length > 0).state.projectiles.length;
    expect([firstVolley('spinarak', undefined, vec(560, 300)), firstVolley('spinarak', 'hard', vec(560, 300))]).toEqual([3, 5]);
    expect(firstVolley('foongus', undefined, vec(470, 300))).toBe(1);
    expect(firstVolley('foongus', 'hard', vec(470, 300))).toBeGreaterThan(1);
    expect(firstVolley('pumpkaboo-super', 'hard', vec(450, 300))).toBeGreaterThan(0);
    expect(once('pumpkaboo-super', undefined, 4000, vec(450, 300)).seen).toBe(0);
    expect(firstVolley('shroomish', 'hard', vec(540, 300))).toBeGreaterThan(0);
    expect(once('shroomish', undefined, 4000, vec(540, 300)).seen).toBe(0);
    const drifloon = (difficulty?: Difficulty) => watch(arena('drifloon', vec(520, 300), difficulty), 6000, (s) => first(s).ai.mode === 'recover').state.projectiles.length;
    expect(drifloon()).toBe(8);
    expect(drifloon('hard')).toBe(16);
    // Impidimp: two feints before the real lunge.
    const sidesteps = (difficulty?: Difficulty) =>
      watch(arena('impidimp', vec(480, 300), difficulty), 5000, (s) => first(s).ai.mode === 'recover').events.filter((e) => e.type === 'enemyAttack' && e.attack === 'feint').length;
    expect(sidesteps()).toBe(1);
    expect(sidesteps('hard')).toBe(2);
  });

  it('Trevenant deals one more card on hard and plays longer combos on nightmare', () => {
    expect(behaviourFor('trevenant', 'hard')).toMatchObject({ cards: [...TREVENANT.cards, 'grove'] });
    const night = behaviourFor('trevenant', 'nightmare');
    if (night?.kind !== 'treant') throw new Error('not a treant');
    expect(night.cards).toContain('grove');
    expect(night.roots.waves).toBeGreaterThan(TREVENANT.roots.waves);
    expect(night.spiral.bursts).toBeGreaterThan(TREVENANT.spiral.bursts);
    expect(night.curse.rings).toBeGreaterThan(TREVENANT.curse.rings);
    const hollow = { width: 800, height: 640 };
    // Hard fights with hosted cards; its own rotation (the engine the cards host) plays the grove after its three cards.
    const own: TreantDef = { ...(behaviourFor('trevenant', 'hard') as TreantDef), spellCards: undefined };
    let s = arena('trevenant', vec(400, 230), 'hard', vec(400, 520), hollow);
    const events: Ev[] = [];
    for (let i = 0; i < 90000 / TICK_MS && (first(s).boss?.combosDone ?? 0) < 4; i++) {
      const e = first(s);
      s = updateTreant(s, { ...e, ai: tickAiAt(e.ai, TICK_MS, 'hard') }, own, s.player.pos, TICK_MS, events);
    }
    expect(stances(events)).toContain('grove');
    for (const e of events) if (e.type === 'enemyTelegraph') expect(e.durationMs).toBeGreaterThanOrEqual(500);
  });

  it('Decidueye deals one more card on hard and plays longer combos on nightmare', () => {
    const hard = behaviourFor('decidueye', 'hard');
    if (hard?.kind !== 'archer') throw new Error('not an archer');
    expect(hard.cards).toHaveLength(DECIDUEYE.cards.length + 1);
    expect(hard.phase2.cards).toHaveLength(DECIDUEYE.phase2.cards.length + 1);
    const night = behaviourFor('decidueye', 'nightmare');
    if (night?.kind !== 'archer') throw new Error('not an archer');
    expect(night.volley.shots).toBeGreaterThan(DECIDUEYE.volley.shots);
    expect(night.phase2.rain.waves).toBeGreaterThan(DECIDUEYE.phase2.rain.waves);
    expect(night.phase2.stitch.stitches).toBeGreaterThan(DECIDUEYE.phase2.stitch.stitches);
    const roost = { width: 640, height: 400 };
    // Hard's Decidueye fights with spell cards; its card rotation still plays in a Sima echo.
    const echo = { ...arena('decidueye', vec(320, 120), 'hard', vec(320, 330), roost), enemyScale: { hp: 1, damage: 1, echo: true as const } };
    const played = watch(echo, 60000, (s) => (first(s).boss?.combosDone ?? 0) >= 4);
    expect(stances(played.events).slice(0, 4)).toEqual(hard.cards);
  });
});
