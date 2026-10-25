import { describe, expect, it } from 'vitest';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { createBot, type BotKind } from '../../src/sim/bots';
import { cameraRect, observe, type Observation } from '../../src/sim/observe';

const NO_EXIT = { exit: null };

/** A lone Poochyena next to a player whose Disguise is already gone (every hit counts). */
function duel(seed = 3): WorldState {
  const base = createWorld({ seed, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });
  return spawnEnemy({ ...base, player: { ...base.player, disguiseBroken: true } }, 'poochyena', vec(400, 220));
}

/** Plays `ticks` steps of `world` with a bot; returns the inputs, the damage taken and the final world. */
function play(world: WorldState, kind: BotKind, seed: number, ticks: number) {
  const bot = createBot(kind, seed);
  let w = world;
  const inputs: PlayerInput[] = [];
  let damage = 0;
  for (let i = 0; i < ticks; i++) {
    const input = bot.decide(observe(w), NO_EXIT);
    inputs.push(input);
    w = step(w, input, FIXED_DT_MS);
    for (const e of w.events) if (e.type === 'playerHurt') damage += e.damage;
  }
  return { inputs, damage, world: w };
}

/** A synthetic screen: the player at (400, 300) and, from `shotAtMs` on, one enemy shot 40 px away flying at it. */
function screen(timeMs: number, shotAtMs: number): Observation {
  const base = observe(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }));
  const shot = { id: 'p1', pos: vec(360 + ((timeMs - shotAtMs) / 1000) * 200, 300), vel: vec(200, 0), radius: 5, pierceRoll: false };
  return { ...base, tick: Math.round(timeMs / FIXED_DT_MS), timeMs, projectiles: timeMs >= shotAtMs ? [shot] : [] };
}

/** Time of the first roll a bot presses on the synthetic screen. */
function firstRollMs(kind: BotKind): number | null {
  const bot = createBot(kind, 9);
  for (let i = 0; i < 60; i++) {
    const t = i * FIXED_DT_MS;
    if (bot.decide(screen(t, 300), NO_EXIT).roll) return t;
  }
  return null;
}

describe('balance bots', () => {
  it('replay the same inputs from the same seed, and an imperfect bot plays differently with another seed', () => {
    const a = play(duel(), 'average', 11, 600);
    const b = play(duel(), 'average', 11, 600);
    expect(b.inputs).toEqual(a.inputs);
    expect(b.world).toEqual(a.world);
    const c = play(duel(), 'average', 12, 600);
    expect(c.inputs).not.toEqual(a.inputs);
  });

  it('the perfect bot dodges a lone Poochyena and kills it; the masher takes its hits', () => {
    const perfect = play(duel(), 'perfect', 1, 60 * 20);
    expect(perfect.damage).toBe(0);
    expect(perfect.world.enemies.every((e) => !e.alive)).toBe(true);
    const masher = play(duel(), 'masher', 1, 60 * 20);
    expect(masher.damage).toBeGreaterThan(0);
  });

  it('react no earlier than their perception lag: perfect at once, average after 230 ms', () => {
    // The shot appears at 300 ms, 40 px away at 200 px/s: it lands in under 200 ms.
    const perfect = firstRollMs('perfect');
    expect(perfect).not.toBeNull();
    expect(perfect!).toBeGreaterThanOrEqual(300);
    expect(perfect!).toBeLessThan(300 + 120);
    const average = firstRollMs('average');
    if (average !== null) expect(average).toBeGreaterThanOrEqual(300 + 230);
  });

  it('see only the camera view: enemies off screen are not observed', () => {
    const base = createWorld({ seed: 1, arena: { width: 2000, height: 2000 }, playerPos: vec(1000, 1000) });
    const w = spawnEnemy(spawnEnemy(base, 'poochyena', vec(1100, 1000)), 'poochyena', vec(1600, 1000));
    const obs = observe(w);
    expect(obs.view).toEqual(cameraRect(vec(1000, 1000), w.arena));
    expect(obs.enemies.map((e) => e.pos.x)).toEqual([1100]);
  });
});
