import { describe, expect, it } from 'vitest';
import { FLOOD, WATER } from '../../src/data/dungeon';
import { CAVES, DUNGEONS, dungeonById, guardianOf } from '../../src/data/dungeons';
import { ENEMY_BEHAVIOUR, KRABBY, REMORAID, SHELLOS, type EnemyAttackDef } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { computeDamage } from '../../src/core/damage';
import { generateFloor } from '../../src/core/dungeon';
import { isUnlocked } from '../../src/core/dungeon-select';
import { floodFactor, floodLevel, startFlood, updateFlood } from '../../src/core/flood';
import { floorKind, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { withTricks } from '../../src/core/tricks';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { TILE, tileCenter } from '../../src/core/tiles';
import { distance, dot, normalize, sub, vec, type Vec2 } from '../../src/core/vec';
import { shallowWater, wadeFactor } from '../../src/core/water';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, input, ticksFor } from './helpers';

const PLAYER = vec(400, 300);

function arena(species: EnemyState['species'], pos: Vec2, difficulty?: WorldState['difficulty']): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER });
  return spawnEnemy(difficulty ? { ...base, difficulty } : base, species, pos);
}

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 900, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const first = (state: WorldState) => state.enemies[0]!;
const enemyShots = (state: WorldState) => state.projectiles.filter((p) => p.owner === 'enemy');

describe('the Flooded Caves run', () => {
  it('has ten floors: four generated, Lanturn on 5 (with an exit), four generated, Dhelmise on 10', () => {
    expect(CAVES.plan).toHaveLength(10);
    expect(CAVES.plan[4]).toEqual({ kind: 'room', room: 'grotto', role: 'midboss' });
    expect(CAVES.plan[9]).toEqual({ kind: 'room', room: 'wreck' });
    expect(CAVES.plan.filter((p) => p.kind === 'generated')).toHaveLength(8);
    expect(ROOMS.grotto.exit).not.toBeNull();
    expect(ROOMS.grotto.spawns.map((s) => s.species)).toEqual(['lanturn']);
    expect(guardianOf(CAVES)).toBe('dhelmise');
    expect(dungeonById('flooded-caves')).toBe(CAVES);
    expect(DUNGEONS).toContain(CAVES);
  });

  it('opens only once the Misty Forest is cleared', () => {
    expect(CAVES.unlockedBy).toBe('misty-forest');
    expect(isUnlocked(CAVES, new Set(['crypt-of-the-sword-king']))).toBe(false);
    expect(isUnlocked(CAVES, new Set(['crypt-of-the-sword-king', 'misty-forest']))).toBe(true);
  });

  it('plays through to Dhelmise: stairs, the grotto exit once Lanturn falls, stairs, victory', () => {
    let progress: RunProgress = { ...startRun(21, {}, 1, 'flooded-caves'), entered: false, outcome: null };
    const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    const clear = (w: WorldState): WorldState => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });
    for (let floor = 2; floor <= 5; floor++) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(5);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['lanturn']);
    const exit = ROOMS.grotto.exit!;
    const atExit = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } });
    progress = progressRun(progress.run, atExit(clear(progress.world)));
    expect(progress.run.floor).toBe(6);
    for (let floor = 7; floor <= 10; floor++) progress = progressRun(progress.run, toStairs(progress.world));
    expect(progress.run.floor).toBe(10);
    expect(progress.world.enemies.map((e) => e.species)).toEqual(['dhelmise']);
    expect(progressRun(progress.run, clear(progress.world)).outcome).toBe('victory');
  });

  it('rolls the flood (Inundación) on generated floors only, never on floor 1, more often deeper', () => {
    const count = (floor: number) => Array.from({ length: 400 }, (_, i) => floorKind(i + 1, floor, CAVES)).filter((k) => k === 'flood').length;
    expect(count(1)).toBe(0);
    expect(count(5)).toBe(0);
    expect(count(10)).toBe(0);
    expect(count(2)).toBeGreaterThan(40);
    expect(count(9)).toBeGreaterThan(count(2));
  });

  it('starts the flood clock on a flood floor and clears it on the next floor', () => {
    const seed = Array.from({ length: 400 }, (_, i) => i + 1).find((s) => floorKind(s, 2, CAVES) === 'flood' && floorKind(s, 3, CAVES) === 'normal')!;
    const run = startRun(seed, {}, 2, 'flooded-caves');
    expect(run.run.kind).toBe('flood');
    expect(run.world.flood).toBeDefined();
    const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
    const next = progressRun(run.run, toStairs(run.world));
    expect(next.run.floor).toBe(3);
    expect(next.world.flood).toBeUndefined();
  });

  it('draws its generated floors from the caves pool, Zubat in threes', () => {
    const species = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) for (const s of generateFloor(seed, 7, CAVES.spawns).spawns) species.add(s.species);
    for (const s of species) expect(CAVES.spawns.pool.map((e) => e.species)).toContain(s);
    expect(species).toContain('krabby');
    expect(species).toContain('remoraid');
    expect(species).toContain('shellos');
    expect(CAVES.spawns.pool.find((e) => e.species === 'zubat')?.pack).toBe(3);
    const floorOne = new Set(Array.from({ length: 60 }, (_, i) => generateFloor(i + 1, 1, CAVES.spawns).spawns.map((s) => s.species)).flat());
    expect(floorOne.has('clauncher')).toBe(false);
  });
});

