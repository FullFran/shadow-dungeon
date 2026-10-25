import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import type { GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { distance, normalize, sub, vec } from '../../src/core/vec';
import { lungeTouches } from '../../src/core/victim';
import { LagTransport } from '../../src/net/lag';
import { createSession, type NetSession } from '../../src/net/session';
import { createFakeScheduler, createMemoryHub } from '../../src/net/transport';
import { input } from '../core/helpers';

/**
 * Host and guest worlds stepped side by side over an in-memory transport with
 * simulated lag and jitter on both ends (fake clock, seeded jitter).
 */
const ARENA = { width: 1400, height: 600 };
const LAG = { lagMs: 100, jitterMs: 20, loss: 0 };

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

interface Loop {
  host: NetSession;
  guest: NetSession;
  hostWorld: WorldState;
  guestWorld: WorldState;
  hostEvents: GameEvent[];
  guestEvents: GameEvent[];
  tick(hostInput: PlayerInput, guestInput: PlayerInput): void;
}

function loopback(hostPos = vec(100, 300), guestPos = vec(1000, 300)): Loop {
  const scheduler = createFakeScheduler(5000);
  const hub = createMemoryHub<string>();
  const random = seeded(7);
  const host = createSession({ transport: new LagTransport(hub.connect('tab-a'), { ...LAG, scheduler, random }), scheduler });
  const guest = createSession({ transport: new LagTransport(hub.connect('tab-b'), { ...LAG, scheduler, random }), scheduler });
  host.host(1, 1, 'mimikyu');
  let localId: string | null = null;
  guest.onStart((start) => (localId = start.localId));
  guest.join('mimikyu', ['shadow-claw', 'play-rough']);
  scheduler.advance(400);
  expect(localId).toBe('p2');

  const loop: Loop = {
    host,
    guest,
    hostWorld: createWorld({ seed: 1, arena: ARENA, playerPos: hostPos, localId: 'p1' }),
    guestWorld: createWorld({ seed: 1, arena: ARENA, playerPos: guestPos, localId: localId!, role: 'guest' }),
    hostEvents: [],
    guestEvents: [],
    tick(hostInput, guestInput) {
      const h = host.beforeStep(loop.hostWorld, 1);
      loop.hostWorld = step(h.world, hostInput, FIXED_DT_MS);
      loop.hostEvents.push(...h.events, ...loop.hostWorld.events);
      host.afterStep(loop.hostWorld, 1);
      const g = guest.beforeStep(loop.guestWorld, 1);
      loop.guestWorld = step(g.world, guestInput, FIXED_DT_MS);
      loop.guestEvents.push(...loop.guestWorld.events);
      guest.afterStep(loop.guestWorld, 1);
      scheduler.advance(FIXED_DT_MS);
    },
  };
  return loop;
}

const ticks = (ms: number) => Math.round(ms / FIXED_DT_MS);
const swing = (aim: { x: number; y: number }) => input({ slots: [true, false], slotMouse: [true, false], aim });

describe('two-world loopback over a lagged transport', () => {
  it('both players damage enemies; the host applies the guest claim once and the guest sees both results', () => {
    const loop = loopback();
    loop.hostWorld = spawnEnemy(loop.hostWorld, 'poochyena', vec(135, 300), { dormant: true }); // e1, next to the host
    loop.hostWorld = spawnEnemy(loop.hostWorld, 'poochyena', vec(1035, 300), { dormant: true }); // e2, next to the guest
    for (let i = 0; i < ticks(500); i++) loop.tick(input(), input());
    expect(loop.guestWorld.enemies.map((e) => e.id)).toEqual(['e1', 'e2']);

    loop.tick(swing(vec(300, 300)), swing(vec(1200, 300)));
    for (let i = 0; i < ticks(1500); i++) loop.tick(input(), input());

    const [e1, e2] = loop.hostWorld.enemies;
    expect(e1!.hp).toBeLessThan(e1!.maxHp);
    expect(e2!.hp).toBeLessThan(e2!.maxHp);
    const claimed = loop.guestEvents.flatMap((e) => (e.type === 'hitClaim' ? [e.claim] : []));
    expect(claimed).toHaveLength(1);
    expect(e2!.maxHp - e2!.hp).toBe(claimed[0]!.damage);
    expect(loop.hostEvents.filter((e) => e.type === 'enemyHit' && e.enemyId === 'e2')).toHaveLength(1);
    expect(loop.guestWorld.enemies.map((e) => e.hp)).toEqual(loop.hostWorld.enemies.map((e) => e.hp));
    // The host sees the guest where it reported itself.
    expect(loop.hostWorld.remotes.map((r) => r.id)).toEqual(['p2']);
    expect(distance(loop.hostWorld.remotes[0]!.player.pos, loop.guestWorld.player.pos)).toBeLessThan(1);
  });

  it('a guest that rolls through a lunge on its screen dodges it, though the host-side guest position took it', () => {
    const loop = loopback(vec(100, 300), vec(700, 300));
    loop.hostWorld = spawnEnemy(loop.hostWorld, 'poochyena', vec(900, 300));
    const poochyena = loop.hostWorld.enemies[0]!;
    loop.hostWorld = { ...loop.hostWorld, enemies: [{ ...poochyena, ai: { ...poochyena.ai, mode: 'approach' } }] };

    let rolled = false;
    let hostSideWouldHit = false;
    for (let i = 0; i < ticks(4000) && !loop.guestWorld.enemies.some((e) => e.ai.mode === 'recover'); i++) {
      const seen = loop.guestWorld.enemies.find((e) => e.ai.mode === 'attack');
      let guestInput = input();
      if (seen && !rolled) {
        // React to the lunge as drawn on the guest's screen: roll into it.
        rolled = true;
        guestInput = input({ roll: true, move: normalize(sub(seen.pos, loop.guestWorld.player.pos)) });
      }
      loop.tick(input(), guestInput);
      const enemy = loop.hostWorld.enemies[0]!;
      const remote = loop.hostWorld.remotes[0]?.player;
      if (enemy.ai.mode === 'attack' && remote && lungeTouches(enemy, remote.pos)) hostSideWouldHit = true;
    }

    expect(rolled).toBe(true);
    expect(hostSideWouldHit).toBe(true);
    expect(loop.guestEvents.some((e) => e.type === 'hitDodged' || e.type === 'perfectDodge')).toBe(true);
    expect(loop.guestEvents.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken')).toBe(false);
    expect(loop.guestWorld.player.hp).toBe(TUNING.player.maxHp);
    // The host never judges a remote player's hits.
    expect(loop.hostWorld.remotes[0]!.player.hp).toBe(TUNING.player.maxHp);
  });
});
