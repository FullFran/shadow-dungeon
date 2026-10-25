import { describe, expect, it } from 'vitest';
import { landHitOnPlayer } from '../../src/core/hits';
import { startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { FloorRecorder, maxOverlap } from '../../src/sim/metrics';
import { applyParty, partyScaling } from '../../src/sim/party';
import { arenaFloors, runDungeon, runFloor, type Scenario } from '../../src/sim/runner';

const CRYPT = 'crypt-of-the-sword-king' as const;
const base: Scenario = { dungeon: CRYPT, tier: 'easy', bot: 'average', party: 1, seed: 3 };

/** A world one tick later with `events` (time advanced by `ms`). */
const later = (w: WorldState, ms: number, events: GameEvent[], patch: Partial<WorldState> = {}): WorldState => ({ ...w, ...patch, timeMs: w.timeMs + ms, tick: w.tick + 1, events });

describe('balance runner', () => {
  it('replays a scenario identically and plays the Crypt floor by floor', () => {
    const a = runDungeon(base);
    expect(runDungeon(base)).toEqual(a);
    expect(a.floors.map((f) => f.floor)).toEqual(a.floors.map((_, i) => i + 1));
    expect(a.floors.length).toBeGreaterThan(0);
    for (const f of a.floors) {
      expect(f.timeMs).toBeGreaterThan(0);
      expect(f.maxHitShare).toBeGreaterThanOrEqual(0);
      expect(f.hitsPierce).toBeLessThanOrEqual(f.hits);
    }
  });

  it('plays a boss arena in isolation and times the boss', () => {
    expect(arenaFloors(CRYPT)).toEqual([3, 6]);
    const sableye = runFloor({ ...base, bot: 'perfect' }, 3);
    expect(sableye.boss).toBe('sableye');
    expect(sableye.outcome).toBe('cleared');
    expect(sableye.bossTtkMs).toBeGreaterThan(0);
    expect(sableye.bossTtkMs!).toBeLessThanOrEqual(sableye.timeMs);
  });
});

describe('balance metrics', () => {
  it('counts the most intervals at once (touching ends do not overlap)', () => {
    expect(maxOverlap([])).toBe(0);
    expect(maxOverlap([{ start: 0, end: 10 }, { start: 10, end: 20 }])).toBe(1);
    expect(maxOverlap([{ start: 0, end: 10 }, { start: 5, end: 20 }, { start: 6, end: 7 }])).toBe(3);
  });

  it('times telegraph to attack, splits positional ones, counts hits, the biggest hit and off-screen wind-ups', () => {
    const w0 = spawnEnemy(spawnEnemy(createWorld({ seed: 1, arena: { width: 2000, height: 2000 }, playerPos: vec(1000, 1000) }), 'poochyena', vec(1050, 1000)), 'poochyena', vec(1800, 1000));
    const rec = new FloorRecorder(w0);
    const w1 = later(w0, 100, [
      { type: 'enemyTelegraph', enemyId: 'e1', attack: 'lunge', durationMs: 400 },
      { type: 'enemyTelegraph', enemyId: 'e2', attack: 'lunge', durationMs: 600, pierceRoll: true },
    ]);
    rec.record(w0, w1);
    const w2 = later(w1, 400, [{ type: 'enemyAttack', enemyId: 'e1', attack: 'lunge' }, { type: 'playerHurt', damage: 20 }]);
    rec.record(w1, w2);
    const w3 = later(w2, 200, [{ type: 'enemyAttack', enemyId: 'e2', attack: 'lunge' }, { type: 'playerHurt', damage: 30, pierceRoll: true }, { type: 'enemyAttack', enemyId: 'e1', attack: 'lunge' }]);
    rec.record(w2, w3);
    const m = rec.finish();
    expect(m.telegraphMs).toEqual([400]);
    expect(m.choiceTelegraphMs).toEqual([600]);
    expect(m.maxSimultaneousTelegraphs).toBe(2);
    expect(m.unseenAttacks).toBe(1);
    expect(m.maxSimultaneousUnseen).toBe(1);
    expect(m.untelegraphedAttacks).toBe(1);
    expect(m.hits).toBe(2);
    expect(m.hitsPierce).toBe(1);
    expect(m.damage).toBe(50);
    expect(m.maxHitShare).toBeCloseTo(30 / w0.player.maxHp);
    expect(m.timeMs).toBe(700);
  });

  it('a positional hit says so on its playerHurt event (the harness hook; nothing else changes)', () => {
    const w = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });
    const ready = { ...w, player: { ...w.player, disguiseBroken: true } };
    const plain: GameEvent[] = [];
    const positional: GameEvent[] = [];
    const a = landHitOnPlayer(ready, { damage: 10 }, plain);
    const b = landHitOnPlayer(ready, { damage: 10, pierceRoll: true }, positional);
    expect(plain).toEqual([{ type: 'playerHurt', damage: 10 }]);
    expect(positional).toEqual([{ type: 'playerHurt', damage: 10, pierceRoll: true }]);
    expect(b.state).toEqual(a.state);
  });
});

describe('party adapter', () => {
  it('solo is the world unchanged; a party splits enemy HP between its members (the game has no party scaling yet)', () => {
    expect(partyScaling(3)).toEqual({ enemyHp: 1, bossHp: 1, damage: 1 });
    const { world } = startRun(5, {}, 6, CRYPT);
    expect(applyParty(world, 1)).toBe(world);
    const four = applyParty(world, 4);
    expect(four.enemies[0]!.maxHp).toBeCloseTo(world.enemies[0]!.maxHp / 4);
    expect(four.enemies[0]!.hp).toBeCloseTo(world.enemies[0]!.hp / 4);
    expect(four.enemyScale).toBe(world.enemyScale);
  });
});
