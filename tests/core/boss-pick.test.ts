import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHALLENGES, DUNGEONS, ECLIPSE, floorsOf, planAt, SENDA_ROADS, type DungeonDef } from '../../src/data/dungeons';
import { isHeraldFloor } from '../../src/data/endless';
import { onStairs } from '../../src/core/floor';
import { rewardOffer } from '../../src/core/sima-events';
import { bossPickDue, chooseItem, floorPlanOf, followToFloor, picksAfterReturn, progressRun, returnToFloor, startRun, strayHere, withFogWall, withRewardOffer, type RunState } from '../../src/core/run';
import { crossFogWall } from '../../src/core/fog-wall';
import type { WorldState } from '../../src/core/state';
import { runDungeon } from '../../src/sim/runner';

const SEED = 4242;
const ALL: readonly DungeonDef[] = [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS];
const FLOORS = (d: DungeonDef): number => Math.min(floorsOf(d), 32);
const NONE: ReadonlySet<number> = new Set();

const felled = (world: WorldState): WorldState => ({ ...world, enemies: world.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) });

/** The player on the floor's stairs. */
function onTheStairs(world: WorldState): WorldState {
  const s = world.arena.stairs!;
  const pos = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
  expect(onStairs({ ...world, player: { ...world.player, pos } }, pos)).toBe(true);
  return { ...world, gate: undefined, player: { ...world.player, pos } };
}

describe('no item pick on entering a floor (S1)', () => {
  it('a run started on any floor of any dungeon offers nothing', () => {
    for (const d of ALL) for (let floor = 1; floor <= FLOORS(d); floor++) expect(startRun(SEED, {}, floor, d.id).run.offer).toBeNull();
  });

  it('going down offers nothing, on the host and on a guest that follows', () => {
    const host = startRun(SEED, { localId: 'p1' });
    const down = progressRun(host.run, onTheStairs(host.world));
    expect(down.entered).toBe(true);
    expect(down.run.offer).toBeNull();
    const guest = startRun(SEED, { localId: 'p2', role: 'guest' });
    expect(followToFloor(guest.run, guest.world, 2).run.offer).toBeNull();
  });

  it('an unpicked offer of a shared run stays with the player down the stairs (it is not lost, nor replaced)', () => {
    const host = startRun(SEED, { localId: 'p1' });
    const offered = withRewardOffer(host.run, host.world);
    const down = progressRun(offered, onTheStairs(host.world));
    expect(down.run.floor).toBe(2);
    expect(down.run.offer).toEqual(offered.offer);
    expect(chooseItem(down.run, down.world, 0).world.player.items).toEqual([offered.offer![0]]);
  });
});

