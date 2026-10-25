import { describe, expect, it } from 'vitest';
import { BOSS_AGGRO } from '../../src/data/party-scaling';
import { DECIDUEYE, TREVENANT } from '../../src/data/enemies';
import { aggroTarget, noteAggroDamage } from '../../src/core/aggro';
import { behaviourAt, behaviourFor } from '../../src/core/tricks';
import type { GameEvent, RemotePlayer, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHitClaims } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createPlayer, createWorld, spawnEnemy } from '../../src/core/world';
import { input } from './helpers';

const remote = (id: string, pos: Vec2): RemotePlayer => {
  const player = createPlayer(pos);
  return { id, player: { ...player, maxHp: 99999, hp: 99999 }, projectiles: [] };
};

/** A boss between the local player and `others` remotes, everyone sturdy enough to stand there. */
function arena(party: number, others: RemotePlayer[], species: 'aegislash' | 'trevenant' = 'aegislash'): WorldState {
  const base = createWorld({ seed: 2, arena: { width: 800, height: 600 }, playerPos: vec(200, 300) });
  const w: WorldState = { ...base, ...(party > 1 ? { party } : {}), remotes: others, player: { ...base.player, maxHp: 99999, hp: 99999, disguiseBroken: true } };
  return spawnEnemy(w, species, vec(400, 300));
}

interface Turn {
  tick: number;
  targetId: string;
  mode: string;
}

function play(w: WorldState, ms: number): { world: WorldState; turns: Turn[]; events: GameEvent[] } {
  let current = w;
  const turns: Turn[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; i < Math.round(ms / FIXED_DT_MS); i++) {
    const before = current.enemies[0]!.ai.mode;
    current = step(current, input(), FIXED_DT_MS);
    events.push(...current.events);
    for (const e of current.events) if (e.type === 'bossAggro') turns.push({ tick: current.tick, targetId: e.targetId, mode: before });
  }
  return { world: current, turns, events };
}

