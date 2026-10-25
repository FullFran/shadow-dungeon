import { expect } from 'vitest';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { LagTransport } from '../../src/net/lag';
import { createSession, type NetSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';
import { SPECIES } from '../../src/data/species';

/**
 * Host and guest worlds of a co-op test stepped side by side over an
 * in-memory lagged transport (fake clock, seeded jitter), like
 * tests/net/loopback.test.ts, with the worlds made by the test.
 */
const LAG = { lagMs: 80, jitterMs: 15, loss: 0 };

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface CoopLoop {
  host: NetSession;
  guest: NetSession;
  hostWorld: WorldState;
  guestWorld: WorldState;
  hostEvents: GameEvent[];
  guestEvents: GameEvent[];
  /** The floor both peers report (their epoch). */
  floor: number;
  tick(hostInput: PlayerInput, guestInput: PlayerInput): void;
}

export function coopLoop(worlds: (guestId: string) => { host: WorldState; guest: WorldState }, floor = 1): CoopLoop {
  const scheduler = createFakeScheduler(5000);
  const hub = createMemoryHub<string>();
  const random = seeded(11);
  const host = createSession({ transport: new LagTransport(hub.connect('tab-a'), { ...LAG, scheduler, random }), scheduler });
  const guest = createSession({ transport: new LagTransport(hub.connect('tab-b'), { ...LAG, scheduler, random }), scheduler });
  host.host(1, floor, 'mimikyu');
  let localId: string | null = null;
  guest.onStart((start) => (localId = start.localId));
  guest.join('mimikyu', SPECIES.mimikyu.defaultLoadout);
  scheduler.advance(400);
  expect(localId).toBe('p2');
  const made = worlds(localId!);
  const loop: CoopLoop = {
    host,
    guest,
    hostWorld: made.host,
    guestWorld: made.guest,
    hostEvents: [],
    guestEvents: [],
    floor,
    tick(hostInput, guestInput) {
      const h = host.beforeStep(loop.hostWorld, loop.floor);
      loop.hostWorld = step(h.world, hostInput, FIXED_DT_MS);
      loop.hostEvents.push(...h.events, ...loop.hostWorld.events);
      host.afterStep(loop.hostWorld, loop.floor);
      const g = guest.beforeStep(loop.guestWorld, loop.floor);
      loop.guestWorld = step(g.world, guestInput, FIXED_DT_MS);
      loop.guestEvents.push(...g.events, ...loop.guestWorld.events);
      guest.afterStep(loop.guestWorld, loop.floor);
      scheduler.advance(FIXED_DT_MS);
    },
  };
  return loop;
}

export const ticksOf = (ms: number): number => Math.round(ms / FIXED_DT_MS);
