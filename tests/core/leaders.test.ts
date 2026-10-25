import { describe, expect, it } from 'vitest';
import { CRYPT_SPAWNS } from '../../src/data/dungeon';
import { BREAK_RULE, LEADER, roleOf, threatOf } from '../../src/data/encounters';
import { ENDLESS } from '../../src/data/endless';
import { SPECIES, type SpeciesId } from '../../src/data/species';
import { generateFloor } from '../../src/core/dungeon';
import { enemyXp, xpFor, creditDefeats } from '../../src/core/progression';
import { assignLeaders, bandTimeScale, leaderChance, updateLeaders } from '../../src/core/leaders';
import { startRun } from '../../src/core/run';
import type { EnemyState, GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE } from './helpers';

const CRYPT_LEADERS = CRYPT_SPAWNS.budget!.leaders!;

/** A world with a leader at (300, 300) and its followers beside it, all awake, the player far away. */
function band(followers: readonly SpeciesId[]): WorldState {
  let w = createWorld({ seed: 4, arena: { width: 1200, height: 900 }, playerPos: vec(1100, 800) });
  w = spawnEnemy(w, 'golett', vec(300, 300), { leader: true });
  followers.forEach((s, i) => (w = spawnEnemy(w, s, vec(340 + i * 30, 300))));
  const leaderId = w.enemies[0]!.id;
  return { ...w, player: { ...w.player, disguiseBroken: true }, enemies: w.enemies.map((e, i) => (i === 0 ? e : { ...e, band: leaderId })) };
}

/** The world with enemy `id` (or the `index`th one) down. */
const fell = (w: WorldState, id: string | number): WorldState => {
  const target = typeof id === 'number' ? w.enemies[id]!.id : id;
  return downed(w, target);
};
const downed = (w: WorldState, id: string): WorldState => ({ ...w, enemies: w.enemies.map((e) => (e.id === id ? { ...e, alive: false, hp: 0 } : e)) });

describe('leaders: who leads', () => {
  it('crowns at most one enemy per group of two or more, the one of highest threat, from the seed alone', () => {
    let crowned = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const drawn = generateFloor(seed, 5, CRYPT_SPAWNS);
      const floor = assignLeaders(drawn, seed, 5, CRYPT_LEADERS);
      expect(assignLeaders(drawn, seed, 5, CRYPT_LEADERS)).toEqual(floor);
      // Only the flag changes: the same species on the same tiles.
      expect(floor.spawns.map(({ leader: _l, ...s }) => s)).toEqual(drawn.spawns);
      floor.rooms.forEach((_, room) => {
        const here = floor.spawns.filter((s) => s.room === room);
        const leaders = here.filter((s) => s.leader);
        expect(leaders.length).toBeLessThanOrEqual(1);
        if (leaders.length === 1) {
          crowned++;
          expect(here.length).toBeGreaterThanOrEqual(2);
          expect(threatOf(leaders[0]!.species)).toBe(Math.max(...here.map((s) => threatOf(s.species))));
        }
      });
    }
    expect(crowned).toBeGreaterThan(30);
  });

  it('never leads on the first floor and leads more groups deeper (every dungeon and the Sima)', () => {
    expect(leaderChance(CRYPT_LEADERS, 1)).toBe(0);
    expect(leaderChance(CRYPT_LEADERS, 5)).toBeGreaterThan(leaderChance(CRYPT_LEADERS, 2));
    const sima = ENDLESS.spawns.budget!.leaders!;
    expect(leaderChance(sima, 30)).toBeGreaterThan(leaderChance(sima, 4));
    const leaders = (floor: number) => [...Array(60).keys()].reduce((n, seed) => n + startRun(seed + 1, {}, floor).world.enemies.filter((e) => e.leader).length, 0);
    expect(leaders(1)).toBe(0);
    expect(leaders(5)).toBeGreaterThan(leaders(2));
  });

  it('spawns a leader tougher, and its group follows it by id', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { world } = startRun(seed, {}, 5);
      for (const leader of world.enemies.filter((e) => e.leader)) {
        expect(leader.maxHp).toBeCloseTo(SPECIES[leader.species].maxHp * LEADER.hp);
        const followers = world.enemies.filter((e) => e.band === leader.id);
        expect(followers.length).toBeGreaterThanOrEqual(1);
        for (const f of followers) expect(f.leader).toBeUndefined();
      }
    }
  });
});