describe('boss aggro by party (core/aggro.ts)', () => {
  it('solo the boss keeps the nearest-player rule and gets no aggro state', () => {
    const { world, turns } = play(arena(1, []), 8000);
    expect(world.enemies[0]!.aggro).toBeUndefined();
    expect(turns).toEqual([]);
  });

  it('with two players the boss turns from one to the other every few seconds', () => {
    const { turns } = play(arena(2, [remote('p2', vec(600, 300))]), 20000);
    // The first look plus at least two timed switches, alternating.
    expect(turns.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < turns.length; i++) expect(turns[i]!.targetId).not.toBe(turns[i - 1]!.targetId);
    const gaps = turns.slice(1).map((t, i) => (t.tick - turns[i]!.tick) * FIXED_DT_MS);
    for (const gap of gaps) expect(gap).toBeGreaterThanOrEqual(BOSS_AGGRO.switchMs - FIXED_DT_MS);
  });

  it('never turns mid wind-up or mid attack (the telegraphed player is the one it hits)', () => {
    const { turns } = play(arena(3, [remote('p2', vec(600, 300)), remote('p3', vec(400, 500))]), 30000);
    expect(turns.length).toBeGreaterThan(2);
    // Every turn after the first look happens outside a telegraph or an attack.
    for (const t of turns.slice(1)) expect(['telegraph', 'attack']).not.toContain(t.mode);
  });

  it('a switch that falls due mid wind-up waits for the attack to end', () => {
    const w = arena(2, [remote('p2', vec(600, 300))]);
    const first = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, []).enemy;
    const due = { ...first, aggro: { ...first.aggro!, heldMs: BOSS_AGGRO.switchMs, swung: true as const } };
    for (const mode of ['telegraph', 'attack'] as const) {
      const winding = { ...due, ai: { ...due.ai, mode } };
      expect(aggroTarget({ ...w, enemies: [winding] }, winding, FIXED_DT_MS, []).target.id).toBe('p1');
    }
    const resting = { ...due, ai: { ...due.ai, mode: 'recover' as const } };
    expect(aggroTarget({ ...w, enemies: [resting] }, resting, FIXED_DT_MS, []).target.id).toBe('p2');
  });

  it('a timed switch waits until it has attacked its target once', () => {
    const w = arena(2, [remote('p2', vec(600, 300))]);
    const first = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, []).enemy;
    const idle = { ...first, aggro: { ...first.aggro!, heldMs: BOSS_AGGRO.switchMs * 3 } };
    expect(aggroTarget({ ...w, enemies: [idle] }, idle, FIXED_DT_MS, []).target.id).toBe('p1');
  });

  it('turns at once towards a player who hurts it hard while it looks elsewhere', () => {
    let w = arena(2, [remote('p2', vec(600, 300))]);
    const events: GameEvent[] = [];
    const first = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, events);
    expect(first.target.id).toBe('p1');
    w = { ...w, enemies: [first.enemy] };
    const boss = first.enemy;
    const heavy = Math.ceil(BOSS_AGGRO.pressureShare * boss.maxHp);
    w = applyHitClaims(w, [{ id: 'c1', playerId: 'p2', enemyId: boss.id, damage: heavy, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false }]);
    expect(w.enemies[0]!.aggro?.by).toBe('p2');
    const next = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, events);
    expect(next.target.id).toBe('p2');
    expect(events.at(-1)).toEqual({ type: 'bossAggro', enemyId: boss.id, targetId: 'p2' });
  });

  it('a little chip damage from the other player does not turn it', () => {
    const w = arena(2, [remote('p2', vec(600, 300))]);
    const first = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, []);
    const chipped = noteAggroDamage(first.enemy, 'p2', 1);
    expect(aggroTarget({ ...w, enemies: [chipped] }, chipped, FIXED_DT_MS, []).target.id).toBe('p1');
  });

  it('a fallen target is dropped for the nearest standing player', () => {
    const w = arena(2, [remote('p2', vec(600, 300))]);
    const first = aggroTarget(w, w.enemies[0]!, FIXED_DT_MS, []);
    const down = { ...w, enemies: [first.enemy], player: { ...w.player, hp: 0 } };
    expect(aggroTarget(down, first.enemy, FIXED_DT_MS, []).target.id).toBe('p2');
  });

  it('is deterministic: the same fight turns at the same ticks', () => {
    const make = () => arena(3, [remote('p2', vec(600, 300)), remote('p3', vec(400, 500))]);
    expect(play(make(), 15000).turns).toEqual(play(make(), 15000).turns);
  });
});

describe('party area cards (data/party-tricks.ts)', () => {
  it('two players change nothing; three add one area card the boss already knows', () => {
    expect(behaviourAt('trevenant', 'easy', 1)).toBe(behaviourFor('trevenant', 'easy'));
    expect(behaviourAt('trevenant', 'easy', 2)).toBe(behaviourFor('trevenant', 'easy'));
    expect((behaviourAt('trevenant', 'easy', 3) as typeof TREVENANT).cards).toEqual([...TREVENANT.cards, 'roots']);
    expect((behaviourAt('decidueye', 'easy', 4) as typeof DECIDUEYE).cards).toEqual([...DECIDUEYE.cards, 'fan']);
  });

  it('composes over the tier: a hard-tier card stays in', () => {
    const hard = behaviourFor('trevenant', 'hard') as typeof TREVENANT;
    expect((behaviourAt('trevenant', 'hard', 3) as typeof TREVENANT).cards).toEqual([...hard.cards, 'roots']);
  });

  it('a boss without a party trick is the same behaviour at any size', () => {
    expect(behaviourAt('aegislash', 'nightmare', 4)).toBe(behaviourFor('aegislash', 'nightmare'));
  });

  it('a three-player Trevenant plays the extra roots card in its rotation', () => {
    const w = arena(3, [remote('p2', vec(300, 420)), remote('p3', vec(500, 420))], 'trevenant');
    const { events } = play({ ...w, player: { ...w.player, pos: vec(400, 380) } }, 40000);
    const stances = events.flatMap((e) => (e.type === 'bossStance' ? [e.stance] : [])).filter((s) => s !== 'slam');
    const cards = TREVENANT.cards.length + 1;
    expect(stances.length).toBeGreaterThanOrEqual(cards);
    expect(stances.slice(0, cards)).toEqual([...TREVENANT.cards, 'roots']);
  });
});
