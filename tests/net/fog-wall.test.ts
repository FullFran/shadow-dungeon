import { describe, expect, it } from 'vitest';
import { closeFogWall } from '../../src/core/fog-wall';
import { partyAgreed, type GatherMember } from '../../src/core/gather';
import { atLeavingPoint, progressRun, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { CRYPT } from '../../src/data/dungeons';
import { input } from '../core/helpers';
import { coopLoop, ticksOf } from './coop-loop';

/** The fog wall over the wire (odd/tasks/coop-flow.md T4): the host crosses once everyone is at the fog; the guest crosses on its snapshot. */
const SEED = 909;
const FLOOR = CRYPT.plan.length;

const boss = (localId: string, role: 'host' | 'guest') => startRun(SEED, { localId, role }, FLOOR, CRYPT.id);
const toFog = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, pos: vec(world.player.pos.x, world.fogWall!.line + 14) } });

function loop() {
  return coopLoop((guestId) => ({ host: closeFogWall(boss('p1', 'host').world), guest: closeFogWall(boss(guestId, 'guest').world) }), FLOOR);
}

function hostMembers(l: ReturnType<typeof loop>): GatherMember[] {
  const run = boss('p1', 'host').run;
  return [
    { alive: true, active: true, ready: true },
    ...l.hostWorld.remotes.map((r) => {
      const status = l.host.status(r.id, l.floor);
      return { alive: r.player.hp > 0, active: status?.active ?? false, ready: (status?.ready ?? false) && atLeavingPoint(run, l.hostWorld, r.player.pos) };
    }),
  ];
}

describe('fog wall over the wire', () => {
  it('the fight starts only when every active player stands at the fog, and the guest crosses with the host', () => {
    const l = loop();
    l.hostWorld = toFog(l.hostWorld);
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    // The guest is still at the back of the antechamber: the host waits.
    expect(partyAgreed(hostMembers(l))).toBe(false);
    expect(l.guestWorld.enemies).toEqual([]);

    l.guestWorld = toFog(l.guestWorld);
    l.guest.setStatus({ ready: true, afk: false });
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(partyAgreed(hostMembers(l))).toBe(true);

    const crossed = progressRun(boss('p1', 'host').run, l.hostWorld, true);
    expect(crossed.crossed).toBe(true);
    l.hostWorld = crossed.world;
    expect(l.hostWorld.enemies.some((e) => e.boss)).toBe(true);
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(l.guestWorld.fogWall).toBeUndefined();
    expect(l.guestWorld.enemies.some((e) => e.alive)).toBe(true);
  });
});