describe('leaders: the fall breaks the group', () => {
  it('breaks each follower by its role: a brute reels, a skirmisher slows, a controller only loses the pace', () => {
    expect([BREAK_RULE[roleOf('pumpkaboo-super')], BREAK_RULE[roleOf('poochyena')], BREAK_RULE[roleOf('foongus')]]).toEqual(['stagger', 'slow', 'unbuff']);
    const w = band(['pumpkaboo-super', 'poochyena', 'foongus']);
    const [leader, brute, skirm, ctrl] = w.enemies as EnemyState[];
    expect([brute, skirm, ctrl].map((e) => bandTimeScale(e!))).toEqual([LEADER.inspiredPace, LEADER.inspiredPace, LEADER.inspiredPace]);
    const events: GameEvent[] = [];
    const after = updateLeaders(fell(w, leader!.id), FIXED_DT_MS, events);
    const [, b, s, c] = after.enemies;
    expect(events.filter((e) => e.type === 'leaderFell')).toEqual([{ type: 'leaderFell', enemyId: leader!.id, followers: 3 }]);
    for (const e of [b, s, c]) expect(e!.band).toBeUndefined();
    expect(b!.broken?.rule).toBe('stagger');
    expect(b!.hitstunMs).toBeGreaterThanOrEqual(LEADER.break.staggerMs - FIXED_DT_MS);
    expect(s!.broken?.rule).toBe('slow');
    expect(bandTimeScale(s!)).toBe(LEADER.break.slowPace);
    expect(c!.broken?.rule).toBe('unbuff');
    expect(bandTimeScale(c!)).toBe(1);
    // Once: a second step does not break them again.
    const again: GameEvent[] = [];
    updateLeaders(after, FIXED_DT_MS, again);
    expect(again.filter((e) => e.type === 'leaderFell')).toEqual([]);
  });

  it('lets the break wear off', () => {
    let w = updateLeaders(fell(band(['poochyena']), 0), FIXED_DT_MS, []);
    const ticks = Math.ceil(LEADER.break.slowMs / FIXED_DT_MS) + 2;
    for (let i = 0; i < ticks; i++) w = updateLeaders(w, FIXED_DT_MS, []);
    expect(w.enemies[1]!.broken).toBeUndefined();
    expect(bandTimeScale(w.enemies[1]!)).toBe(1);
  });

  it('pays the leader bonus experience, and the followers their own', () => {
    expect(enemyXp({ species: 'golett', leader: { rallyMs: 0 } }, 3)).toBeCloseTo(xpFor('golett', 3) * LEADER.xp);
    expect(enemyXp({ species: 'golett' }, 3)).toBe(xpFor('golett', 3));
    const w = fell(band(['poochyena']), 0);
    expect(creditDefeats(w, []).player.xp).toBeCloseTo(xpFor('golett', 1) * LEADER.xp);
  });
});

describe('leaders: the rally cry', () => {
  it('winds up, then heals the followers in reach and readies their next attack', () => {
    const start = band(['poochyena']);
    let w: WorldState = { ...start, enemies: start.enemies.map((e, i) => (i === 1 ? { ...e, hp: e.maxHp * 0.5, ai: { ...e.ai, cooldownMs: 900 } } : e)) };
    const events: GameEvent[] = [];
    const ticks = Math.ceil((LEADER.rally.firstMs + LEADER.rally.telegraphMs) / FIXED_DT_MS) + 2;
    for (let i = 0; i < ticks; i++) w = updateLeaders(w, FIXED_DT_MS, events);
    const phases = events.filter((e) => e.type === 'leaderRally').map((e) => (e.type === 'leaderRally' ? e.phase : ''));
    expect(phases).toEqual(['windup', 'cry']);
    const follower = w.enemies[1]!;
    expect(follower.hp).toBeCloseTo(follower.maxHp * (0.5 + LEADER.rally.heal));
    expect(follower.ai.cooldownMs).toBe(0);
    expect(w.enemies[0]!.leader).toEqual({ rallyMs: LEADER.rally.everyMs });
  });

  it('never calls asleep, nor with nobody left to call', () => {
    const asleep = band(['poochyena']);
    let w: WorldState = { ...asleep, enemies: asleep.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'asleep' } })) };
    const events: GameEvent[] = [];
    for (let i = 0; i < Math.ceil(LEADER.rally.firstMs / FIXED_DT_MS) + 10; i++) w = updateLeaders(w, FIXED_DT_MS, events);
    let alone = fell(band(['poochyena']), 1);
    for (let i = 0; i < Math.ceil(LEADER.rally.firstMs / FIXED_DT_MS) + 10; i++) alone = updateLeaders(alone, FIXED_DT_MS, events);
    expect(events.filter((e) => e.type === 'leaderRally')).toEqual([]);
  });
});

describe('leaders: shared runs', () => {
  it('a guest crowns the same leaders from the seed, keeps them through snapshots, and breaks the band when the host shows it down', () => {
    let seed = 1;
    while (!startRun(seed, {}, 5).world.enemies.some((e) => e.leader)) seed++;
    const host = startRun(seed, {}, 5).world;
    const fresh = startRun(seed, { role: 'guest', localId: 'p2' }, 5).world;
    const leader = host.enemies.find((e) => e.leader)!;
    expect(fresh.enemies.map((e) => [e.id, e.leader !== undefined, e.band ?? null])).toEqual(host.enemies.map((e) => [e.id, e.leader !== undefined, e.band ?? null]));
    let guest = step(applyHostSnapshot(fresh, hostSnapshot(host)), IDLE, FIXED_DT_MS);
    expect(guest.enemies.find((e) => e.id === leader.id)!.leader).toBeDefined();
    guest = step(applyHostSnapshot(guest, hostSnapshot(fell(host, leader.id))), IDLE, FIXED_DT_MS);
    const followers = guest.enemies.filter((e) => host.enemies.find((h) => h.id === e.id)?.band === leader.id);
    expect(followers.length).toBeGreaterThan(0);
    for (const f of followers) {
      expect(f.band).toBeUndefined();
      expect(f.broken).toBeDefined();
    }
    // The guest credits its own player the leader's bonus too.
    expect(guest.player.xp).toBeCloseTo(enemyXp(leader, 5));
  });
});
