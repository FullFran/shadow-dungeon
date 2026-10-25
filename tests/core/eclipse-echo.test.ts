import { describe, expect, it } from 'vitest';
import {
  coronaPockets,
  coronaTouches,
  eclipseCardCount,
  laneGaps,
  laneXs,
  maxGapDegrees,
  mirrorDirections,
  nooseRadius,
  nooseTouches,
  ringDirections,
  spiralDirections,
} from '../../src/core/eclipse-echo';
import { isBossFloor, startRun } from '../../src/core/run';
import type { GameEvent, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { fromAngle, vec } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { ECLIPSE } from '../../src/data/dungeons';
import { ECLIPSE_ECHO, type EclipseEchoDef } from '../../src/data/enemies';
import type { Difficulty } from '../../src/data/difficulty';
import { behaviourFor } from '../../src/core/tricks';
import { echoAt, ENDLESS } from '../../src/data/endless';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { musicFor, planAt } from '../../src/data/dungeons';
import { IDLE } from './helpers';

const DEF = ECLIPSE_ECHO;
const PLAYER_R = TUNING.player.radius;
const SHOT_R = DEF.shot.radius;
const ARENA = ROOMS.eclipse;
const CENTER = vec(ARENA.width / 2, ARENA.height / 2);

describe('Eclipse Echo: where it fights', () => {
  it('holds every 10th floor; the guardian echoes keep 5, 15, 25... in turn', () => {
    expect([5, 10, 15, 20, 25, 30, 35].map((f) => echoAt(ENDLESS, f).room)).toEqual(['boss', 'eclipse', 'hollow', 'eclipse', 'roost', 'eclipse', 'boss']);
    const { world, run } = startRun(7, {}, 10, 'eclipse-chasm');
    expect(world.enemies.map((e) => e.species)).toEqual(['eclipse-echo']);
    expect(isBossFloor(run)).toBe(false);
    expect(world.enemyScale?.echo).toBe(true);
    expect(musicFor(ECLIPSE, planAt(ECLIPSE, 10)!, 'normal', 10)).toBe('guardian');
  });

  it('plays two cards on floor 10 and one more every 10 floors (one more from hard), at most all six', () => {
    // The extra card from hard comes from data/sima-tricks.ts through behaviourFor (no inline gate).
    const at = (d: Difficulty) => behaviourFor('eclipse-echo', d) as EclipseEchoDef;
    expect([10, 20, 30, 40, 50, 60, 200].map((f) => eclipseCardCount(at('easy'), f))).toEqual([2, 3, 4, 5, 6, 6, 6]);
    expect(at('easy')).toBe(DEF);
    expect(eclipseCardCount(at('normal'), 10)).toBe(2);
    expect(eclipseCardCount(at('hard'), 10)).toBe(3);
    expect(eclipseCardCount(at('nightmare'), 10)).toBe(3);
    expect(eclipseCardCount(at('nightmare'), 60)).toBe(6);
  });
});

describe('Eclipse Echo: every volley leaves a way through', () => {
  /** Arc length a player needs to slip between two shots at `radius` px from the boss. */
  const needed = 2 * (PLAYER_R + SHOT_R) + 10;
  const arcAt = (degrees: number, radius: number) => (degrees * Math.PI * radius) / 180;

  it('rings: a gap of several shots, turning a little each wave', () => {
    for (const aim of [vec(0, 1), vec(1, 0), fromAngle(2.2)]) {
      for (let wave = 0; wave < DEF.ring.waves; wave++) {
        const dirs = ringDirections(DEF.ring, aim, wave);
        expect(dirs).toHaveLength(DEF.ring.count - DEF.ring.gap);
        expect(arcAt(maxGapDegrees(dirs), 90)).toBeGreaterThan(needed);
      }
    }
    expect((DEF.ring.turn * 360) / DEF.ring.count).toBeLessThanOrEqual(45);
  });

  it('spirals and mirrored spirals: wide angles between arms at every emission', () => {
    for (let e = 0; e < DEF.spiral.emissions; e++) expect(maxGapDegrees(spiralDirections(DEF.spiral, vec(0, 1), e))).toBeGreaterThanOrEqual(60);
    for (let e = 0; e < DEF.mirror.emissions; e++) expect(maxGapDegrees(mirrorDirections(DEF.mirror, vec(0, 1), e))).toBeGreaterThanOrEqual(60);
  });

  it('lanes: a gap wider than a player, never jumping further than a walk between waves, inside the arena', () => {
    expect(DEF.lanes.gapWidth).toBeGreaterThan(2 * (PLAYER_R + SHOT_R) + 30);
    expect(DEF.lanes.maxShift).toBeLessThanOrEqual(((TUNING.player.moveSpeed * DEF.lanes.intervalMs) / 1000) * 0.75);
    for (const startX of [0, 100, 360, 700]) {
      const gaps = laneGaps(DEF.lanes, ARENA.width, startX);
      expect(gaps).toHaveLength(DEF.lanes.waves);
      gaps.forEach((g, i) => {
        expect(g - DEF.lanes.gapWidth / 2).toBeGreaterThanOrEqual(0);
        expect(g + DEF.lanes.gapWidth / 2).toBeLessThanOrEqual(ARENA.width);
        if (i > 0) expect(Math.abs(g - gaps[i - 1]!)).toBeLessThanOrEqual(DEF.lanes.maxShift + 1e-6);
        const xs = laneXs(DEF.lanes, ARENA.width, g);
        expect(xs.length).toBeGreaterThan(10);
        const free = xs.filter((x) => Math.abs(x - g) < DEF.lanes.gapWidth / 2);
        expect(free).toEqual([]);
      });
    }
  });

  it('corona (rolls do not save you): three pockets in the arena, safe inside, burning outside', () => {
    expect(DEF.corona.attack.pierceRoll).toBe(true);
    const pockets = coronaPockets(DEF.corona, CENTER, vec(CENTER.x, CENTER.y - DEF.corona.ring));
    expect(pockets).toHaveLength(DEF.corona.pockets);
    for (const p of pockets) {
      expect(p.x - DEF.corona.pocketRadius).toBeGreaterThanOrEqual(0);
      expect(p.y - DEF.corona.pocketRadius).toBeGreaterThanOrEqual(0);
      expect(p.x + DEF.corona.pocketRadius).toBeLessThanOrEqual(ARENA.width);
      expect(p.y + DEF.corona.pocketRadius).toBeLessThanOrEqual(ARENA.height);
      expect(coronaTouches(DEF.corona, CENTER, pockets[0]!, p)).toBe(false);
    }
    expect(DEF.corona.pocketRadius).toBeGreaterThan(PLAYER_R * 3);
    expect(coronaTouches(DEF.corona, CENTER, pockets[0]!, vec(10, ARENA.height - 10))).toBe(true);
  });

  it('noose (rolls do not save you): a closing ring with a gap; the gap and the inside are safe', () => {
    expect(DEF.noose.attack.pierceRoll).toBe(true);
    expect(nooseRadius(DEF.noose, 0)).toBe(DEF.noose.fromRadius);
    expect(nooseRadius(DEF.noose, DEF.noose.closeMs)).toBe(DEF.noose.toRadius);
    const gap = vec(1, 0);
    const half = DEF.noose.closeMs / 2;
    const r = nooseRadius(DEF.noose, half);
    expect(nooseTouches(DEF.noose, CENTER, gap, half, vec(CENTER.x, CENTER.y + r))).toBe(true);
    expect(nooseTouches(DEF.noose, CENTER, gap, half, vec(CENTER.x + r, CENTER.y))).toBe(false);
    expect(nooseTouches(DEF.noose, CENTER, gap, half, CENTER)).toBe(false);
    expect((DEF.noose.gapDegrees * Math.PI * DEF.noose.toRadius) / 180).toBeGreaterThan(2 * PLAYER_R);
  });
});

/** The fight on floor 60 (all six cards), the player standing in a corner, for `ms`. */
function fight(ms: number): { world: WorldState; maxShots: number; stances: Set<string>; events: GameEvent[] } {
  let world = startRun(7, {}, 60, 'eclipse-chasm').world;
  world = { ...world, player: { ...world.player, pos: vec(40, ARENA.height - 40), hp: 1e9, maxHp: 1e9 } };
  let maxShots = 0;
  const stances = new Set<string>();
  const events: GameEvent[] = [];
  for (let t = 0; t < ms; t += FIXED_DT_MS) {
    world = step(world, IDLE, FIXED_DT_MS);
    world = { ...world, player: { ...world.player, hp: 1e9 } };
    maxShots = Math.max(maxShots, world.projectiles.filter((p) => p.owner === 'enemy').length);
    stances.add(world.enemies[0]!.boss!.stance);
    events.push(...world.events);
  }
  return { world, maxShots, stances, events };
}

describe('Eclipse Echo: the fight', () => {
  it('plays every card in turn, announced by name, and never puts more than the cap of shots in the air', () => {
    const { maxShots, stances, events } = fight(70_000);
    expect([...stances].sort()).toEqual([...DEF.cards].sort());
    expect(maxShots).toBeGreaterThan(20);
    expect(maxShots).toBeLessThanOrEqual(DEF.maxShots);
    const announced = events.filter((e) => e.type === 'bossStance').map((e) => (e.type === 'bossStance' ? e.stance : ''));
    expect(announced.slice(0, 6)).toEqual([...DEF.cards]);
  });

  it('with the air already full, its volleys only top it up to the cap', () => {
    let world = startRun(7, {}, 60, 'eclipse-chasm').world;
    const filler = Array.from({ length: DEF.maxShots - 6 }, (_, i) => ({
      id: `x${i}`,
      owner: 'enemy' as const,
      type: 'dark' as const,
      attackerTypes: ['dark' as const],
      power: 1,
      damageMultiplier: 1,
      pos: vec(ARENA.width - 20, 20 + (i % 10)),
      vel: vec(0, 0),
      radius: 2,
      remainingMs: 1e9,
      hitstunMs: 0,
      knockback: 0,
      hitIds: [],
    }));
    world = { ...world, projectiles: filler, player: { ...world.player, pos: vec(40, ARENA.height - 40), hp: 1e9, maxHp: 1e9 } };
    let most = 0;
    for (let t = 0; t < 20_000; t += FIXED_DT_MS) {
      world = step(world, IDLE, FIXED_DT_MS);
      world = { ...world, player: { ...world.player, hp: 1e9 } };
      most = Math.max(most, world.projectiles.filter((p) => p.owner === 'enemy').length);
    }
    expect(most).toBe(DEF.maxShots);
  });

  it('a guest outside the pockets is burned by the corona victim-side; inside a pocket it is not', () => {
    let host = startRun(7, {}, 30, 'eclipse-chasm').world;
    host = { ...host, player: { ...host.player, pos: vec(40, ARENA.height - 40) } };
    for (let t = 0; t < 30_000 && host.enemies[0]!.boss!.stance !== 'corona'; t += FIXED_DT_MS) host = step(host, IDLE, FIXED_DT_MS);
    for (let t = 0; t < 5000 && host.enemies[0]!.ai.mode !== 'attack'; t += FIXED_DT_MS) host = step(host, IDLE, FIXED_DT_MS);
    const boss = host.enemies[0]!;
    expect(boss.boss!.stance).toBe('corona');
    expect(boss.ai.mode).toBe('attack');
    const guest: WorldState = { ...host, role: 'guest', localId: 'p2', enemies: host.enemies.map((e) => ({ ...e, ai: { ...e.ai, contact: 'none' as const } })) };
    const outside = guestEnemyContacts({ ...guest, player: { ...guest.player, pos: vec(10, ARENA.height - 10) } }, []);
    expect(outside.player.hp).toBeLessThan(guest.player.hp);
    const pocket = coronaPockets(DEF.corona, CENTER, boss.ai.aimPoint!)[1]!;
    const inside = guestEnemyContacts({ ...guest, player: { ...guest.player, pos: pocket } }, []);
    expect(inside.player.hp).toBe(guest.player.hp);
  });
});
