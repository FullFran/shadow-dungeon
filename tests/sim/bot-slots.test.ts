import { describe, expect, it } from 'vitest';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { BOT_PROFILES, createBot, type BotKind } from '../../src/sim/bots';
import { observe, type Observation, type SeenEnemy } from '../../src/sim/observe';

const NO_EXIT = { exit: null };

/** Mimikyu (four default slots) with three tough dormant Gastlys around it. */
function crowd(): WorldState {
  const base = createWorld({ seed: 2, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) });
  let w: WorldState = { ...base, player: { ...base.player, disguiseBroken: true } };
  for (const pos of [vec(430, 300), vec(400, 330), vec(372, 290)]) w = spawnEnemy(w, 'gastly', pos, { dormant: true });
  return { ...w, enemies: w.enemies.map((e) => ({ ...e, hp: 9999, maxHp: 9999 })) };
}

function play(world: WorldState, kind: BotKind, ticks: number, slots: boolean) {
  const bot = createBot(kind, 5, BOT_PROFILES[kind], { slots });
  let w = world;
  const inputs: PlayerInput[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const input = bot.decide(observe(w), NO_EXIT);
    inputs.push(input);
    w = step(w, input, FIXED_DT_MS);
    events.push(...w.events);
  }
  return { inputs, events };
}

const started = (events: GameEvent[], id: string) => events.some((e) => e.type === 'moveStarted' && e.moveId === id);

describe('bots and the four slots', () => {
  it('by default a bot only ever uses the fast slot (four entries, boost and area never pressed: the same play as before four-slots)', () => {
    const { inputs } = play(crowd(), 'perfect', 120, false);
    for (const input of inputs) {
      expect(input.slots).toHaveLength(4);
      expect(input.slotMouse).toHaveLength(4);
      expect(input.slots.slice(1)).toEqual([false, false, false]);
    }
  });

  it('with slots on, the perfect and average bots use the area move on a cluster', () => {
    for (const kind of ['perfect', 'average'] as const) {
      const { events } = play(crowd(), kind, 120, true);
      expect(started(events, 'dazzling-gleam'), kind).toBe(true);
    }
  });

  it('with slots on, they cast the boost before a boss', () => {
    const base = observe(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300) }));
    const boss: SeenEnemy = { id: 'b', pos: vec(400, 200), radius: 16, facing: vec(0, 1), hp: 500, maxHp: 500, boss: true, mode: 'idle' as SeenEnemy['mode'], attackDir: vec(0, 1), windup: null, zone: null, pierceRoll: false };
    const screen: Observation = { ...base, tick: 10, timeMs: 500, enemies: [boss] };
    const input = createBot('perfect', 1, BOT_PROFILES.perfect, { slots: true }).decide(screen, NO_EXIT);
    expect(input.slots[2]).toBe(true);
    // A boost already running (or on cooldown) is not cast again.
    const buffed: Observation = { ...screen, self: { ...screen.self, buffed: true } };
    expect(createBot('perfect', 1, BOT_PROFILES.perfect, { slots: true }).decide(buffed, NO_EXIT).slots[2]).toBeFalsy();
  });

  it('the novice and the masher never use them, even with slots on', () => {
    for (const kind of ['novice', 'masher'] as const) {
      const { inputs } = play(crowd(), kind, 120, true);
      expect(inputs.some((i) => i.slots[2] || i.slots[3]), kind).toBe(false);
    }
  });
});