describe('a pick after each boss, when the run goes on (S2)', () => {
  it('every boss room that is not the last floor gives one once its enemies are down; a last floor never does', () => {
    for (const d of ALL) {
      for (let floor = 1; floor <= FLOORS(d); floor++) {
        if (planAt(d, floor)?.kind !== 'room') continue;
        const { run, world } = startRun(SEED, {}, floor, d.id);
        expect(bossPickDue(run, world, NONE), `${d.id} ${floor} alive`).toBe(false);
        expect(bossPickDue(run, felled(world), NONE), `${d.id} ${floor} felled`).toBe(floor < floorsOf(d));
      }
    }
  });

  it('a mid-boss of every main dungeon and Senda road is on that list, and no plain generated floor is', () => {
    for (const d of ALL.filter((x) => !x.endless)) {
      const mids = d.plan.flatMap((p, i) => (p.kind === 'room' && p.role === 'midboss' ? [i + 1] : []));
      expect(mids.length, d.id).toBeGreaterThan(0);
      for (const floor of mids) {
        const { run, world } = startRun(SEED, {}, floor, d.id);
        expect(bossPickDue(run, felled(world), NONE)).toBe(true);
      }
      const generated = d.plan.findIndex((p) => p.kind === 'generated') + 1;
      const plain = startRun(SEED, {}, generated, d.id);
      expect(bossPickDue(plain.run, felled(plain.world), NONE)).toBe(false);
    }
  });

  it('the Sima: an echo, a herald and a lost shadow each give one, and only one', () => {
    const at = (floor: number, seed = SEED) => startRun(seed, {}, floor, ECLIPSE.id);
    expect(floorPlanOf(at(5).run)).toMatchObject({ kind: 'room', role: 'echo' });
    expect(isHeraldFloor(ECLIPSE.endless!, 22)).toBe(true);
    let stray: { run: RunState; world: WorldState } | null = null;
    for (let seed = 1; seed < 400 && !stray; seed++) for (let floor = 12; floor < 30 && !stray; floor++) {
      const candidate = at(floor, seed);
      if (strayHere(candidate.run)) stray = candidate;
    }
    expect(stray).not.toBeNull();
    for (const { run, world } of [at(5), at(10), at(22), stray!]) {
      expect(bossPickDue(run, felled(world), NONE)).toBe(true);
      expect(bossPickDue(run, felled(world), new Set([run.floor]))).toBe(false);
    }
  });

  it('never while the boss still waits behind its fog; once crossed and felled, yes', () => {
    const { run, world } = startRun(SEED, {}, 3);
    const behind = withFogWall(run, world);
    expect(behind.fogWall).toBeDefined();
    expect(bossPickDue(run, behind, NONE)).toBe(false);
    expect(bossPickDue(run, crossFogWall(behind), NONE)).toBe(false);
    expect(bossPickDue(run, felled(crossFogWall(behind)), NONE)).toBe(true);
  });

  it('a stray floor left by its antechamber stairs gives no pick (the shadow did not fall)', () => {
    let found = false;
    for (let seed = 1; seed < 400 && !found; seed++) for (let floor = 12; floor < 30 && !found; floor++) {
      const { run, world } = startRun(seed, {}, floor, ECLIPSE.id);
      if (!strayHere(run)) continue;
      found = true;
      expect(bossPickDue(run, withFogWall(run, world), NONE)).toBe(false);
    }
    expect(found).toBe(true);
  });

  it('each peer has its own offer, from the same state (a guest reads the boss down from its own world)', () => {
    const host = startRun(SEED, { localId: 'p1' }, 3);
    const guest = startRun(SEED, { localId: 'p2', role: 'guest' }, 3);
    expect(bossPickDue(guest.run, felled(guest.world), NONE)).toBe(true);
    const mine = withRewardOffer(host.run, host.world).offer!;
    const theirs = withRewardOffer(guest.run, guest.world).offer!;
    expect(mine).toEqual(rewardOffer(SEED, 3, 'p1', []));
    expect(theirs).toEqual(rewardOffer(SEED, 3, 'p2', []));
    expect(mine).toHaveLength(3);
  });

  it('a bonfire return gives nothing for a boss already paid, and the floors after it pay again', () => {
    const paid = new Set([3, 6]);
    const kept = picksAfterReturn(paid, 3);
    expect([...kept]).toEqual([3]);
    const back = returnToFloor(startRun(SEED, {}, 5).run, startRun(SEED, {}, 5).world, 3);
    expect(back.run.floor).toBe(3);
    expect(back.run.offer).toBeNull();
    expect(bossPickDue(back.run, felled(back.world), kept)).toBe(false);
  });

  it('the game wires it: picks only outside a shrine trial (tests/core/shrine.test.ts: no offer there either), once per boss, the bonfire keeps the item, and a lost shadow says its own line', () => {
    const game = readFileSync(join(__dirname, '../../src/app/game.ts'), 'utf8');
    expect(game).toMatch(/if \(trial \|\| !bossPickDue\(run, world, bossPicks\)\) return;/);
    expect(game).toMatch(/bossPicks\.add\(run\.floor\)/);
    expect(game).toMatch(/strayHere\(run\) \? 'sima\.stray\.reward' : 'pick\.boss'/);
    expect(game).toMatch(/if \(bonfire && bonfire\.run\.floor === run\.floor\) bonfire = \{ \.\.\.bonfire, world: chooseItem\(run, bonfire\.world, index\)\.world \}/);
    expect(game).toMatch(/bossPicks = picksAfterReturn\(bossPicks, back\.run\.floor\)/);
    expect(game).not.toMatch(/watchStray/);
    // "Restart floor" brings the boss back, not its pick: only the bonfire return touches the paid floors.
    const restart = game.slice(game.indexOf('function restartFloor'), game.indexOf('function restartFloor') + 1500);
    expect(restart).not.toMatch(/bossPicks/);
  });

});

describe('the sim bot takes the pick (S6)', () => {
  it('a won run of the Crypt holds an item for its mid-boss, and none for its guardian', () => {
    const result = runDungeon({ dungeon: 'crypt-of-the-sword-king', tier: 'easy', bot: 'perfect', party: 1, seed: 7 });
    expect(result.outcome).toBe('victory');
    const byFloor = new Map(result.floors.map((f) => [f.floor, f.items]));
    // Floor 3 is the mid-boss: one more item leaving it than entering it.
    expect(byFloor.get(3)!).toBe(byFloor.get(2)! + 1);
    expect(byFloor.get(6)!).toBe(byFloor.get(5)!);
  });
});
