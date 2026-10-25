import { describe, expect, it } from 'vitest';
import { COOP_REVIVE } from '../../src/data/party-scaling';
import { TIERS, type Difficulty } from '../../src/data/difficulty';
import { followToFloor, startRun } from '../../src/core/run';
import type { GameEvent, RemotePlayer, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec, type Vec2 } from '../../src/core/vec';
import { createPlayer, createWorld } from '../../src/core/world';
import { input } from './helpers';

const HOLD_TICKS = Math.ceil(COOP_REVIVE.holdMs / FIXED_DT_MS);

const ally = (pos: Vec2, hp = 100): RemotePlayer => ({ id: 'p2', player: { ...createPlayer(pos), hp }, projectiles: [] });

/** The local player down at (300, 300), an ally standing at `allyPos`. */
function downed(allyPos: Vec2, difficulty?: Difficulty): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(300, 300), party: 2, ...(difficulty ? { difficulty } : {}) });
  return { ...base, remotes: [ally(allyPos)], player: { ...base.player, hp: 0 } };
}

function play(w: WorldState, ticks: number, each?: (w: WorldState, i: number) => WorldState): { world: WorldState; events: GameEvent[] } {
  let current = w;
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    if (each) current = each(current, i);
    current = step(current, input(), FIXED_DT_MS);
    events.push(...current.events);
  }
  return { world: current, events };
}

describe('co-op revive (core/revive.ts)', () => {
  it('solo a fainted player stays down and the world gets no revive state', () => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(300, 300) });
    const { world } = play({ ...base, player: { ...base.player, hp: 0 } }, HOLD_TICKS + 10);
    expect(world.player.hp).toBe(0);
    expect('revive' in world).toBe(false);
  });

  it('an ally standing next to a fainted player for 3 s gets it up at 30 % HP', () => {
    const { world, events } = play(downed(vec(320, 300)), HOLD_TICKS + 1);
    expect(world.player.hp).toBe(Math.round(world.player.maxHp * COOP_REVIVE.hpShare));
    expect(events.filter((e) => e.type === 'revived')).toEqual([{ type: 'revived', by: 'p2' }]);
  });

  it('is not instant: a tick short of 3 s the player is still down', () => {
    const { world } = play(downed(vec(320, 300)), HOLD_TICKS - 2);
    expect(world.player.hp).toBe(0);
    expect(world.revive?.ms).toBeGreaterThan(COOP_REVIVE.holdMs * 0.9);
  });

  it('an ally out of reach does nothing', () => {
    const { world } = play(downed(vec(300 + COOP_REVIVE.radius + 30, 300)), HOLD_TICKS * 2);
    expect(world.player.hp).toBe(0);
  });

  it('a fainted ally cannot revive', () => {
    const w = downed(vec(320, 300));
    const { world } = play({ ...w, remotes: [ally(vec(320, 300), 0)] }, HOLD_TICKS * 2);
    expect(world.player.hp).toBe(0);
  });

  it('the helper being hurt starts the count again', () => {
    const half = Math.floor(HOLD_TICKS / 2);
    const { world, events } = play(downed(vec(320, 300)), HOLD_TICKS + 2, (w, i) =>
      i === half ? { ...w, remotes: w.remotes.map((r) => ({ ...r, player: { ...r.player, hp: r.player.hp - 10 } })) } : w,
    );
    expect(world.player.hp).toBe(0);
    expect(events.some((e) => e.type === 'reviveInterrupted')).toBe(true);
  });

  it('walking away starts the count again', () => {
    const half = Math.floor(HOLD_TICKS / 2);
    const away = (w: WorldState, i: number) => (i === half ? { ...w, remotes: [{ ...w.remotes[0]!, player: { ...w.remotes[0]!.player, pos: vec(600, 300) } }] } : i === half + 1 ? { ...w, remotes: [ally(vec(320, 300))] } : w);
    const { world } = play(downed(vec(320, 300)), HOLD_TICKS + 2, away);
    expect(world.player.hp).toBe(0);
  });

  it('once per player per floor; the next floor allows it again', () => {
    const first = play(downed(vec(320, 300)), HOLD_TICKS + 1).world;
    expect(first.player.hp).toBeGreaterThan(0);
    const again = play({ ...first, player: { ...first.player, hp: 0 } }, HOLD_TICKS * 2).world;
    expect(again.player.hp).toBe(0);
    const started = startRun(1, { party: 2 });
    const next = followToFloor(started.run, { ...again, remotes: [ally(vec(0, 0))] }, 2).world;
    expect(next.revive).toBeUndefined();
  });

  it('nightmare forbids it (TIERS data)', () => {
    expect(TIERS.nightmare.coopRevive).toBe(false);
    expect(TIERS.hard.coopRevive).toBeUndefined();
    const { world } = play(downed(vec(320, 300), 'nightmare'), HOLD_TICKS * 2);
    expect(world.player.hp).toBe(0);
  });
});
