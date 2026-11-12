import { describe, expect, it } from 'vitest';
import { BRONZOR, HONEDGE, KLEFKI, MURKROW, YAMASK } from '../../src/data/crypt-enemies';
import { ITEM_IDS } from '../../src/data/items';
import { TUNING } from '../../src/data/tuning';
import { wakeEnemies } from '../../src/core/activation';
import { placeGate } from '../../src/core/gates';
import { generateFloor } from '../../src/core/dungeon';
import { CRYPT } from '../../src/data/dungeons';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { loadFloor } from '../../src/core/floor';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import type { HostSnapshot } from '../../src/core/sync';
import { IDLE } from './helpers';

/** A host snapshot through the wire and back, as a guest receives it. */
function wire(state: WorldState): HostSnapshot {
  const back = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: 1, s: hostSnapshot(state) }));
  if (!back || back.t !== 'snap') throw new Error('snapshot did not round-trip');
  return back.s;
}

function arena(species: EnemyState['species'], pos: Vec2, playerPos: Vec2): WorldState {
  return spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos }), species, pos);
}

const byId = (s: WorldState, id: string) => s.enemies.find((e) => e.id === id)!;

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 900, input: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, input, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

const firstIn = (mode: string) => (s: WorldState) => s.enemies[0]!.ai.mode === mode;

describe('Honedge (boomerang)', () => {
  it('spins out down the locked lane and flies back to where it started; the way back is a second pass', () => {
    const start = arena('honedge', vec(300, 300), vec(440, 300));
    const thrown = stepUntil(start, firstIn('attack')).state;
    const origin = thrown.enemies[0]!.ai.aimPoint!;
    expect(thrown.enemies[0]!.ai.attack).toBe('out');
    const far = stepUntil(thrown, (s) => s.enemies[0]!.ai.attack === 'back', 300).state;
    expect(distance(far.enemies[0]!.pos, origin)).toBeGreaterThan(HONEDGE.reach * 0.8);
    expect(far.enemies[0]!.ai.contact).toBe('none');
    const home = stepUntil(far, firstIn('recover'), 300).state;
    expect(distance(home.enemies[0]!.pos, origin)).toBeLessThan(4);
    expect(home.enemies[0]!.ai.modeDurationMs).toBe(HONEDGE.recoverMs);
  });

  it('hits on the way out and again on the way back when the player stays in the lane', () => {
    // The player stands still in the lane; a hit is a hurt or the first one Mimikyu's disguise takes.
    const start = arena('honedge', vec(300, 300), vec(420, 300));
    const { events } = stepUntil(start, (s) => s.enemies[0]!.ai.mode === 'recover', 900);
    expect(events.filter((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken').length).toBe(2);
  });

  it('a guest is hit by both passes too (the pass name restarts its contact)', () => {
    const host = stepUntil(arena('honedge', vec(300, 300), vec(700, 100)), firstIn('attack')).state;
    const guest0 = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: host.enemies[0]!.pos });
    const out = applyHostSnapshot({ ...guest0, role: 'guest' }, wire(host));
    const events: GameEvent[] = [];
    const hitOut = guestEnemyContacts(out, events);
    expect(hitOut.enemies[0]!.ai.contact).not.toBe('none');
    const back = stepUntil(host, (s) => s.enemies[0]!.ai.attack === 'back', 300).state;
    const guest = applyHostSnapshot({ ...hitOut, player: { ...hitOut.player, pos: back.enemies[0]!.pos } }, wire(back));
    expect(guest.enemies[0]!.ai.contact).toBe('none');
  });
});

describe('Bronzor (support)', () => {
  it('rings itself when an awake ally is near and wards it with one-hit armor', () => {
    let s = arena('bronzor', vec(300, 300), vec(520, 300));
    s = spawnEnemy(s, 'poochyena', vec(340, 300));
    const ally = s.enemies[1]!.id;
    const ringing = stepUntil(s, firstIn('telegraph')).state;
    expect(ringing.enemies[0]!.ai.attack).toBe('ward');
    expect(ringing.enemies[0]!.ai.modeDurationMs).toBeGreaterThanOrEqual(BRONZOR.channelMs * 0.5);
    const done = stepUntil(ringing, firstIn('recover'), 400).state;
    expect(byId(done, ally).armor).toBe(true);
    expect(done.enemies[0]!.armor).toBeUndefined();
  });

  it('never channels alone, and a hit during the ring cancels it (no armor)', () => {
    const alone = stepUntil(arena('bronzor', vec(300, 300), vec(520, 300)), firstIn('telegraph'), 300).state;
    expect(alone.enemies[0]!.ai.mode).not.toBe('telegraph');
    let s = arena('bronzor', vec(300, 300), vec(520, 300));
    s = spawnEnemy(s, 'poochyena', vec(340, 300));
    const ringing = stepUntil(s, firstIn('telegraph')).state;
    const struck = { ...ringing, enemies: ringing.enemies.map((e, i) => (i === 0 ? { ...e, hitstunMs: 200 } : e)) };
    const after = stepUntil(struck, (x) => x.enemies[0]!.hitstunMs <= 0, 60).state;
    expect(after.enemies[0]!.ai.mode).not.toBe('telegraph');
    expect(after.enemies[1]!.armor).toBeUndefined();
  });

  it('the ward travels to guests with the snapshot', () => {
    let s = arena('bronzor', vec(300, 300), vec(520, 300));
    s = spawnEnemy(s, 'poochyena', vec(340, 300));
    const done = stepUntil(stepUntil(s, firstIn('telegraph')).state, firstIn('recover'), 400).state;
    const guest = applyHostSnapshot({ ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(520, 300) }), role: 'guest' }, wire(done));
    expect(guest.enemies[1]!.armor).toBe(true);
  });
});

