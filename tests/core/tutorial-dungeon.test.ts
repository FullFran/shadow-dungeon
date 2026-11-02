import { describe, expect, it } from 'vitest';
import { generateFloor } from '../../src/core/dungeon';
import { floorKind, floorPlanOf, startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { shadowKit } from '../../src/core/shadow';
import { CHALLENGES, CRYPT, DUNGEONS, SENDA_ROADS, TUTORIAL, dungeonById, guardianOf, isDungeonId, tierFor } from '../../src/data/dungeons';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { MOVES, type MoveId } from '../../src/data/moves';
import { ROOMS } from '../../src/data/rooms';
import { SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES } from '../../src/i18n';
import { runDungeon, runFloor } from '../../src/sim/runner';
import { IDLE } from './helpers';

// Owner (2026-11-02): "haz una mini mazmorra que sea para llegar al pueblo como en hollow knight que esa sea el tutorial!!! y que el jefe sea tu sombra".
describe('the tutorial dungeon (the way to the town)', () => {
  it('is two short generated floors, then the shadow boss room', () => {
    expect(TUTORIAL.plan.map((p) => (p.kind === 'room' ? `${p.room}${p.role ? `:${p.role}` : ''}` : 'generated'))).toEqual(['generated', 'generated', 'mirror']);
    expect(guardianOf(TUTORIAL)).toBe('shadow-self');
    expect(ROOMS.mirror.spawns.map((s) => s.species)).toEqual(['shadow-self']);
    expect(ROOMS.mirror.exit).toBeNull();
  });

  it('is a dungeon of this build, but never offered in the select, the challenges or the Senda roads', () => {
    expect(isDungeonId(TUTORIAL.id)).toBe(true);
    expect(dungeonById(TUTORIAL.id)).toBe(TUTORIAL);
    expect(DUNGEONS).not.toContain(TUTORIAL);
    expect(CHALLENGES).not.toContain(TUTORIAL);
    expect(SENDA_ROADS).not.toContain(TUTORIAL);
  });

  it('only holds the weakest regulars, at most two per room, and never an urgent floor', () => {
    const weakest = new Set(['poochyena', 'gastly']);
    for (const entry of TUTORIAL.spawns.pool) expect(weakest.has(entry.species), entry.species).toBe(true);
    for (let seed = 1; seed <= 60; seed++) {
      for (const depth of [1, 2]) {
        const floor = generateFloor(seed, depth, TUTORIAL.spawns);
        const rooms = floor.rooms.map((_, i) => floor.spawns.filter((s) => s.room === i).length);
        expect(Math.max(...rooms)).toBeLessThanOrEqual(2);
        expect(floorKind(seed, depth, TUTORIAL)).toBe('normal');
      }
    }
    expect(TUTORIAL.gates).toBeUndefined();
    expect(TUTORIAL.events).toBeUndefined();
  });

  it('plays on the same forgiving tier whatever the setting, and heals fully on every floor', () => {
    for (const tier of ['easy', 'normal', 'hard', 'nightmare'] as const) expect(tierFor(TUTORIAL, tier)).toBe('easy');
    expect(tierFor(CRYPT, 'hard')).toBe('hard');
    expect(TUTORIAL.floorHeal).toBe(1);
  });

  it('starts a run on its first floor and meets the shadow on the third', () => {
    expect(startRun(3, {}, 1, TUTORIAL.id).run.dungeon).toBe(TUTORIAL.id);
    const boss = startRun(3, {}, 3, TUTORIAL.id);
    expect(floorPlanOf(boss.run).kind).toBe('room');
    expect(boss.world.enemies.map((e) => e.species)).toEqual(['shadow-self']);
  });

  for (const language of LANGUAGES) {
    it(`"${language}" names it, tells its lore, floors, boss and closing line, with no em dash`, () => {
      const tr = catalog(language);
      const keys = [TUTORIAL.lore.nameKey, TUTORIAL.lore.subtitleKey, ...TUTORIAL.lore.loreKeys, ...(TUTORIAL.lore.floorKeys ?? []), TUTORIAL.lore.victoryKey!, 'species.shadow-self'];
      expect(TUTORIAL.lore.floorKeys).toHaveLength(TUTORIAL.plan.length);
      for (const key of keys) {
        expect(tr[key], key).toBeTruthy();
        expect(tr[key]!.includes('—'), key).toBe(false);
        // House style of the dungeon lore (tests/data/guardians.test.ts): short lines.
        expect(tr[key]!.length, key).toBeLessThanOrEqual(110);
      }
    });
  }
});

describe('Tu Sombra: the boss mirrors the player', () => {
  it('is an original creature: drawn in code, no Pokémon sheet shown, typeless (nothing is immune to it)', () => {
    expect(SPECIES['shadow-self'].types).toEqual([]);
    expect(ENEMY_BEHAVIOUR['shadow-self']?.kind).toBe('shadow');
  });

  it("takes the player's equipped attacking moves as its kit, in slot order", () => {
    expect(shadowKit(['shadow-claw', 'play-rough', 'swords-dance', 'dazzling-gleam'])).toEqual(['shadow-claw', 'play-rough', 'dazzling-gleam']);
    expect(shadowKit(['ember', null, 'will-o-wisp', 'flamethrower'])).toEqual(['ember', 'flamethrower']);
    // Nothing to mirror: it still fights with a plain swipe.
    expect(shadowKit([null, null, 'swords-dance', null]).length).toBe(1);
  });

  /** The shadow's wind-ups over `ms` with the player standing still at `at` (unhurt). */
  function windUps(species: 'mimikyu' | 'litwick', loadout: readonly (MoveId | null)[], at: { x: number; y: number }, ms: number): { attacks: string[]; hurt: number } {
    let world: WorldState = startRun(9, { species, loadout }, 3, TUTORIAL.id).world;
    // No fog wall in the harness: straight into the arena.
    world = { ...world, fogWall: undefined, player: { ...world.player, pos: vec(at.x, at.y) } };
    const events: GameEvent[] = [];
    let hurt = 0;
    for (let t = 0; t < ms; t += FIXED_DT_MS) {
      world = step(world, IDLE, FIXED_DT_MS);
      hurt += world.events.filter((e) => e.type === 'playerHurt').length;
      world = { ...world, player: { ...world.player, hp: world.player.maxHp } };
      events.push(...world.events);
    }
    return { attacks: events.flatMap((e) => (e.type === 'enemyTelegraph' ? [e.attack] : [])), hurt };
  }

  it("winds up only the player's own moves, and they land", () => {
    const loadout: MoveId[] = ['shadow-claw', 'play-rough', 'swords-dance', 'dazzling-gleam'];
    const { attacks, hurt } = windUps('mimikyu', loadout, { x: ROOMS.mirror.width / 2, y: ROOMS.mirror.height / 2 }, 20_000);
    expect(attacks.length).toBeGreaterThan(2);
    for (const attack of attacks) expect(shadowKit(loadout)).toContain(attack);
    expect(new Set(attacks).size).toBeGreaterThan(1);
    expect(hurt).toBeGreaterThan(0);
  });

  it('throws a ranged move from range when the player carries one', () => {
    const loadout: MoveId[] = ['ember', 'hex', 'will-o-wisp', 'flamethrower'];
    const { attacks } = windUps('litwick', loadout, { x: 60, y: ROOMS.mirror.height - 40 }, 20_000);
    const ranged = loadout.filter((m) => MOVES[m].hitbox.kind === 'projectile');
    expect(ranged.length).toBeGreaterThan(0);
    expect(attacks.some((a) => ranged.includes(a as MoveId))).toBe(true);
  });

  it('is the gentle exam: long, readable wind-ups and soft hits', () => {
    const def = ENEMY_BEHAVIOUR['shadow-self'];
    if (def?.kind !== 'shadow') throw new Error('not a shadow');
    expect(Math.min(...Object.values(def.telegraphMs))).toBeGreaterThanOrEqual(600);
    expect(def.maxPower).toBeLessThanOrEqual(45);
    expect(SPECIES['shadow-self'].maxHp).toBeLessThan(SPECIES.sableye.maxHp);
  });
});

// The balance harness (src/sim): the tutorial is the gentle exam, so an average player gets through it whole and a novice beats the shadow fresh.
describe('the tutorial dungeon in the balance harness', () => {
  it('an average bot walks it to the end, and a novice beats the shadow fresh', () => {
    for (const seed of [1, 2, 3]) {
      const run = runDungeon({ dungeon: TUTORIAL.id, tier: 'easy', bot: 'average', party: 1, seed });
      expect(run.outcome, `seed ${seed}`).toBe('victory');
      expect(run.floors.map((f) => f.floor)).toEqual([1, 2, 3]);
    }
    for (const seed of [1, 2, 3]) {
      const arena = runFloor({ dungeon: TUTORIAL.id, tier: 'easy', bot: 'novice', party: 1, seed }, 3);
      expect(arena.boss).toBe('shadow-self');
      expect(arena.outcome, `seed ${seed}`).toBe('cleared');
    }
  });
});
