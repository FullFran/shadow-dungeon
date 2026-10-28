import { describe, expect, it } from 'vitest';
import { crossFogWall } from '../../src/core/fog-wall';
import { atLeavingPoint, floorMusic } from '../../src/core/run';
import { gauntletStops, heraldStop, progressSharedTrial, progressTrial, SHRINE_BOSSES, startTrial, trialStepMs } from '../../src/core/shrine';
import type { WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { SHRINE } from '../../src/data/shrine';

/** Shrine trials behind a fog wall (odd/tasks/shrine-fog.md T1). */
const stops = [...SHRINE_BOSSES, heraldStop(12345)];
const atFog = (world: WorldState): WorldState => ({ ...world, player: { ...world.player, pos: vec(world.player.pos.x, world.fogWall!.line + 14) } });
const fell = (world: WorldState): WorldState => ({ ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });

describe('shrine fog wall', () => {
  it('every trial arena opens behind its fog, the boss held back', () => {
    for (const stop of stops) {
      const { world } = startTrial(7, {}, [stop]);
      expect(world.fogWall, stop.boss).toBeDefined();
      expect(world.enemies).toEqual([]);
      expect(crossFogWall(world).enemies.some((e) => e.boss || e.herald), stop.boss).toBe(true);
    }
  });

  it('nothing is won behind the fog; touching it is the leaving point; crossing restores the arena', () => {
    const { run, world, trial } = startTrial(7, {}, [SHRINE_BOSSES[0]!]);
    expect(progressTrial(trial, run, world, 100).outcome).toBeNull();
    expect(atLeavingPoint(run, atFog(world), atFog(world).player.pos)).toBe(true);
    // The party agreed (the gather rule), or, without `agreed` (harnesses), the player touching the fog.
    const agreed = progressTrial(trial, run, world, 100, true);
    expect(agreed.crossed).toBe(true);
    expect(agreed.world.fogWall).toBeUndefined();
    expect(progressTrial(trial, run, world, 100, false).crossed).toBeUndefined();
    const touched = progressTrial(trial, run, atFog(world), 100);
    expect(touched.crossed).toBe(true);
    expect(touched.entered).toBe(false);
  });

  it('each next arena of a gauntlet also waits behind its fog', () => {
    const start = startTrial(7, {}, gauntletStops('oaths'));
    const fought = fell(crossFogWall(start.world));
    const next = progressTrial(start.trial, start.run, fought, SHRINE.pauseMs + 100);
    expect(next.entered).toBe(true);
    expect(next.world.fogWall).toBeDefined();
    expect(next.world.enemies).toEqual([]);
  });

  it('a guest never crosses on its own (it follows the host snapshot), and catches up behind the fog', () => {
    const { run, world, trial } = startTrial(7, { localId: 'p2', role: 'guest' }, gauntletStops('oaths'));
    expect(progressSharedTrial(trial, run, atFog(world), 100, 'guest', null).crossed).toBeUndefined();
    expect(progressSharedTrial(trial, run, world, 100, 'guest', null, true).crossed).toBeUndefined();
    const caught = progressSharedTrial(trial, run, world, 10, 'guest', 3);
    expect(caught.trial.index).toBe(2);
    expect(caught.world.fogWall).toBeDefined();
    const host = startTrial(7, { localId: 'p1', role: 'host' }, gauntletStops('oaths'));
    expect(progressSharedTrial(host.trial, host.run, host.world, 100, 'host', null, true).crossed).toBe(true);
  });

  it('no music behind the fog; the arena track once crossed', () => {
    const { run, world } = startTrial(7, {}, [SHRINE_BOSSES[0]!]);
    expect(floorMusic(run, world)).toBeNull();
    expect(floorMusic(run, crossFogWall(world))).not.toBeNull();
  });

  it('trial time does not run behind the fog', () => {
    const { world } = startTrial(7, {}, [SHRINE_BOSSES[0]!]);
    expect(trialStepMs(world, 16)).toBe(0);
    expect(trialStepMs(crossFogWall(world), 16)).toBe(16);
  });

  it('the fog travels over the net: the guest crosses when the host snapshot drops it', () => {
    const host = startTrial(7, { localId: 'p1', role: 'host', party: 2 }, [SHRINE_BOSSES[0]!]);
    const guest = startTrial(7, { localId: 'p2', role: 'guest', party: 2 }, [SHRINE_BOSSES[0]!]).world;
    expect(applyHostSnapshot(guest, hostSnapshot(host.world)).fogWall).toBeDefined();
    const crossed = progressSharedTrial(host.trial, host.run, host.world, 100, 'host', null, true).world;
    const followed = applyHostSnapshot(guest, hostSnapshot(crossed));
    expect(followed.fogWall).toBeUndefined();
    expect(followed.enemies.length).toBe(crossed.enemies.length);
  });
});
