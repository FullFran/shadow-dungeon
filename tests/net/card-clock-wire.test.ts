import { describe, expect, it } from 'vitest';
import { bossBar } from '../../src/core/boss';
import { isDeclaring, spellOf } from '../../src/core/cards';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import type { RoomId } from '../../src/data/rooms';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE } from '../core/helpers';

/**
 * A guest sees the same card clock as the host (odd/tasks/last-phase-and-timer.md
 * S3): the snap carries each card boss's clock (time left and the card's
 * timer), and with it the hosted card in play and the hold flag, which the
 * wire used to drop. An older host sends none: the guest shows no clock.
 */
const guestWorld = (): WorldState => ({ ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 100), difficulty: 'normal' }), role: 'guest', localId: 'p2' });

const wire = (w: WorldState) => {
  const decoded = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: 3, s: hostSnapshot(w) }));
  if (decoded?.t !== 'snap') throw new Error('not a snap');
  return decoded.s;
};

function playing(room: RoomId): WorldState {
  const s0 = loadRoom(createWorld({ seed: 3, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: 'normal' }), room);
  let w: WorldState = { ...s0, player: { ...s0.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
  const boss = () => w.enemies.find((e) => e.boss)!;
  for (let t = 0; t < 8000 && (boss().ai.mode === 'idle' || isDeclaring(boss()) || (boss().boss?.cardMs ?? 0) < 1500); t += FIXED_DT_MS) {
    w = step(w, IDLE, FIXED_DT_MS);
    w = { ...w, player: { ...w.player, hp: w.player.maxHp } };
  }
  return w;
}

describe('the card clock reaches guests', () => {
  for (const room of ['boss', 'grotto'] as RoomId[]) {
    it(`${room}: the guest's bar shows the host's time left and the card's timer`, () => {
      const host = playing(room);
      const hostBar = bossBar(host)!;
      expect(hostBar.cardLeftMs).toBeGreaterThan(0);
      expect(hostBar.cardTimerMs).toBeGreaterThanOrEqual(hostBar.cardLeftMs!);
      const guest = applyHostSnapshot(guestWorld(), wire(host));
      const bar = bossBar(guest)!;
      expect(bar.cardLeftMs).toBeCloseTo(hostBar.cardLeftMs!, -1);
      expect(bar.cardTimerMs).toBe(hostBar.cardTimerMs);
    });
  }

  it('a hosted card in play and the hold flag travel too (a guest captures a hosted card like the host)', () => {
    const host = playing('grotto');
    const boss = host.enemies.find((e) => e.boss)!;
    expect(spellOf(boss.boss)).toBeDefined();
    const held = { ...host, enemies: host.enemies.map((e) => (e.id === boss.id ? { ...e, boss: { ...e.boss!, held: true as const } } : e)) };
    const seen = applyHostSnapshot(guestWorld(), wire(held)).enemies.find((e) => e.id === boss.id)!;
    expect(spellOf(seen.boss)).toBe(spellOf(boss.boss));
    expect(seen.boss!.held).toBe(true);
  });

  it('the clock goes when the host stops sending it (a declaration), and an older host sends none', () => {
    const host = playing('boss');
    const guest = applyHostSnapshot(guestWorld(), wire(host));
    const boss = host.enemies.find((e) => e.boss)!;
    const declaring = { ...host, enemies: host.enemies.map((e) => (e.id === boss.id ? { ...e, ai: { ...e.ai, mode: 'transform' as const } } : e)) };
    expect(bossBar(applyHostSnapshot(guest, wire(declaring)))!.cardLeftMs).toBeUndefined();
    // A plain enemy carries no card side channel.
    const plain = spawnEnemy({ ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 100) }), role: 'host', localId: 'p1' }, 'gastly', vec(400, 300));
    expect(encodeMessage({ t: 'snap', at: 1, floor: 1, s: hostSnapshot(plain) })).not.toContain('"c"');
  });

  it('a malformed card entry on the wire is dropped', () => {
    const host = playing('boss');
    const raw = JSON.parse(encodeMessage({ t: 'snap', at: 1, floor: 3, s: hostSnapshot(host) })) as Record<string, unknown>;
    expect(Array.isArray(raw.c)).toBe(true);
    for (const bad of [[[1, 2, 3, 0, 0]], [['x', 'a', 3, 0, 0]], 'nope', [[ 'x', -5, 1000, 0, 0 ]]]) {
      const decoded = decodeMessage(JSON.stringify({ ...raw, c: bad }));
      if (decoded?.t !== 'snap') throw new Error('not a snap');
      expect(decoded.s.enemies.every((e) => e.boss?.clock === undefined)).toBe(true);
    }
  });
});