describe('Yamask (mimic)', () => {
  const room = { x: 0, y: 0, width: 800, height: 600 };

  it('asleep it ignores the player entering its room and wakes only up close, rising before it acts', () => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 300) });
    const s = spawnEnemy(base, 'yamask', vec(400, 300), { sleepIn: room });
    expect(wakeEnemies(s).enemies[0]!.ai.mode).toBe('asleep');
    const close = wakeEnemies({ ...s, player: { ...s.player, pos: vec(400 - YAMASK.disguise.wakeRadius + 10, 300) } });
    expect(close.enemies[0]!.ai.mode).toBe('telegraph');
    expect(close.enemies[0]!.ai.attack).toBe('wake');
    const risen = stepUntil(close, (x) => x.enemies[0]!.ai.attack !== 'wake', 120).state;
    expect(risen.enemies[0]!.ai.mode).toBe('reposition');
    expect(risen.projectiles.filter((p) => p.owner === 'enemy')).toHaveLength(0);
  });

  it('a regular sleeper in the same room still wakes on entering it', () => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 300) });
    const s = spawnEnemy(base, 'gastly', vec(400, 300), { sleepIn: room });
    expect(wakeEnemies(s).enemies[0]!.ai.mode).toBe('reposition');
  });

  it('its cursed ball slows the stamina recharge of the player it hurts, for a while, on host and guest alike', () => {
    const s = arena('yamask', vec(300, 300), vec(420, 300));
    const hurt = stepUntil(s, (x) => (x.player.cursedMs ?? 0) > 0, 1200).state;
    expect(hurt.player.cursedMs).toBeGreaterThan(0);
    const drained = { ...hurt, enemies: [], projectiles: [], player: { ...hurt.player, stamina: 0, staminaRegenDelayMs: 0 } };
    const after = step(drained, IDLE, 100);
    const plain = step({ ...drained, player: { ...drained.player, cursedMs: undefined } }, IDLE, 100);
    expect(after.player.stamina).toBeLessThan(plain.player.stamina * 0.6);
    const cured = stepUntil(drained, (x) => x.player.cursedMs === undefined, Math.ceil(YAMASK.projectile.curse!.ms / FIXED_DT_MS) + 5).state;
    expect(cured.player.cursedMs).toBeUndefined();
    // The curse rides the wire with the shot.
    const flying = stepUntil(s, (x) => x.projectiles.some((p) => p.owner === 'enemy'), 600).state;
    const sent = wire(flying);
    expect(sent.projectiles[0]!.curseMs).toBe(YAMASK.projectile.curse!.ms);
  });
});

