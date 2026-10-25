import { describe, expect, it } from 'vitest';
import { clampParty, PARTY_SCALING, partyScaling } from '../../src/data/party-scaling';
import { CRYPT, FOREST, floorsOf } from '../../src/data/dungeons';
import { SPECIES } from '../../src/data/species';
import { hasBossState } from '../../src/core/boss';
import { landHitOnPlayer } from '../../src/core/hits';
import { isBossClass, partyHpScale, partySizeOf, partyStaggerOf, presentPartySize } from '../../src/core/party';
import { followToFloor, startRun } from '../../src/core/run';
import type { GameEvent, RemotePlayer, WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { distance, vec } from '../../src/core/vec';
import { createPlayer, createWorld, spawnEnemy } from '../../src/core/world';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { input, run } from './helpers';

const remote = (id: string, hp?: number): RemotePlayer => {
  const player = createPlayer(vec(200, 200));
  return { id, player: hp === undefined ? player : { ...player, hp }, projectiles: [] };
};

const arena = { width: 1600, height: 1200 };

describe('co-op scaling table (data/party-scaling.ts)', () => {
  it('is all ones solo and follows the provisional table for 2 to 4 players', () => {
    expect(partyScaling(1)).toEqual({ players: 1, bossHp: 1, enemyHp: 1, bossDamage: 1, bossStagger: 1 });
    expect(PARTY_SCALING.map((r) => r.bossHp)).toEqual([1, 1.6, 2.1, 2.6]);
    expect(PARTY_SCALING.map((r) => r.enemyHp)).toEqual([1, 1.25, 1.4, 1.55]);
    expect(PARTY_SCALING.map((r) => r.bossDamage)).toEqual([1, 1, 1.1, 1.15]);
    expect(PARTY_SCALING.map((r) => r.bossStagger)).toEqual([1, 0.6, 0.4, 0.3]);
  });

  it('clamps any party size to 1..4 (an odd value is solo, more than four is four)', () => {
    expect([0, -2, Number.NaN, 2.7, 9].map(clampParty)).toEqual([1, 1, 1, 2, 4]);
    expect(partyScaling(7).players).toBe(4);
  });

  it('is sub-linear: per-player HP of a boss falls as the party grows', () => {
    const perPlayer = PARTY_SCALING.map((r) => r.bossHp / r.players);
    for (let i = 1; i < perPlayer.length; i++) expect(perPlayer[i]!).toBeLessThan(perPlayer[i - 1]!);
  });
});

describe('party size (core/party.ts)', () => {
  it('is 1 solo and the world adds no field for it', () => {
    const w = createWorld({ seed: 1, arena, playerPos: vec(100, 100) });
    expect(partySizeOf(w)).toBe(1);
    expect('party' in w).toBe(false);
    expect('party' in startRun(1, {}).world).toBe(false);
  });

  it('a solo run played on every regular dungeon carries no co-op field (party, revive, aggro)', () => {
    for (const dungeon of [CRYPT, FOREST]) {
      for (const floor of [1, floorsOf(dungeon)]) {
        let w = startRun(9, {}, floor, dungeon.id).world;
        for (let i = 0; i < 400; i++) w = step(w, input({ move: vec(Math.cos(i / 30), Math.sin(i / 45)), slots: [i % 50 < 3, false] }), FIXED_DT_MS);
        expect('party' in w).toBe(false);
        expect('revive' in w).toBe(false);
        expect(w.enemies.some((e) => 'aggro' in e)).toBe(false);
      }
    }
  });

  it('counts the local player and every remote, fainted ones too', () => {
    const w = createWorld({ seed: 1, arena, playerPos: vec(100, 100) });
    expect(presentPartySize({ ...w, remotes: [remote('p2'), remote('p3', 0)] })).toBe(3);
  });

  it('is the roster size at run start (no remotes exist yet on floor 1)', () => {
    expect(partySizeOf(startRun(1, { party: 3 }).world)).toBe(3);
  });

  it('is frozen for the floor and counted again at the next floor entry', () => {
    const started = startRun(1, { party: 3 });
    // One player left mid-floor: nothing changes until the floor ends.
    const left = { ...started.world, remotes: [remote('p2')] };
    expect(partySizeOf(left)).toBe(3);
    const down = followToFloor(started.run, left, 2);
    expect(partySizeOf(down.world)).toBe(2);
  });

  it('classes guardians, mid-bosses and echoes as bosses, the rest as regular enemies', () => {
    for (const s of ['aegislash', 'sableye', 'trevenant', 'decidueye', 'lanturn', 'dhelmise', 'salazzle', 'nihilego', 'eclipse-echo'] as const) expect(isBossClass(s)).toBe(true);
    for (const s of ['poochyena', 'gastly', 'pawniard'] as const) expect(isBossClass(s)).toBe(false);
  });

  it('the boss class is exactly the species with boss state', () => {
    for (const s of Object.keys(SPECIES) as (keyof typeof SPECIES)[]) expect(isBossClass(s)).toBe(hasBossState(s));
  });
});

describe('scaled HP at spawn', () => {
  it('a guardian has ×1.6 / ×2.1 / ×2.6 HP with 2 / 3 / 4 players', () => {
    const last = floorsOf(CRYPT);
    const boss = (party?: number) => startRun(1, party ? { party } : {}, last).world.enemies.find((e) => isBossClass(e.species))!;
    const solo = boss().maxHp;
    expect(boss(2).maxHp).toBeCloseTo(solo * 1.6, 6);
    expect(boss(3).maxHp).toBeCloseTo(solo * 2.1, 6);
    expect(boss(4).maxHp).toBeCloseTo(solo * 2.6, 6);
    expect(boss(4).hp).toBe(boss(4).maxHp);
  });

  it('a mid-boss is a boss too', () => {
    const mid = FOREST.plan.findIndex((p) => p.kind === 'room' && p.role === 'midboss') + 1;
    const boss = (party?: number) => startRun(1, party ? { party } : {}, mid, FOREST.id).world.enemies[0]!;
    expect(boss(2).maxHp).toBeCloseTo(boss().maxHp * 1.6, 6);
  });

  it('regular floor enemies have ×1.25 HP with 2 players, and the count does not change', () => {
    const solo = startRun(5, {}).world;
    const duo = startRun(5, { party: 2 }).world;
    expect(duo.enemies.length).toBe(solo.enemies.length);
    expect(solo.enemies.length).toBeGreaterThan(0);
    duo.enemies.forEach((e, i) => expect(e.maxHp).toBeCloseTo(solo.enemies[i]!.maxHp * 1.25, 6));
  });

  it('partyHpScale reads the class', () => {
    const w = { ...createWorld({ seed: 1, arena, playerPos: vec(100, 100) }), party: 4 };
    expect(partyHpScale(w, 'aegislash')).toBe(2.6);
    expect(partyHpScale(w, 'poochyena')).toBe(1.55);
  });
});

describe('boss damage (victim side)', () => {
  const withBoss = (party: number, bossAlive = true): WorldState => {
    const base = createWorld({ seed: 1, arena, playerPos: vec(400, 400) });
    const w = spawnEnemy({ ...base, ...(party > 1 ? { party } : {}), player: { ...base.player, maxHp: 1000, hp: 1000, disguiseBroken: true } }, 'aegislash', vec(800, 800), { dormant: true });
    return bossAlive ? w : { ...w, enemies: w.enemies.map((e) => ({ ...e, alive: false })) };
  };
  // A small hit: the one-hit cap (core/fairness.ts) stays out of the way.
  const taken = (w: WorldState) => 1000 - landHitOnPlayer(w, { damage: 20 }, [] as GameEvent[]).state.player.hp;

  it('rises ×1.1 with 3 players and ×1.15 with 4 while a boss stands, not with 2', () => {
    expect(taken(withBoss(1))).toBe(20);
    expect(taken(withBoss(2))).toBe(20);
    expect(taken(withBoss(3))).toBe(22);
    expect(taken(withBoss(4))).toBe(23);
  });

  it('does not apply once the boss has fallen', () => {
    expect(taken(withBoss(4, false))).toBe(20);
  });
});

describe('boss stagger', () => {
  it('a boss takes less stagger in a bigger party; a regular enemy takes all of it', () => {
    const w = { ...createWorld({ seed: 1, arena, playerPos: vec(100, 100) }), party: 4 };
    const boss = spawnEnemy(w, 'trevenant', vec(300, 300)).enemies[0]!;
    const grunt = spawnEnemy(w, 'poochyena', vec(300, 300)).enemies[0]!;
    expect(partyStaggerOf(w, boss)).toBe(0.3);
    expect(partyStaggerOf(w, grunt)).toBe(1);
    expect(partyStaggerOf({ ...w, party: undefined }, boss)).toBe(1);
  });

  it('a struck boss is pushed back less with four players', () => {
    const pushed = (party: number): number => {
      const base = createWorld({ seed: 1, arena, playerPos: vec(400, 400) });
      const start = vec(400, 440);
      const w = spawnEnemy({ ...base, ...(party > 1 ? { party } : {}) }, 'trevenant', start, { dormant: true });
      const after = run(w, input({ slots: [true, false], slotMouse: [true, false], aim: vec(400, 460) }), 40, false);
      return distance(after.enemies[0]!.pos, start);
    };
    const solo = pushed(1);
    expect(solo).toBeGreaterThan(0);
    expect(pushed(4) / solo).toBeCloseTo(0.3, 1);
  });
});

describe('the host decides the party size (snapshot)', () => {
  it('a solo snapshot carries no party field', () => {
    expect('party' in hostSnapshot(startRun(1, {}).world)).toBe(false);
  });

  it('a guest that counted differently adopts the host size and rescales its enemies', () => {
    const last = floorsOf(CRYPT);
    const host = startRun(1, { party: 3 }, last).world;
    const guest = startRun(1, { party: 2, role: 'guest', localId: 'p2' }, last).world;
    const synced = applyHostSnapshot(guest, hostSnapshot(host));
    expect(partySizeOf(synced)).toBe(3);
    const boss = synced.enemies.find((e) => isBossClass(e.species))!;
    expect(boss.maxHp).toBeCloseTo(host.enemies.find((e) => isBossClass(e.species))!.maxHp, 6);
    expect(boss.maxHp).toBeCloseTo(SPECIES[boss.species].maxHp * 2.1, 6);
  });
});