describe('shallow water and the flood', () => {
  it('lays pools deterministically on room floor, never on the start or the stairs', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const floor = generateFloor(seed, 3, CAVES.spawns);
      const water = shallowWater(floor, CAVES.water!);
      expect(water).toEqual(shallowWater(floor, CAVES.water!));
      expect(water).toHaveLength(floor.cols * floor.rows);
      water.forEach((w, i) => {
        if (w === 1) expect(floor.tiles[i]).toBe(1);
      });
      expect(water[floor.start.y * floor.cols + floor.start.x]).toBe(0);
      expect(water[floor.stairs.y * floor.cols + floor.stairs.x]).toBe(0);
    }
    const wet = Array.from({ length: 40 }, (_, i) => shallowWater(generateFloor(i + 1, 3, CAVES.spawns), CAVES.water!).filter((w) => w === 1).length);
    expect(wet.filter((n) => n > 0).length).toBeGreaterThan(30);
  });

  it('puts the pools into the caves floors (and nowhere else)', () => {
    expect(startRun(5, {}, 2, 'flooded-caves').world.arena.water).toBeDefined();
    expect(startRun(5, {}, 2, 'misty-forest').world.arena.water).toBeUndefined();
  });

  it('slows a non-Water walker in shallow water, never a Water-type one', () => {
    const floor = generateFloor(3, 3, CAVES.spawns);
    const water = shallowWater(floor, CAVES.water!);
    const index = water.findIndex((w) => w === 1);
    const pos = tileCenter({ x: index % floor.cols, y: Math.floor(index / floor.cols) });
    const arenaWet = { width: floor.cols * TILE, height: floor.rows * TILE, tiles: floor, water };
    expect(wadeFactor(['ghost', 'fairy'], arenaWet, pos)).toBeCloseTo(WATER.shallowFactor);
    expect(wadeFactor(['water'], arenaWet, pos)).toBe(1);
    expect(wadeFactor(['ghost', 'fairy'], { ...arenaWet, water: undefined }, pos)).toBe(1);
  });

  it('rises monotonically to its cap after a grace, and only slows non-Water players', () => {
    let flood = startFlood();
    let last = -1;
    for (let ms = 0; ms <= FLOOD.graceMs + FLOOD.riseMs + 5000; ms += 500) {
      const level = floodLevel({ ...flood, elapsedMs: ms });
      expect(level).toBeGreaterThanOrEqual(last);
      last = level;
    }
    expect(floodLevel({ ...flood, elapsedMs: FLOOD.graceMs - 1 })).toBe(0);
    expect(last).toBe(1);
    flood = { ...flood, elapsedMs: FLOOD.graceMs + FLOOD.riseMs };
    expect(floodFactor(flood, ['ghost'])).toBeCloseTo(1 - FLOOD.maxSlow);
    expect(floodFactor(flood, ['water', 'electric'])).toBe(1);
  });

  it('makes a non-Water player walk slower than a Water-type one once risen', () => {
    const walk = (species: 'mimikyu' | 'litwick') => {
      const base = createWorld({ seed: 1, arena: { width: 2000, height: 600 }, playerPos: vec(100, 300), species });
      const flooded: WorldState = { ...base, flood: { ...startFlood(), elapsedMs: FLOOD.graceMs + FLOOD.riseMs } };
      const dry = createWorld({ seed: 1, arena: { width: 2000, height: 600 }, playerPos: vec(100, 300), species });
      const go = (w: WorldState) => {
        let current = w;
        for (let i = 0; i < 60; i++) current = step(current, input({ move: vec(1, 0) }), FIXED_DT_MS);
        return current.player.pos.x - 100;
      };
      return { flooded: go(flooded), dry: go(dry) };
    };
    const mimikyu = walk('mimikyu');
    expect(mimikyu.flooded).toBeCloseTo(mimikyu.dry * (1 - FLOOD.maxSlow), 0);
    // A Water type would not slow; check the factor itself on a Water-type player.
    expect(floodFactor({ ...startFlood(), elapsedMs: 1e9 }, ['water'])).toBe(1);
  });

  it('chills a non-Water player once fully risen, never below 1 HP', () => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER });
    let state: WorldState = { ...base, player: { ...base.player, hp: 3 }, flood: { ...startFlood(), elapsedMs: FLOOD.graceMs + FLOOD.riseMs } };
    const events: GameEvent[] = [];
    for (let i = 0; i < ticksFor(FLOOD.chillIntervalMs * 6); i++) state = updateFlood(state, FIXED_DT_MS, events);
    expect(events.some((e) => e.type === 'collapseHurt')).toBe(true);
    expect(state.player.hp).toBe(1);
  });
});

