import { describe, expect, it } from 'vitest';
import { CRYPT, floorsOf } from '../../src/data/dungeons';
import { SPECIES } from '../../src/data/species';
import { isBossClass, partySizeOf } from '../../src/core/party';
import { startRun } from '../../src/core/run';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input } from '../core/helpers';
import { coopLoop, ticksOf } from './coop-loop';

const LAST = floorsOf(CRYPT);

describe('co-op scaling over the wire', () => {
  it('the snapshot carries the party size, and an older snapshot without it still decodes', () => {
    const host = startRun(1, { party: 3 }, LAST).world;
    const wire = encodeMessage({ t: 'snap', at: 1, floor: LAST, s: hostSnapshot(host) });
    const back = decodeMessage(wire);
    expect(back?.t === 'snap' && back.s.party).toBe(3);
    const old = JSON.parse(wire) as Record<string, unknown>;
    delete old.n;
    const decoded = decodeMessage(JSON.stringify(old));
    expect(decoded?.t === 'snap' && 'party' in decoded.s).toBe(false);
  });

  it('host and guest agree on the party size and the boss HP, even when the guest counted alone', () => {
    const loop = coopLoop(
      (guestId) => ({
        host: startRun(1, { party: 2, localId: 'p1' }, LAST).world,
        // The guest's roster had not arrived yet: it counted itself only.
        guest: startRun(1, { role: 'guest', localId: guestId }, LAST).world,
      }),
      LAST,
    );
    expect(partySizeOf(loop.guestWorld)).toBe(1);
    for (let i = 0; i < ticksOf(800); i++) loop.tick(input(), input());
    expect(partySizeOf(loop.hostWorld)).toBe(2);
    expect(partySizeOf(loop.guestWorld)).toBe(2);
    const hostBoss = loop.hostWorld.enemies.find((e) => isBossClass(e.species))!;
    const guestBoss = loop.guestWorld.enemies.find((e) => e.id === hostBoss.id)!;
    expect(hostBoss.maxHp).toBeCloseTo(SPECIES[hostBoss.species].maxHp * 1.6, 6);
    expect(guestBoss.maxHp).toBeCloseTo(hostBoss.maxHp, 6);
    expect(guestBoss.hp).toBeCloseTo(hostBoss.hp, 1);
  });

  it('a regular floor scales the same on both peers', () => {
    const loop = coopLoop((guestId) => ({
      host: startRun(4, { party: 2, localId: 'p1' }).world,
      guest: startRun(4, { party: 2, role: 'guest', localId: guestId }).world,
    }));
    for (let i = 0; i < ticksOf(600); i++) loop.tick(input(), input());
    expect(loop.hostWorld.remotes.length).toBe(1);
    expect(loop.guestWorld.remotes.length).toBe(1);
    const solo = startRun(4, {}).world;
    for (const e of loop.guestWorld.enemies) {
      const base = solo.enemies.find((s) => s.id === e.id)!;
      expect(e.maxHp).toBeCloseTo(base.maxHp * 1.25, 6);
    }
  });
});

describe('boss aggro over the wire', () => {
  it('the host boss turns to the guest, and the guest sees its wind-up aimed at itself', () => {
    const loop = coopLoop((guestId) => {
      const host = createWorld({ seed: 3, arena: { width: 800, height: 600 }, playerPos: vec(150, 300), localId: 'p1', party: 2 });
      const guest = createWorld({ seed: 3, arena: { width: 800, height: 600 }, playerPos: vec(560, 300), localId: guestId, role: 'guest', party: 2 });
      const sturdy = (w: typeof host) => ({ ...w, player: { ...w.player, maxHp: 99999, hp: 99999, disguiseBroken: true } });
      return { host: spawnEnemy(sturdy(host), 'aegislash', vec(400, 300)), guest: sturdy(guest) };
    });
    let aimedAtGuest = false;
    for (let i = 0; i < ticksOf(20000); i++) {
      loop.tick(input(), input());
      const seen = loop.guestWorld.enemies[0];
      const looking = loop.hostWorld.enemies[0]!.aggro?.targetId === 'p2';
      if (looking && seen && seen.ai.mode === 'telegraph' && seen.ai.attackDir.x > 0.5) aimedAtGuest = true;
    }
    const turns = loop.hostEvents.flatMap((e) => (e.type === 'bossAggro' ? [e.targetId] : []));
    expect(turns).toContain('p1');
    expect(turns).toContain('p2');
    expect(aimedAtGuest).toBe(true);
    // The guest never simulates aggro: its copy of the boss has none.
    expect(loop.guestWorld.enemies[0]!.aggro).toBeUndefined();
  });
});
