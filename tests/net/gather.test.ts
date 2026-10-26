import { describe, expect, it } from 'vitest';
import { partyAgreed, waitingFor, type GatherMember } from '../../src/core/gather';
import { atLeavingPoint, progressRun, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { STALE_MS } from '../../src/net/session';
import { input } from '../core/helpers';
import { coopLoop, ticksOf } from './coop-loop';

/** The stairs gather over the wire (odd/tasks/coop-flow.md T3): ready and AFK travel with each state; the host waits for every active player. */
const SEED = 777;

const toStairs = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, pos: vec(world.arena.stairs!.x + 16, world.arena.stairs!.y + 16) } });

function loop() {
  return coopLoop((guestId) => ({ host: startRun(SEED, { localId: 'p1', role: 'host' }).world, guest: startRun(SEED, { localId: guestId, role: 'guest' }).world }));
}

/** The host's view of the party, as app/game.ts builds it. */
function hostMembers(l: ReturnType<typeof loop>, hostReady: boolean): GatherMember[] {
  const run = startRun(SEED, { localId: 'p1', role: 'host' }).run;
  return [
    { alive: true, active: true, ready: hostReady },
    ...l.hostWorld.remotes.map((r) => {
      const status = l.host.status(r.id, l.floor);
      return { alive: r.player.hp > 0, active: status?.active ?? false, ready: (status?.ready ?? false) && atLeavingPoint(run, l.hostWorld, r.player.pos) };
    }),
  ];
}

describe('gather over the wire', () => {
  it('the host waits for a guest until it stands on the stairs and confirms', () => {
    const l = loop();
    l.hostWorld = toStairs(l.hostWorld);
    l.guestWorld = toStairs(l.guestWorld);
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(waitingFor(hostMembers(l, true))).toBe(1);
    expect(partyAgreed(hostMembers(l, true))).toBe(false);
    l.guest.setStatus({ ready: true, afk: false });
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(l.host.status('p2', l.floor)).toEqual({ ready: true, active: true });
    expect(partyAgreed(hostMembers(l, true))).toBe(true);
    expect(progressRun(startRun(SEED, { localId: 'p1', role: 'host' }).run, l.hostWorld, partyAgreed(hostMembers(l, true))).run.floor).toBe(2);
  });

  it('a ready flag from a guest off the stairs does not count (the host checks where it stands)', () => {
    const l = loop();
    l.guest.setStatus({ ready: true, afk: false });
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(partyAgreed(hostMembers(l, true))).toBe(false);
  });

  it('an AFK guest, or one gone silent (hidden tab), is not waited for', () => {
    const afk = loop();
    afk.guest.setStatus({ ready: false, afk: true });
    for (let i = 0; i < ticksOf(400); i++) afk.tick(input(), input());
    expect(afk.host.status('p2', afk.floor)?.active).toBe(false);
    expect(partyAgreed(hostMembers(afk, true))).toBe(true);

    const silent = loop();
    for (let i = 0; i < ticksOf(400); i++) silent.tick(input(), input());
    expect(silent.host.status('p2', silent.floor)?.active).toBe(true);
    expect(partyAgreed(hostMembers(silent, true))).toBe(false);
    // The guest's tab is hidden: its frames stop, so does its state.
    const host = silent.host;
    for (let i = 0; i < ticksOf(STALE_MS + 200); i++) {
      silent.hostWorld = host.beforeStep(silent.hostWorld, silent.floor).world;
      host.afterStep(silent.hostWorld, silent.floor);
      silent.scheduler.advance(FIXED_DT_MS);
    }
    expect(host.status('p2', silent.floor)?.active).toBe(false);
    expect(partyAgreed(hostMembers(silent, true))).toBe(true);
  });

  it('a status heard on another floor is not this floor', () => {
    const l = loop();
    l.guest.setStatus({ ready: true, afk: false });
    for (let i = 0; i < ticksOf(400); i++) l.tick(input(), input());
    expect(l.host.status('p2', l.floor + 1)).toBeNull();
  });
});