describe('caves enemies', () => {
  it('Krabby scuttles sideways around the player before it lunges', () => {
    const start = arena('krabby', vec(400, 120));
    const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach', cooldownMs: 5000 } }] };
    const after = stepUntil(awake, () => false, ticksFor(800)).state;
    const moved = sub(first(after).pos, first(awake).pos);
    const radial = normalize(sub(PLAYER, first(awake).pos));
    const sideways = Math.abs(moved.x * -radial.y + moved.y * radial.x);
    expect(sideways).toBeGreaterThan(Math.abs(dot(moved, radial)));
  });

  it('Krabby cuts once on easy and twice from hard on (Crabhammer, then a second pincer)', () => {
    expect(KRABBY.followUp).toBeUndefined();
    expect(withTricks(KRABBY, 'easy')).toBe(KRABBY);
    expect(withTricks(KRABBY, 'hard').followUp).toBeDefined();
    const lunges = (difficulty: WorldState['difficulty']) => {
      const start = arena('krabby', vec(400, 230), difficulty);
      const { events } = stepUntil({ ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach' } }] }, () => false, ticksFor(1600));
      return events.filter((e) => e.type === 'enemyAttack').map((e) => (e as { attack: string }).attack);
    };
    expect(lunges('easy')).not.toContain('lunge2');
    expect(lunges('hard')).toContain('lunge2');
  });

  it('Remoraid fires a burst down one locked lane (three on easy, five from hard on)', () => {
    const shots = (difficulty?: WorldState['difficulty']) => {
      const start = arena('remoraid', vec(400, 120), difficulty);
      const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'reposition' } }] };
      const { state } = stepUntil(awake, (s) => first(s).ai.mode === 'recover', ticksFor(4000));
      return enemyShots(state);
    };
    const easy = shots();
    expect(easy).toHaveLength(REMORAID.burst!.shots);
    const dirs = easy.map((p) => normalize(p.vel));
    for (const d of dirs) expect(dot(d, dirs[0]!)).toBeGreaterThan(0.999);
    expect(shots('hard')).toHaveLength(5);
  });

  it('Shellos lobs mud at you; from hard on the landing splashes a ring of droplets', () => {
    const landed = (difficulty?: WorldState['difficulty']) => {
      const start = arena('shellos', vec(400, 160), difficulty);
      const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach' } }] };
      return enemyShots(stepUntil(awake, (s) => first(s).ai.mode === 'recover', ticksFor(4000)).state);
    };
    expect(landed().filter((p) => p.vel.x !== 0 || p.vel.y !== 0)).toHaveLength(0);
    expect(landed('hard').filter((p) => p.vel.x !== 0 || p.vel.y !== 0).length).toBe(withTricks(SHELLOS, 'hard').splash!.count);
  });

  it('keeps every new caves attack readable (>= 500 ms on easy) and within the hit budget', () => {
    const attacks: { name: string; attack: EnemyAttackDef; telegraphMs: number; species: 'krabby' | 'remoraid' | 'shellos' }[] = [
      { name: 'krabby', attack: KRABBY.attack, telegraphMs: KRABBY.telegraphMs, species: 'krabby' },
      { name: 'remoraid', attack: REMORAID.projectile, telegraphMs: REMORAID.telegraphMs, species: 'remoraid' },
      { name: 'shellos', attack: SHELLOS.attack, telegraphMs: SHELLOS.telegraphMs, species: 'shellos' },
    ];
    for (const { name, attack, telegraphMs, species } of attacks) {
      expect(telegraphMs, name).toBeGreaterThanOrEqual(500);
      for (const playable of PLAYABLE_SPECIES) {
        const { damage } = computeDamage({ power: attack.power, moveType: attack.type, attackerTypes: SPECIES[species].types, defenderTypes: SPECIES[playable].types });
        expect(damage / SPECIES[playable].maxHp, `${name} vs ${playable}`).toBeLessThanOrEqual(0.35);
      }
    }
    for (const id of ['krabby', 'remoraid', 'shellos'] as const) expect(ENEMY_BEHAVIOUR[id]).toBeDefined();
  });

  it('only non-Water walkers wade slower in the pools (the crabs keep their pace)', () => {
    const cols = 20;
    const rows = 10;
    const tiles = new Array<number>(cols * rows).fill(1);
    const water = new Array<number>(cols * rows).fill(1);
    const grid = { cols, rows, tiles };
    const base = createWorld({ seed: 1, arena: { width: cols * TILE, height: rows * TILE, tiles: grid, water }, playerPos: vec(600, 160) });
    const pace = (species: EnemyState['species']) => {
      const start = spawnEnemy(base, species, vec(100, 160));
      const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach', cooldownMs: 9000 } }] };
      return distance(first(stepUntil(awake, () => false, 30).state).pos, vec(100, 160));
    };
    const dryBase = { ...base, arena: { ...base.arena, water: undefined } };
    const dryPace = (() => {
      const start = spawnEnemy(dryBase, 'poochyena', vec(100, 160));
      const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach', cooldownMs: 9000 } }] };
      return distance(first(stepUntil(awake, () => false, 30).state).pos, vec(100, 160));
    })();
    expect(pace('poochyena')).toBeCloseTo(dryPace * WATER.shallowFactor, 0);
    const krabbyDry = (() => {
      const start = spawnEnemy(dryBase, 'krabby', vec(100, 160));
      const awake: WorldState = { ...start, enemies: [{ ...first(start), ai: { ...first(start).ai, mode: 'approach', cooldownMs: 9000 } }] };
      return distance(first(stepUntil(awake, () => false, 30).state).pos, vec(100, 160));
    })();
    expect(pace('krabby')).toBeCloseTo(krabbyDry, 3);
  });
});
