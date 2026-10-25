import { describe, expect, it } from 'vitest';
import { spawnShot } from '../../src/core/brain';
import { generateFloor } from '../../src/core/dungeon';
import { depthScale, endlessSpawns } from '../../src/core/endless';
import { floorSeed, startRun } from '../../src/core/run';
import { eliteChance, eliteTimeScale, eliteTraitFor, simaSquads } from '../../src/core/sima';
import type { EnemyState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHitClaims, applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { ENEMY_BEHAVIOUR, GASTLY } from '../../src/data/enemies';
import { ENDLESS, isEchoFloor } from '../../src/data/endless';
import { SIMA_ELITES, SIMA_SQUADS } from '../../src/data/sima';
import { SPECIES } from '../../src/data/species';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { input } from './helpers';

const ECL = 'eclipse-chasm' as const;
const SEEDS = [4242, 7, 99, 2024, 31337];

/** Sima floors that are generated, 1..to. */
const generated = (to: number) => Array.from({ length: to }, (_, i) => i + 1).filter((f) => !isEchoFloor(ENDLESS, f));

describe('Sima ramp: tougher, not more', () => {
  it('never more than 3 enemies in a room, at any depth (event rooms aside)', () => {
    for (const seed of SEEDS) {
      for (const floor of generated(45)) {
        const world = startRun(seed, {}, floor, ECL).world;
        const rooms = world.arena.rooms ?? [];
        // An event's room (a vault's guards, a monster house) is a set piece, not the ramp.
        const event = world.simaEvent?.rect;
        const counts = rooms
          .filter((r) => !event || event.x !== r.x * 32 || event.y !== r.y * 32)
          .map((r) => world.enemies.filter((e) => e.wakeRoom && e.wakeRoom.x === r.x * 32 && e.wakeRoom.y === r.y * 32).length);
        expect(Math.max(0, ...counts), `seed ${seed} floor ${floor}`).toBeLessThanOrEqual(ENDLESS.spawns.maxPerRoom);
      }
    }
    expect(ENDLESS.spawns.maxPerRoom).toBe(3);
  });

  it('depth shifts the pool towards tougher species', () => {
    const tough = new Set(['golett', 'pumpkaboo-super', 'croagunk', 'clauncher', 'grimer', 'houndour', 'slugma']);
    const share = (depth: number) => {
      const pool = endlessSpawns(ENDLESS, depth).pool;
      const total = pool.reduce((s, e) => s + e.weights[0]!, 0);
      return pool.filter((e) => tough.has(e.species)).reduce((s, e) => s + e.weights[0]!, 0) / total;
    };
    expect(share(12)).toBeGreaterThan(share(4) * 1.5);
    expect(share(25)).toBeGreaterThan(share(12));
    // Weak swarmers never vanish entirely.
    expect(endlessSpawns(ENDLESS, 60).pool.find((e) => e.species === 'zubat')!.weights[0]!).toBeGreaterThan(0);
  });

  it('keeps HP and damage scaling moderate (elites carry the toughness)', () => {
    expect(ENDLESS.scaling.maxHp).toBeLessThanOrEqual(3);
    expect(ENDLESS.scaling.maxDamage).toBeLessThanOrEqual(2.5);
    expect(depthScale(ENDLESS.scaling, 20).hp).toBeLessThan(2.3);
  });

  it('elites: none before their floor, a chance that rises with depth, capped', () => {
    expect(ENDLESS.elites).toBe(SIMA_ELITES);
    expect(eliteChance(SIMA_ELITES, SIMA_ELITES.fromFloor - 1)).toBe(0);
    expect(eliteChance(SIMA_ELITES, 20)).toBeGreaterThan(eliteChance(SIMA_ELITES, SIMA_ELITES.fromFloor));
    expect(eliteChance(SIMA_ELITES, 500)).toBe(SIMA_ELITES.max);
    const early = startRun(7, {}, 1, ECL).world.enemies.filter((e) => e.elite);
    expect(early).toEqual([]);
  });

  it('elites are seeded, tougher, and get a trait that fits them (extra shots only for casters)', () => {
    let elites: EnemyState[] = [];
    for (const seed of SEEDS) for (const floor of [14, 18, 23, 27]) elites = [...elites, ...startRun(seed, {}, floor, ECL).world.enemies.filter((e) => e.elite)];
    expect(elites.length).toBeGreaterThan(5);
    expect(new Set(elites.map((e) => e.elite)).size).toBeGreaterThanOrEqual(3);
    for (const e of elites) {
      if (e.elite === 'volley') expect(ENEMY_BEHAVIOUR[e.species]?.kind).toBe('caster');
      if (e.elite === 'armored') expect(e.armor).toBe(true);
    }
    expect(startRun(7, {}, 23, ECL).world.enemies.map((e) => e.elite ?? null)).toEqual(startRun(7, {}, 23, ECL).world.enemies.map((e) => e.elite ?? null));
    // HP: the floor's scale times the elite bonus.
    const run = startRun(99, {}, 27, ECL).world;
    const elite = run.enemies.find((e) => e.elite)!;
    expect(elite.maxHp).toBeCloseTo(SPECIES[elite.species].maxHp * run.enemyScale!.hp * SIMA_ELITES.hpScale);
    expect(eliteTraitFor('poochyena', 0.99)).not.toBe('volley');
  });

  it('swift elites act faster, enraged ones only once hurt', () => {
    const base = { hp: 100, maxHp: 100 } as EnemyState;
    expect(eliteTimeScale(base)).toBe(1);
    expect(eliteTimeScale({ ...base, elite: 'swift' })).toBe(SIMA_ELITES.swiftScale);
    expect(eliteTimeScale({ ...base, elite: 'enrage' })).toBe(1);
    expect(eliteTimeScale({ ...base, elite: 'enrage', hp: 30 })).toBe(SIMA_ELITES.enrageScale);
  });

  it('a volley elite throws two more shots beside each one', () => {
    const world = spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }), 'gastly', vec(200, 300));
    const plain = world.enemies[0]!;
    const shot = { ...GASTLY.projectile };
    expect(spawnShot(world, plain, shot, vec(1, 0)).projectiles).toHaveLength(1);
    expect(spawnShot(world, { ...plain, elite: 'volley' }, shot, vec(1, 0)).projectiles).toHaveLength(3);
  });

  it('an armored elite shrugs off the first hit, then takes damage; a guest claim spends the armor on the host too', () => {
    let world: WorldState = spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), species: 'cubone' }), 'golett', vec(430, 300));
    world = { ...world, enemies: world.enemies.map((e) => ({ ...e, elite: 'armored' as const, armor: true as const, ai: { ...e.ai, mode: 'dormant' as const } })) };
    const swing = (s: WorldState) => {
      let next = step(s, input({ aim: vec(430, 300), slots: [true, false], slotMouse: [true, false] }), FIXED_DT_MS);
      for (let i = 0; i < 60 && next.player.action; i++) next = step(next, input({ aim: vec(430, 300) }), FIXED_DT_MS);
      return next;
    };
    const first = swing(world);
    expect(first.enemies[0]!.hp).toBe(world.enemies[0]!.hp);
    expect(first.enemies[0]!.armor).toBeUndefined();
    const second = swing(first);
    expect(second.enemies[0]!.hp).toBeLessThan(world.enemies[0]!.hp);
    const claimed = applyHitClaims(world, [{ id: 'g:1:e1', playerId: 'p2', enemyId: world.enemies[0]!.id, damage: 0, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: true }]);
    expect(claimed.enemies[0]!.armor).toBeUndefined();
  });

  it('elite trait and armor ride the snapshot and the wire to guests', () => {
    let host: WorldState = spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }), 'golett', vec(430, 300));
    host = { ...host, enemies: host.enemies.map((e) => ({ ...e, elite: 'armored' as const, armor: true as const })) };
    const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: 3, s: hostSnapshot(host) }));
    expect(wire?.t).toBe('snap');
    const snap = wire!.t === 'snap' ? wire!.s : hostSnapshot(host);
    const guest = applyHostSnapshot(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), role: 'guest', localId: 'p2' }), snap);
    expect(guest.enemies[0]).toMatchObject({ elite: 'armored', armor: true });
  });

  it('mixed squads combine roles in one room, from their depth on', () => {
    for (const squad of SIMA_SQUADS) {
      const roles = new Set(squad.members.map((s) => ENEMY_BEHAVIOUR[s]?.kind));
      expect(roles.size, squad.members.join('+')).toBeGreaterThanOrEqual(2);
      expect(squad.members.length).toBeLessThanOrEqual(ENDLESS.spawns.maxPerRoom);
    }
    let squads = 0;
    for (const seed of SEEDS) {
      for (const floor of generated(30)) {
        const floorPlan = generateFloor(floorSeed(seed, floor), floor, endlessSpawns(ENDLESS, floor));
        const mixed = simaSquads(floorPlan, floorSeed(seed, floor), floor, SIMA_SQUADS);
        expect(mixed).toEqual(simaSquads(floorPlan, floorSeed(seed, floor), floor, SIMA_SQUADS));
        const before = new Map<number, number>();
        for (const s of floorPlan.spawns) before.set(s.room, (before.get(s.room) ?? 0) + 1);
        const after = new Map<number, number>();
        for (const s of mixed.spawns) after.set(s.room, (after.get(s.room) ?? 0) + 1);
        // Squads replace a room's enemies: they never add any.
        for (const [room, n] of after) expect(n).toBeLessThanOrEqual(before.get(room) ?? 0);
        for (const room of after.keys()) {
          const species = mixed.spawns.filter((s) => s.room === room).map((s) => s.species);
          const squad = SIMA_SQUADS.find((q) => q.members.length === species.length && q.members.every((m, i) => m === species[i]));
          if (squad && species.join() !== floorPlan.spawns.filter((s) => s.room === room).map((s) => s.species).join()) {
            squads++;
            expect(floor).toBeGreaterThanOrEqual(squad.minDepth);
          }
        }
      }
    }
    expect(squads).toBeGreaterThan(5);
  });
});