describe('Murkrow (diver)', () => {
  it('a dive that hurts takes the last held item, then it flies off; felling it gives the item back', () => {
    const item = ITEM_IDS[0]!;
    const base = arena('murkrow', vec(300, 300), vec(460, 300));
    const s = { ...base, player: { ...base.player, items: [item] } };
    const robbed = stepUntil(s, (x) => x.player.stolen !== undefined, 1200).state;
    expect(robbed.player.items).toHaveLength(0);
    expect(robbed.player.stolen?.item).toBe(item);
    const fleeing = stepUntil(robbed, firstIn('reposition'), 60).state;
    expect(fleeing.enemies[0]!.ai.attack).toBe('flee');
    const felled = step({ ...fleeing, enemies: fleeing.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) }, IDLE, FIXED_DT_MS);
    expect(felled.player.items).toEqual([item]);
    expect(MURKROW.stealMs).toBeGreaterThan(0);
  });
});

describe('Klefki (alarm)', () => {
  it('a jingle that completes wakes the sleepers in its reach (a disguised one rises), a hit cancels it', () => {
    const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(520, 300) });
    let s = spawnEnemy(base, 'klefki', vec(300, 300));
    s = spawnEnemy(s, 'gastly', vec(100, 100), { sleepIn: { x: 0, y: 0, width: 150, height: 150 } });
    s = spawnEnemy(s, 'yamask', vec(150, 500), { sleepIn: { x: 100, y: 450, width: 100, height: 100 } });
    const ringing = stepUntil(s, firstIn('telegraph')).state;
    expect(ringing.enemies[0]!.ai.attack).toBe('jingle');
    const done = stepUntil(ringing, firstIn('recover'), Math.ceil(KLEFKI.jingleMs / FIXED_DT_MS) * 2).state;
    expect(done.enemies[1]!.ai.mode).not.toBe('asleep');
    expect(done.enemies[2]!.ai.mode === 'telegraph' && done.enemies[2]!.ai.attack === 'wake').toBe(true);
    const struck = { ...ringing, enemies: ringing.enemies.map((e, i) => (i === 0 ? { ...e, hitstunMs: 200 } : e)) };
    const cut = stepUntil(struck, (x) => x.enemies[0]!.hitstunMs <= 0, 60).state;
    expect(cut.enemies[1]!.ai.mode).toBe('asleep');
  });

  it('carries the floor key on a key gate: it takes it from whoever would carry it otherwise', () => {
    let found = 0;
    for (let seed = 1; seed < 40 && found < 3; seed++) {
      const floor = generateFloor(seed, 4, CRYPT.spawns);
      const world = loadFloor(createWorld({ seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), floor);
      const plain = placeGate(world, 'key', floor).gate;
      if (!plain || plain.kind !== 'key' || !plain.target) continue;
      // Any other enemy that could bear it (reachable, outside the stairs room) takes it once it is a Klefki.
      for (const other of world.enemies.filter((e) => e.alive && e.id !== plain.target)) {
        const swapped = { ...world, enemies: world.enemies.map((e) => (e.id === other.id ? { ...e, species: 'klefki' as const } : e)) };
        const gate = placeGate(swapped, 'key', floor).gate;
        if (gate?.target === other.id) {
          found++;
          break;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    expect(TUNING.player.radius).toBeGreaterThan(0);
  });
});
